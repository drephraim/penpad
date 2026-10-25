import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface Reminder {
  id: string
  title: string
  content: string
  note: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number | null
  status: "open" | "closed"
  createdAt: number
  updatedAt: number
}

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localReminders } = body as {
      userId: string
      projectId: string
      localReminders: Reminder[]
    }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localList = Array.isArray(localReminders) ? localReminders : []

    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    const selectRes = await pool.query(
      `SELECT id, title, content, note, chapter_title, chapter_id, chapter_number, status, created_at, updated_at
       FROM reminders
       WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId]
    )

    const cloudReminders: Reminder[] = selectRes.rows.map(row => ({
      id: row.id,
      title: row.title || "Untitled Reminder",
      content: row.content || "",
      note: row.note || "",
      chapterTitle: row.chapter_title || "",
      chapterId: row.chapter_id || "",
      chapterNumber: row.chapter_number != null ? Number(row.chapter_number) : null,
      status: ["open", "closed"].includes(String(row.status)) ? row.status : "open",
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const cloudMap = new Map(cloudReminders.map(item => [item.id, item]))
    const localMap = new Map(localList.map(item => [item.id, item]))
    const finalMap = new Map<string, Reminder>()

    for (const localItem of localList) {
      const cloudItem = cloudMap.get(localItem.id)
      const localUpdated = localItem.updatedAt || Date.now()
      const localCreated = localItem.createdAt || Date.now()
      const status = ["open", "closed"].includes(String(localItem.status)) ? localItem.status : "open"

      if (!cloudItem) {
        await pool.query(
          `INSERT INTO reminders (
             id, project_id, user_id, title, content, note,
             chapter_title, chapter_id, chapter_number, status, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             note = EXCLUDED.note,
             chapter_title = EXCLUDED.chapter_title,
             chapter_id = EXCLUDED.chapter_id,
             chapter_number = EXCLUDED.chapter_number,
             status = EXCLUDED.status,
             updated_at = EXCLUDED.updated_at`,
          [
            localItem.id,
            projectId,
            userId,
            localItem.title || "Untitled Reminder",
            localItem.content || "",
            localItem.note || "",
            localItem.chapterTitle || "",
            localItem.chapterId || "",
            localItem.chapterNumber ?? null,
            status,
            localCreated,
            localUpdated
          ]
        )
        finalMap.set(localItem.id, { ...localItem, status, createdAt: localCreated, updatedAt: localUpdated })
      } else if (localUpdated > (cloudItem.updatedAt || 0)) {
        await pool.query(
          `UPDATE reminders
           SET title = $1, content = $2, note = $3, chapter_title = $4, chapter_id = $5,
               chapter_number = $6, status = $7, updated_at = $8
           WHERE id = $9 AND user_id = $10 AND project_id = $11`,
          [
            localItem.title || "Untitled Reminder",
            localItem.content || "",
            localItem.note || "",
            localItem.chapterTitle || "",
            localItem.chapterId || "",
            localItem.chapterNumber ?? null,
            status,
            localUpdated,
            localItem.id,
            userId,
            projectId
          ]
        )
        finalMap.set(localItem.id, { ...localItem, status, updatedAt: localUpdated })
      } else {
        finalMap.set(localItem.id, cloudItem)
      }
    }

    for (const cloudItem of cloudReminders) {
      if (!localMap.has(cloudItem.id)) {
        finalMap.set(cloudItem.id, cloudItem)
      }
    }

    const merged = Array.from(finalMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    return NextResponse.json({ reminders: merged })
  } catch (error: unknown) {
    console.error("Error in sync reminders API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
