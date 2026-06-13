import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { novelName, chapterTitle, chapterContent } = body

    if (!novelName || !chapterTitle || !chapterContent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const trimmedNovelName = novelName.trim()
    const trimmedChapterTitle = chapterTitle.trim()

    // 1. Get or create the novel in buffered_novels
    let novelId: string
    const novelRes = await pool.query(
      `INSERT INTO buffered_novels (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [trimmedNovelName]
    )

    if (novelRes.rows.length > 0) {
      novelId = novelRes.rows[0].id
    } else {
      const selectRes = await pool.query(
        `SELECT id FROM buffered_novels WHERE name = $1`,
        [trimmedNovelName]
      )
      novelId = selectRes.rows[0].id
    }

    // 2. Insert the chapter into buffered_chapters
    // The DB trigger 'trg_limit_chapters_per_novel' will automatically keep only the latest 5 chapters.
    const chapterRes = await pool.query(
      `INSERT INTO buffered_chapters (novel_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [novelId, trimmedChapterTitle, chapterContent]
    )

    return NextResponse.json({ success: true, chapter: chapterRes.rows[0] })
  } catch (error: unknown) {
    console.error("Error buffering chapter:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
