import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localSystem } = body as {
      userId: string
      projectId: string
      localSystem: unknown
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const selectRes = await pool.query(
      "SELECT system_data, updated_at FROM progression_system WHERE project_id = $1 AND user_id = $2",
      [projectId, userId]
    )

    if (selectRes.rows.length > 0) {
      const cloudRow = selectRes.rows[0]
      const cloudUpdated = cloudRow.updated_at ? Number(cloudRow.updated_at) : 0
      const localUpdated = Number((localSystem as Record<string, unknown>)?.updatedAt ?? 0)

      if (localUpdated > cloudUpdated) {
        await pool.query(
          `UPDATE progression_system
           SET system_data = $1::jsonb, updated_at = $2
           WHERE project_id = $3 AND user_id = $4`,
          [JSON.stringify(localSystem), localUpdated, projectId, userId]
        )
        return NextResponse.json({ system: localSystem })
      } else {
        return NextResponse.json({ system: cloudRow.system_data })
      }
    } else {
      if (localSystem) {
        const updatedAt = Number((localSystem as Record<string, unknown>)?.updatedAt ?? Date.now())
        await pool.query(
          `INSERT INTO progression_system (project_id, user_id, system_data, updated_at)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (project_id) DO UPDATE SET
             system_data = EXCLUDED.system_data,
             updated_at = EXCLUDED.updated_at`,
          [projectId, userId, JSON.stringify(localSystem), updatedAt]
        )
      }
      return NextResponse.json({ system: localSystem || null })
    }
  } catch (error: unknown) {
    console.error("Error in sync progression system API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
