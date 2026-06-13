import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface BibleEntry {
  id: string
  name: string
  category: "character" | "world" | "beast" | "place" | "item"
  content: string
  groupIds?: string[]
  timelineFacts?: unknown[]
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
      localEntries: BibleEntry[]
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localList = localEntries || []

    // Ensure the project exists in the projects table to satisfy foreign key constraints
    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    // Fetch bible entries from DB
    const selectRes = await pool.query(
      "SELECT id, name, category, content, created_at, updated_at, group_ids, timeline_facts FROM bible_entries WHERE user_id = $1 AND project_id = $2",
      [userId, projectId]
    )

    const cloudEntries: BibleEntry[] = selectRes.rows.map(row => ({
      id: row.id,
      name: row.name || "Untitled",
      category: (row.category || "character") as "character" | "world" | "beast" | "place" | "item",
      content: row.content || "",
      groupIds: Array.isArray(row.group_ids) ? row.group_ids.filter((item: unknown) => typeof item === "string") : [],
      timelineFacts: Array.isArray(row.timeline_facts) ? row.timeline_facts : [],
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const cloudMap = new Map(cloudEntries.map(e => [e.id, e]))
    const localMap = new Map(localList.map(e => [e.id, e]))
    const finalMap = new Map<string, BibleEntry>()

    // Reconcile local storage bible entries
    for (const localEntry of localList) {
      const cloudEntry = cloudMap.get(localEntry.id)
      const localUpdated = localEntry.updatedAt || Date.now()
      const localCreated = localEntry.createdAt || Date.now()
      const groupIds = Array.isArray(localEntry.groupIds) ? localEntry.groupIds : []
      const timelineFacts = Array.isArray(localEntry.timelineFacts) ? localEntry.timelineFacts : []

      if (!cloudEntry) {
        // Upload to cloud
        await pool.query(
          `INSERT INTO bible_entries (id, project_id, user_id, name, category, content, created_at, updated_at, group_ids, timeline_facts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at,
            group_ids = EXCLUDED.group_ids,
            timeline_facts = EXCLUDED.timeline_facts`,
          [localEntry.id, projectId, userId, localEntry.name, localEntry.category, localEntry.content || "", localCreated, localUpdated, JSON.stringify(groupIds), JSON.stringify(timelineFacts)]
        )
        finalMap.set(localEntry.id, {
          ...localEntry,
          updatedAt: localUpdated,
          createdAt: localCreated,
          groupIds,
          timelineFacts
        })
      } else {
        const cloudUpdated = cloudEntry.updatedAt || 0
        if (localUpdated > cloudUpdated) {
          // Local is newer, upload to cloud
          await pool.query(
            `UPDATE bible_entries 
             SET name = $1, category = $2, content = $3, updated_at = $4, group_ids = $5, timeline_facts = $6 
             WHERE id = $7 AND user_id = $8 AND project_id = $9`,
            [localEntry.name, localEntry.category, localEntry.content || "", localUpdated, JSON.stringify(groupIds), JSON.stringify(timelineFacts), localEntry.id, userId, projectId]
          )
          finalMap.set(localEntry.id, {
            ...localEntry,
            updatedAt: localUpdated,
            groupIds,
            timelineFacts
          })
        } else {
          // Cloud is newer, use cloud version
          finalMap.set(localEntry.id, cloudEntry)
        }
      }
    }

    // Pull down cloud entries that aren't in local storage
    for (const cloudEntry of cloudEntries) {
      if (!localMap.has(cloudEntry.id)) {
        finalMap.set(cloudEntry.id, cloudEntry)
      }
    }

    const merged = Array.from(finalMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)

    return NextResponse.json({ entries: merged })
  } catch (error: unknown) {
    console.error("Error in sync bible API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
