import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface ArcSeed {
  id: string
  title: string
  summary: string
  whyItMatters: string
  futurePayoff: string
  evidence: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number | null
  relatedCharacters?: string[]
  relatedEntities?: string[]
  status: "open" | "developing" | "paid_off" | "dropped"
  createdAt: number
  updatedAt: number
}

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localSeeds } = body as {
      userId: string
      projectId: string
      localSeeds: ArcSeed[]
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localList = Array.isArray(localSeeds) ? localSeeds : []

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const selectRes = await pool.query(
      `SELECT id, title, summary, why_it_matters, future_payoff, evidence, chapter_title, chapter_id, chapter_number,
              related_characters, related_entities, status, created_at, updated_at
       FROM arc_seeds
       WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId]
    )

    const cloudSeeds: ArcSeed[] = selectRes.rows.map(row => ({
      id: row.id,
      title: row.title || "Untitled Arc Seed",
      summary: row.summary || "",
      whyItMatters: row.why_it_matters || "",
      futurePayoff: row.future_payoff || "",
      evidence: row.evidence || "",
      chapterTitle: row.chapter_title || "",
      chapterId: row.chapter_id || "",
      chapterNumber: row.chapter_number != null ? Number(row.chapter_number) : null,
      relatedCharacters: Array.isArray(row.related_characters) ? row.related_characters : [],
      relatedEntities: Array.isArray(row.related_entities) ? row.related_entities : [],
      status: ["open", "developing", "paid_off", "dropped"].includes(String(row.status)) ? row.status : "open",
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const cloudMap = new Map(cloudSeeds.map(seed => [seed.id, seed]))
    const localMap = new Map(localList.map(seed => [seed.id, seed]))
    const finalMap = new Map<string, ArcSeed>()

    for (const localSeed of localList) {
      const cloudSeed = cloudMap.get(localSeed.id)
      const localUpdated = localSeed.updatedAt || Date.now()
      const localCreated = localSeed.createdAt || Date.now()
      const status = ["open", "developing", "paid_off", "dropped"].includes(String(localSeed.status)) ? localSeed.status : "open"

      if (!cloudSeed) {
        await pool.query(
          `INSERT INTO arc_seeds (
             id, project_id, user_id, title, summary, why_it_matters, future_payoff, evidence,
             chapter_title, chapter_id, chapter_number, related_characters, related_entities, status, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16)
           ON CONFLICT (id) DO UPDATE SET
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
            localSeed.id,
            projectId,
            userId,
            localSeed.title || "Untitled Arc Seed",
            localSeed.summary || "",
            localSeed.whyItMatters || "",
            localSeed.futurePayoff || "",
            localSeed.evidence || "",
            localSeed.chapterTitle || "",
            localSeed.chapterId || "",
            localSeed.chapterNumber ?? null,
            JSON.stringify(localSeed.relatedCharacters || []),
            JSON.stringify(localSeed.relatedEntities || []),
            status,
            localCreated,
            localUpdated
          ]
        )
        finalMap.set(localSeed.id, { ...localSeed, status, createdAt: localCreated, updatedAt: localUpdated })
      } else if (localUpdated > (cloudSeed.updatedAt || 0)) {
        await pool.query(
          `UPDATE arc_seeds
           SET title = $1, summary = $2, why_it_matters = $3, future_payoff = $4, evidence = $5,
               chapter_title = $6, chapter_id = $7, chapter_number = $8, related_characters = $9::jsonb,
               related_entities = $10::jsonb, status = $11, updated_at = $12
           WHERE id = $13 AND user_id = $14 AND project_id = $15`,
          [
            localSeed.title || "Untitled Arc Seed",
            localSeed.summary || "",
            localSeed.whyItMatters || "",
            localSeed.futurePayoff || "",
            localSeed.evidence || "",
            localSeed.chapterTitle || "",
            localSeed.chapterId || "",
            localSeed.chapterNumber ?? null,
            JSON.stringify(localSeed.relatedCharacters || []),
            JSON.stringify(localSeed.relatedEntities || []),
            status,
            localUpdated,
            localSeed.id,
            userId,
            projectId
          ]
        )
        finalMap.set(localSeed.id, { ...localSeed, status, updatedAt: localUpdated })
      } else {
        finalMap.set(localSeed.id, cloudSeed)
      }
    }

    for (const cloudSeed of cloudSeeds) {
      if (!localMap.has(cloudSeed.id)) {
        finalMap.set(cloudSeed.id, cloudSeed)
      }
    }

    const merged = Array.from(finalMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    return NextResponse.json({ seeds: merged })
  } catch (error: unknown) {
    console.error("Error in sync arc seeds API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
