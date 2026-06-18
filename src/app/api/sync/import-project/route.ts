import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

type JsonRecord = Record<string, unknown>

const jsonArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const jsonObject = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
const optionalNumber = (value: unknown): number | undefined => value === null || value === undefined ? undefined : Number(value)

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, projectId } = body as { userId?: string; projectId?: string }

    if (!userId || !projectId) {
      return NextResponse.json({ error: "Missing userId or projectId" }, { status: 400 })
    }

    const [
      projectRes,
      chaptersRes,
      bibleRes,
      brainRes,
      arcSeedsRes,
      progressionProfilesRes,
      progressionSystemRes,
      referenceLibraryRes,
      nameForgeRes
    ] = await Promise.all([
      pool.query(
        "SELECT id, name, last_updated, volumes, bible_groups, progression_profiles, progression_system FROM projects WHERE id = $1 AND user_id = $2",
        [projectId, userId]
      ),
      pool.query(
        "SELECT id, title, content, created_at, updated_at, word_goal, volume_id, sort_order FROM chapters WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      ),
      pool.query(
        "SELECT id, name, category, content, created_at, updated_at, group_ids, timeline_facts, character_details FROM bible_entries WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      ),
      pool.query(
        "SELECT id, highlighted_text, ai_summary, chapter_title, chapter_id, chapter_number, entity_type, entity_name, importance, connections, created_at, updated_at FROM brain_entries WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      ),
      pool.query(
        `SELECT id, title, summary, why_it_matters, future_payoff, evidence, chapter_title, chapter_id, chapter_number,
                related_characters, related_entities, status, created_at, updated_at
         FROM arc_seeds
         WHERE user_id = $1 AND project_id = $2`,
        [userId, projectId]
      ),
      pool.query(
        "SELECT id, profile_data, created_at, updated_at FROM progression_profiles WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      ),
      pool.query(
        "SELECT system_data, updated_at FROM progression_system WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      ),
      pool.query(
        "SELECT data, updated_at FROM reference_library WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      ),
      pool.query(
        "SELECT data, updated_at FROM name_forge_data WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      )
    ])

    const projectRow = projectRes.rows[0]
    const project = projectRow ? {
      id: projectRow.id,
      name: projectRow.name || "Untitled",
      lastUpdated: projectRow.last_updated ? Number(projectRow.last_updated) : 0,
      volumes: jsonArray(projectRow.volumes),
      bibleGroups: jsonArray(projectRow.bible_groups),
      progressionProfiles: jsonArray(projectRow.progression_profiles),
      progressionSystem: projectRow.progression_system || null
    } : null

    const chapters = chaptersRes.rows.map(row => ({
      id: row.id,
      title: row.title || "Untitled",
      content: row.content || "",
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now(),
      wordGoal: row.word_goal !== null ? Number(row.word_goal) : undefined,
      volumeId: row.volume_id || null,
      sortOrder: optionalNumber(row.sort_order)
    }))

    const bibleEntries = bibleRes.rows.map(row => ({
      id: row.id,
      name: row.name || "Untitled",
      category: ["character", "world", "beast", "place", "item"].includes(String(row.category)) ? row.category : "character",
      content: row.content || "",
      groupIds: jsonArray(row.group_ids).filter((item): item is string => typeof item === "string"),
      timelineFacts: jsonArray(row.timeline_facts),
      characterDetails: row.character_details && typeof row.character_details === "object" ? row.character_details : undefined,
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const brainEntries = brainRes.rows.map(row => ({
      id: row.id,
      highlightedText: row.highlighted_text || "",
      aiSummary: row.ai_summary || "",
      chapterTitle: row.chapter_title || "",
      chapterId: row.chapter_id || "",
      chapterNumber: row.chapter_number != null ? Number(row.chapter_number) : undefined,
      entityType: row.entity_type || undefined,
      entityName: row.entity_name || undefined,
      importance: row.importance || undefined,
      connections: jsonArray(row.connections).filter((item): item is string => typeof item === "string"),
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const arcSeeds = arcSeedsRes.rows.map(row => ({
      id: row.id,
      title: row.title || "Untitled Arc Seed",
      summary: row.summary || "",
      whyItMatters: row.why_it_matters || "",
      futurePayoff: row.future_payoff || "",
      evidence: row.evidence || "",
      chapterTitle: row.chapter_title || "",
      chapterId: row.chapter_id || "",
      chapterNumber: row.chapter_number != null ? Number(row.chapter_number) : null,
      relatedCharacters: jsonArray(row.related_characters).filter((item): item is string => typeof item === "string"),
      relatedEntities: jsonArray(row.related_entities).filter((item): item is string => typeof item === "string"),
      status: ["open", "developing", "paid_off", "dropped"].includes(String(row.status)) ? row.status : "open",
      createdAt: row.created_at ? Number(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Number(row.updated_at) : Date.now()
    }))

    const progressionProfiles = progressionProfilesRes.rows.map(row => ({
      ...jsonObject(row.profile_data),
      id: row.id,
      createdAt: row.created_at ? Number(row.created_at) : optionalNumber(jsonObject(row.profile_data).createdAt),
      updatedAt: row.updated_at ? Number(row.updated_at) : optionalNumber(jsonObject(row.profile_data).updatedAt)
    }))

    return NextResponse.json({
      project,
      chapters,
      bibleEntries,
      brainEntries,
      arcSeeds,
      progressionProfiles,
      progressionSystem: progressionSystemRes.rows[0]?.system_data || project?.progressionSystem || null,
      referenceLibrary: referenceLibraryRes.rows[0]?.data || [],
      nameForgeData: nameForgeRes.rows[0]?.data || {},
      importedAt: Date.now()
    })
  } catch (error: unknown) {
    console.error("Error importing project data from database:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
