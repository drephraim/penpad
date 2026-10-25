import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, reminder } = body

    if (!userId || !projectId || !reminder || !reminder.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = reminder.createdAt || Date.now()
    const updatedAt = reminder.updatedAt || Date.now()
    const status = ["open", "closed"].includes(String(reminder.status)) ? reminder.status : "open"

    await pool.query(
      `INSERT INTO reminders (
         id, project_id, user_id, title, content, note,
         chapter_title, chapter_id, chapter_number, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id)
       DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         note = EXCLUDED.note,
         chapter_title = EXCLUDED.chapter_title,
         chapter_id = EXCLUDED.chapter_id,
         chapter_number = EXCLUDED.chapter_number,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        reminder.id,
        projectId,
        userId,
        reminder.title || "Untitled Reminder",
        reminder.content || "",
        reminder.note || "",
        reminder.chapterTitle || "",
        reminder.chapterId || "",
        reminder.chapterNumber ?? null,
        status,
        createdAt,
        updatedAt
      ]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving reminder:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
