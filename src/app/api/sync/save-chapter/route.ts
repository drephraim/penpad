import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, note } = body

    if (!userId || !projectId || !note || !note.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Ensure the parent project exists to prevent foreign key constraint violations
    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = note.createdAt || Date.now()
    const updatedAt = note.updatedAt || Date.now()
    const wordGoal = note.wordGoal || 1200
    const volumeId = note.volumeId || null
    const sortOrder = typeof note.sortOrder === "number" ? note.sortOrder : null

    await pool.query(
      `INSERT INTO chapters (id, project_id, user_id, title, content, created_at, updated_at, word_goal, volume_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id)
       DO UPDATE SET 
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         updated_at = EXCLUDED.updated_at,
         word_goal = EXCLUDED.word_goal,
         volume_id = EXCLUDED.volume_id,
         sort_order = EXCLUDED.sort_order`,
      [note.id, projectId, userId, note.title || "Untitled", note.content || "", createdAt, updatedAt, wordGoal, volumeId, sortOrder]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving chapter:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
