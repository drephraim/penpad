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

    // Ensure the project exists
    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = entry.createdAt || Date.now()
    const updatedAt = entry.updatedAt || Date.now()
    const groupIds = Array.isArray(entry.groupIds) ? entry.groupIds : []
    const timelineFacts = Array.isArray(entry.timelineFacts) ? entry.timelineFacts : []
    const characterDetails = entry.characterDetails && typeof entry.characterDetails === "object" ? entry.characterDetails : null

    await pool.query(
      `INSERT INTO bible_entries (id, project_id, user_id, name, category, content, created_at, updated_at, group_ids, timeline_facts, character_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id)
       DO UPDATE SET 
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         content = EXCLUDED.content,
         updated_at = EXCLUDED.updated_at,
         group_ids = EXCLUDED.group_ids,
         timeline_facts = EXCLUDED.timeline_facts,
         character_details = EXCLUDED.character_details`,
      [entry.id, projectId, userId, entry.name || "Untitled", entry.category || "character", entry.content || "", createdAt, updatedAt, JSON.stringify(groupIds), JSON.stringify(timelineFacts), JSON.stringify(characterDetails)]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving bible entry:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
