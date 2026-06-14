import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, seed } = body

    if (!userId || !projectId || !seed || !seed.id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const createdAt = seed.createdAt || Date.now()
    const updatedAt = seed.updatedAt || Date.now()
    const status = ["open", "developing", "paid_off", "dropped"].includes(String(seed.status)) ? seed.status : "open"

    await pool.query(
      `INSERT INTO arc_seeds (
         id, project_id, user_id, title, summary, why_it_matters, future_payoff, evidence,
         chapter_title, chapter_id, chapter_number, related_characters, related_entities, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16)
       ON CONFLICT (id)
       DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         why_it_matters = EXCLUDED.why_it_matters,
         future_payoff = EXCLUDED.future_payoff,
         evidence = EXCLUDED.evidence,
         chapter_title = EXCLUDED.chapter_title,
         chapter_id = EXCLUDED.chapter_id,
         chapter_number = EXCLUDED.chapter_number,
         related_characters = EXCLUDED.related_characters,
         related_entities = EXCLUDED.related_entities,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        seed.id,
        projectId,
        userId,
        seed.title || "Untitled Arc Seed",
        seed.summary || "",
        seed.whyItMatters || "",
        seed.futurePayoff || "",
        seed.evidence || "",
        seed.chapterTitle || "",
        seed.chapterId || "",
        seed.chapterNumber ?? null,
        JSON.stringify(Array.isArray(seed.relatedCharacters) ? seed.relatedCharacters : []),
        JSON.stringify(Array.isArray(seed.relatedEntities) ? seed.relatedEntities : []),
        status,
        createdAt,
        updatedAt
      ]
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving arc seed:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
