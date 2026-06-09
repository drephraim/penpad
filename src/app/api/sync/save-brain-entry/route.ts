import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, entry } = body

    if (!userId || !projectId || !entry || !entry.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = entry.createdAt || Date.now()
    const updatedAt = entry.updatedAt || Date.now()

    await pool.query(
      `INSERT INTO brain_entries (id, project_id, user_id, highlighted_text, ai_summary, chapter_title, chapter_id, chapter_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id)
       DO UPDATE SET 
         highlighted_text = EXCLUDED.highlighted_text,
         ai_summary = EXCLUDED.ai_summary,
         chapter_title = EXCLUDED.chapter_title,
         chapter_id = EXCLUDED.chapter_id,
         chapter_number = EXCLUDED.chapter_number,
         updated_at = EXCLUDED.updated_at`,
      [entry.id, projectId, userId, entry.highlightedText || "", entry.aiSummary || "", entry.chapterTitle || "", entry.chapterId || "", entry.chapterNumber ?? null, createdAt, updatedAt]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving brain entry:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
