import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface BrainEntry {
  id: string
  highlightedText: string
  aiSummary: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number
  entityType?: string
  entityName?: string
  importance?: string
  connections?: string[]
  createdAt: number
  updatedAt: number
}

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localEntries } = body as {
      userId: string
      projectId: string
      localEntries: BrainEntry[]
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localList = localEntries || []

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const selectRes = await pool.query(
      "SELECT id, highlighted_text, ai_summary, chapter_title, chapter_id, chapter_number, entity_type, entity_name, importance, connections, created_at, updated_at FROM brain_entries WHERE user_id = $1 AND project_id = $2",
      [userId, projectId]
    )

    const cloudEntries: BrainEntry[] = selectRes.rows.map(row => ({
      id: row.id,
      highlightedText: row.highlighted_text || "",
      aiSummary: row.ai_summary || "",
      chapterTitle: row.chapter_title || "",
      chapterId: row.chapter_id || "",
      chapterNumber: row.chapter_number != null ? Number(row.chapter_number) : undefined,
      entityType: row.entity_type || undefined,
      entityName: row.entity_name || undefined,
      importance: row.importance || undefined,
      connections: Array.isArray(row.connections) ? row.connections : [],
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const cloudMap = new Map(cloudEntries.map(e => [e.id, e]))
    const localMap = new Map(localList.map(e => [e.id, e]))
    const finalMap = new Map<string, BrainEntry>()

    for (const localEntry of localList) {
      const cloudEntry = cloudMap.get(localEntry.id)
      const localUpdated = localEntry.updatedAt || Date.now()
      const localCreated = localEntry.createdAt || Date.now()

      if (!cloudEntry) {
        await pool.query(
          `INSERT INTO brain_entries (id, project_id, user_id, highlighted_text, ai_summary, chapter_title, chapter_id, chapter_number, entity_type, entity_name, importance, connections, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
           ON CONFLICT (id) DO UPDATE SET 
            highlighted_text = EXCLUDED.highlighted_text,
            ai_summary = EXCLUDED.ai_summary,
            chapter_title = EXCLUDED.chapter_title,
            chapter_id = EXCLUDED.chapter_id,
            chapter_number = EXCLUDED.chapter_number,
            entity_type = EXCLUDED.entity_type,
            entity_name = EXCLUDED.entity_name,
            importance = EXCLUDED.importance,
            connections = EXCLUDED.connections,
            updated_at = EXCLUDED.updated_at`,
          [
            localEntry.id,
            projectId,
            userId,
            localEntry.highlightedText,
            localEntry.aiSummary,
            localEntry.chapterTitle || "",
            localEntry.chapterId || "",
            localEntry.chapterNumber ?? null,
            localEntry.entityType || null,
            localEntry.entityName || null,
            localEntry.importance || null,
            JSON.stringify(localEntry.connections || []),
            localCreated,
            localUpdated
          ]
        )
        finalMap.set(localEntry.id, {
          ...localEntry,
          updatedAt: localUpdated,
          createdAt: localCreated
        })
      } else {
        const cloudUpdated = cloudEntry.updatedAt || 0
        if (localUpdated > cloudUpdated) {
          await pool.query(
            `UPDATE brain_entries 
             SET highlighted_text = $1, ai_summary = $2, chapter_title = $3, chapter_id = $4, chapter_number = $5, entity_type = $6, entity_name = $7, importance = $8, connections = $9::jsonb, updated_at = $10 
             WHERE id = $11 AND user_id = $12 AND project_id = $13`,
            [
              localEntry.highlightedText,
              localEntry.aiSummary,
              localEntry.chapterTitle || "",
              localEntry.chapterId || "",
              localEntry.chapterNumber ?? null,
              localEntry.entityType || null,
              localEntry.entityName || null,
              localEntry.importance || null,
              JSON.stringify(localEntry.connections || []),
              localUpdated,
              localEntry.id,
              userId,
              projectId
            ]
          )
          finalMap.set(localEntry.id, {
            ...localEntry,
            updatedAt: localUpdated
          })
        } else {
          finalMap.set(localEntry.id, cloudEntry)
        }
      }
    }

    for (const cloudEntry of cloudEntries) {
      if (!localMap.has(cloudEntry.id)) {
        finalMap.set(cloudEntry.id, cloudEntry)
      }
    }

    const merged = Array.from(finalMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)

    return NextResponse.json({ entries: merged })
  } catch (error: unknown) {
    console.error("Error in sync brain API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
