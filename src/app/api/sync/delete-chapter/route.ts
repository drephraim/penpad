import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, chapterId } = body

    if (!userId || !projectId || !chapterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      "DELETE FROM chapters WHERE id = $1 AND user_id = $2 AND project_id = $3",
      [chapterId, userId, projectId]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting chapter:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
