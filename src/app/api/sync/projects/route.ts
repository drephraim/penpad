import { NextRequest, NextResponse } from "next/server"
import pool, { bootstrapDb } from "@/lib/db-postgres"

interface Project {
  id: string
  name: string
  lastUpdated?: number
  volumes?: unknown[]
  bibleGroups?: unknown[]
  progressionProfiles?: unknown[]
  progressionSystem?: unknown
}

export async function POST(req: NextRequest) {
  try {
    await bootstrapDb()

    const body = await req.json()
    const { userId, localProjects } = body as { userId: string; localProjects: Project[] }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const localProjs = localProjects || []

    // Fetch projects from DB including JSONB metadata
    const selectRes = await pool.query(
      "SELECT id, name, last_updated, volumes, bible_groups, progression_profiles, progression_system FROM projects WHERE user_id = $1",
      [userId]
    )

    const cloudProjects: Project[] = selectRes.rows.map(row => ({
      id: row.id,
      name: row.name || "Untitled",
      lastUpdated: row.last_updated ? Number(row.last_updated) : 0,
      volumes: row.volumes || [],
      bibleGroups: row.bible_groups || [],
      progressionProfiles: row.progression_profiles || [],
      progressionSystem: row.progression_system || null
    }))

    const cloudProjectsMap = new Map(cloudProjects.map(p => [p.id, p]))
    const localProjectsMap = new Map(localProjs.map(p => [p.id, p]))
    const finalProjectsMap = new Map<string, Project>()

    // Reconcile local storage projects
    for (const localProj of localProjs) {
      const cloudProj = cloudProjectsMap.get(localProj.id)
      const localTime = localProj.lastUpdated || Date.now()

      if (!cloudProj) {
        // Upload local project to cloud
        await pool.query(
          `INSERT INTO projects (id, user_id, name, last_updated, volumes, bible_groups, progression_profiles, progression_system)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
             name = EXCLUDED.name, 
             last_updated = EXCLUDED.last_updated,
             volumes = EXCLUDED.volumes,
             bible_groups = EXCLUDED.bible_groups,
             progression_profiles = EXCLUDED.progression_profiles,
             progression_system = EXCLUDED.progression_system`,
          [
            localProj.id, 
            userId, 
            localProj.name, 
            localTime,
            JSON.stringify(localProj.volumes || []),
            JSON.stringify(localProj.bibleGroups || []),
            JSON.stringify(localProj.progressionProfiles || []),
            localProj.progressionSystem ? JSON.stringify(localProj.progressionSystem) : null
          ]
        )
        finalProjectsMap.set(localProj.id, {
          ...localProj,
          lastUpdated: localTime
        })
      } else {
        const cloudTime = cloudProj.lastUpdated || 0
        if (localTime > cloudTime) {
          // Local is newer, upload to cloud
          await pool.query(
            `UPDATE projects SET 
               name = $1, 
               last_updated = $2, 
               volumes = $3, 
               bible_groups = $4, 
               progression_profiles = $5, 
               progression_system = $6 
             WHERE id = $7 AND user_id = $8`,
            [
              localProj.name, 
              localTime,
              JSON.stringify(localProj.volumes || []),
              JSON.stringify(localProj.bibleGroups || []),
              JSON.stringify(localProj.progressionProfiles || []),
              localProj.progressionSystem ? JSON.stringify(localProj.progressionSystem) : null,
              localProj.id, 
              userId
            ]
          )
          finalProjectsMap.set(localProj.id, {
            ...localProj,
            lastUpdated: localTime
          })
        } else {
          // Cloud is newer, use cloud version
          finalProjectsMap.set(localProj.id, cloudProj)
        }
      }
    }

    // Pull down cloud projects that aren't in local storage
    for (const cloudProj of cloudProjects) {
      if (!localProjectsMap.has(cloudProj.id)) {
        finalProjectsMap.set(cloudProj.id, cloudProj)
      }
    }

    const merged = Array.from(finalProjectsMap.values()).sort((a, b) => {
      const timeA = a.lastUpdated || 0
      const timeB = b.lastUpdated || 0
      return timeB - timeA
    })

    return NextResponse.json({ projects: merged })
  } catch (error: unknown) {
    console.error("Error in sync projects API route:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
