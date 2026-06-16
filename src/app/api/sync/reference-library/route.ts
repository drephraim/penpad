import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localData } = body as {
      userId: string
      projectId: string
      localData: unknown[]
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
      "SELECT data, updated_at FROM reference_library WHERE project_id = $1 AND user_id = $2",
      [projectId, userId]
    )

    if (selectRes.rows.length > 0) {
      const cloudRow = selectRes.rows[0]
      const cloudUpdated = cloudRow.updated_at ? Number(cloudRow.updated_at) : 0
      const localUpdated = Date.now()

      if (localUpdated > cloudUpdated) {
        await pool.query(
          `UPDATE reference_library
           SET data = $1::jsonb, updated_at = $2
           WHERE project_id = $3 AND user_id = $4`,
          [JSON.stringify(localData), localUpdated, projectId, userId]
        )
        return NextResponse.json({ data: localData })
      } else {
        return NextResponse.json({ data: cloudRow.data })
      }
    } else {
      if (localData && localData.length > 0) {
        const updatedAt = Date.now()
        await pool.query(
          `INSERT INTO reference_library (project_id, user_id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (project_id) DO UPDATE SET
             data = EXCLUDED.data,
             updated_at = EXCLUDED.updated_at`,
          [projectId, userId, JSON.stringify(localData), updatedAt]
        )
      }
      return NextResponse.json({ data: localData || [] })
    }
  } catch (error: unknown) {
    console.error("Error in sync reference library API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
