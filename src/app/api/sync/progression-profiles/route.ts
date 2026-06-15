import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localProfiles } = body as {
      userId: string
      projectId: string
      localProfiles: unknown[]
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localList: { id: string; updatedAt?: number; createdAt?: number; [key: string]: unknown }[] = (localProfiles || []) as { id: string; updatedAt?: number; createdAt?: number; [key: string]: unknown }[]

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const selectRes = await pool.query(
      "SELECT id, profile_data, created_at, updated_at FROM progression_profiles WHERE user_id = $1 AND project_id = $2",
      [userId, projectId]
    )

    const cloudProfiles: { id: string; profileData: unknown; createdAt: number; updatedAt: number }[] = selectRes.rows.map(row => ({
      id: row.id,
      profileData: row.profile_data,
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const cloudMap = new Map(cloudProfiles.map(p => [p.id, p]))
    const localMap = new Map(localList.map(p => [p.id, p]))
    const finalMap = new Map<string, Record<string, unknown>>()

    for (const localProfile of localList) {
      const lp = localProfile
      const cloudEntry = cloudMap.get(lp.id as string)
      const localUpdated = lp.updatedAt || Date.now()
      const localCreated = lp.createdAt || Date.now()

      if (!cloudEntry) {
        await pool.query(
          `INSERT INTO progression_profiles (id, project_id, user_id, profile_data, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             profile_data = EXCLUDED.profile_data,
             updated_at = EXCLUDED.updated_at`,
          [lp.id, projectId, userId, JSON.stringify(lp), localCreated, localUpdated]
        )
        finalMap.set(lp.id, { ...lp, updatedAt: localUpdated, createdAt: localCreated })
      } else {
        const cloudUpdated = cloudEntry.updatedAt || 0
        if (localUpdated > cloudUpdated) {
          await pool.query(
            `UPDATE progression_profiles
             SET profile_data = $1::jsonb, updated_at = $2
             WHERE id = $3 AND user_id = $4 AND project_id = $5`,
            [JSON.stringify(lp), localUpdated, lp.id, userId, projectId]
          )
          finalMap.set(lp.id, { ...lp, updatedAt: localUpdated })
        } else {
          finalMap.set(lp.id, { ...(cloudEntry.profileData as Record<string, unknown>), id: cloudEntry.id, updatedAt: cloudEntry.updatedAt })
        }
      }
    }

    for (const cloudEntry of cloudProfiles) {
      if (!localMap.has(cloudEntry.id)) {
        finalMap.set(cloudEntry.id, { ...(cloudEntry.profileData as Record<string, unknown>), id: cloudEntry.id, updatedAt: cloudEntry.updatedAt })
      }
    }

    const merged = Array.from(finalMap.values()).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))

    return NextResponse.json({ profiles: merged })
  } catch (error: unknown) {
    console.error("Error in sync progression profiles API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
