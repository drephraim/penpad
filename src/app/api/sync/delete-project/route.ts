import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId } = body

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Deleting the project will cascade delete all associated chapters
    await pool.query(
      "DELETE FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, userId]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting project:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
