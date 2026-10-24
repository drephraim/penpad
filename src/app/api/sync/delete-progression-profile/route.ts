import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, profileId, wipeAll } = body

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (wipeAll) {
      await pool.query(
        "DELETE FROM progression_profiles WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      )
      await pool.query(
        "DELETE FROM progression_system WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      )
      try {
        await pool.query(
          "UPDATE projects SET progression_profiles = '[]'::jsonb, progression_system = NULL WHERE id = $1 AND user_id = $2",
          [projectId, userId]
        )
      } catch {
        // Ignore if columns don't exist
      }
      return NextResponse.json({ success: true, wipedAll: true })
    }

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 })
    }

    await pool.query(
      "DELETE FROM progression_profiles WHERE id = $1 AND user_id = $2 AND project_id = $3",
      [profileId, userId, projectId]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting progression profile:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
