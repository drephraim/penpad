import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, entryId } = body

    if (!userId || !projectId || !entryId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      "DELETE FROM brain_entries WHERE id = $1 AND user_id = $2 AND project_id = $3",
      [entryId, userId, projectId]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting brain entry:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
