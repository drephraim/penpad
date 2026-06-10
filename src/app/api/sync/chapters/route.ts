import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  wordGoal?: number
  volumeId?: string | null
  sortOrder?: number
}

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId, localNotes } = body as { userId: string; projectId: string; localNotes: Note[] }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const localNotesList = localNotes || []

    // Ensure the project exists in the database to satisfy the foreign key constraint
    await pool.query(
      `INSERT INTO projects (id, user_id, name, last_updated)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId, "Untitled Project", Date.now()]
    )

    // Fetch chapters from DB
    const selectRes = await pool.query(
      "SELECT id, title, content, created_at, updated_at, word_goal, volume_id, sort_order FROM chapters WHERE user_id = $1 AND project_id = $2",
      [userId, projectId]
    )

    const cloudNotes: Note[] = selectRes.rows.map(row => ({
      id: row.id,
      title: row.title || "Untitled",
      content: row.content || "",
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now(),
      wordGoal: row.word_goal !== null ? Number(row.word_goal) : undefined,
      volumeId: row.volume_id || null,
      sortOrder: row.sort_order !== null ? Number(row.sort_order) : undefined
    }))

    const cloudNotesMap = new Map(cloudNotes.map(n => [n.id, n]))
    const localNotesMap = new Map(localNotesList.map(n => [n.id, n]))
    const finalNotesMap = new Map<string, Note>()

    // Reconcile local storage chapters
    for (const localNote of localNotesList) {
      const cloudNote = cloudNotesMap.get(localNote.id)
      const localUpdated = localNote.updatedAt || Date.now()
      const localCreated = localNote.createdAt || Date.now()
      const wordGoal = localNote.wordGoal || 1200
      const volumeId = localNote.volumeId || null
      const sortOrder = typeof localNote.sortOrder === "number" ? localNote.sortOrder : null

      if (!cloudNote) {
        // Upload to cloud
        await pool.query(
          `INSERT INTO chapters (id, project_id, user_id, title, content, created_at, updated_at, word_goal, volume_id, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET 
            title = EXCLUDED.title, 
            content = EXCLUDED.content, 
            updated_at = EXCLUDED.updated_at, 
            word_goal = EXCLUDED.word_goal,
            volume_id = EXCLUDED.volume_id,
            sort_order = EXCLUDED.sort_order`,
          [localNote.id, projectId, userId, localNote.title, localNote.content || "", localCreated, localUpdated, wordGoal, volumeId, sortOrder]
        )
        finalNotesMap.set(localNote.id, {
          ...localNote,
          updatedAt: localUpdated,
          createdAt: localCreated,
          wordGoal,
          volumeId,
          ...(sortOrder !== null ? { sortOrder } : {})
        })
      } else {
        const cloudUpdated = cloudNote.updatedAt || 0
        if (localUpdated > cloudUpdated) {
          // Local is newer, upload to cloud
          await pool.query(
            `UPDATE chapters 
             SET title = $1, content = $2, updated_at = $3, word_goal = $4, volume_id = $5, sort_order = $6 
             WHERE id = $7 AND user_id = $8 AND project_id = $9`,
            [localNote.title, localNote.content || "", localUpdated, wordGoal, volumeId, sortOrder, localNote.id, userId, projectId]
          )
          finalNotesMap.set(localNote.id, {
            ...localNote,
            updatedAt: localUpdated,
            wordGoal,
            volumeId,
            ...(sortOrder !== null ? { sortOrder } : {})
          })
        } else {
          // Cloud is newer, use cloud version
          finalNotesMap.set(localNote.id, cloudNote)
        }
      }
    }

    // Pull down cloud chapters that aren't in local storage
    for (const cloudNote of cloudNotes) {
      if (!localNotesMap.has(cloudNote.id)) {
        finalNotesMap.set(cloudNote.id, cloudNote)
      }
    }

    const merged = Array.from(finalNotesMap.values()).sort((a, b) => {
      const aSort = typeof a.sortOrder === "number" ? a.sortOrder : a.createdAt
      const bSort = typeof b.sortOrder === "number" ? b.sortOrder : b.createdAt
      return aSort - bSort
    })

    return NextResponse.json({ chapters: merged })
  } catch (error: unknown) {
    console.error("Error in sync chapters API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
