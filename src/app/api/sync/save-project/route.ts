import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, project } = body

    if (!userId || !project || !project.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const lastUpdated = project.lastUpdated || Date.now()

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) 
       DO UPDATE SET name = EXCLUDED.name, last_updated = EXCLUDED.last_updated`,
      [project.id, userId, project.name || "Untitled", lastUpdated]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving project:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
