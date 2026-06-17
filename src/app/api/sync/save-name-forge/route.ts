import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, data } = body

    if (!userId || !projectId || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const updatedAt = Date.now()
    await pool.query(
      `INSERT INTO name_forge_data (project_id, user_id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (project_id)
       DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [projectId, userId, JSON.stringify(data), updatedAt]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving name-forge data:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
