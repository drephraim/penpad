import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, profile } = body

    if (!userId || !projectId || !profile || !profile.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = profile.createdAt || Date.now()
    const updatedAt = profile.updatedAt || Date.now()

    await pool.query(
      `INSERT INTO progression_profiles (id, project_id, user_id, profile_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (id)
       DO UPDATE SET
         profile_data = EXCLUDED.profile_data,
         updated_at = EXCLUDED.updated_at`,
      [profile.id, projectId, userId, JSON.stringify(profile), createdAt, updatedAt]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving progression profile:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
