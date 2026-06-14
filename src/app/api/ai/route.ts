/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"

type BrainAnalysis = {
  summary?: string
  entityType?: string
  entityName?: string
  importance?: string
  connections?: string[]
  parentEntityName?: string
  isSubEntity?: boolean
}

type AppearancePromptResult = {
  characterName?: string
  overview?: string
  prompts?: {
    beastForm?: string
    demiHumanForm?: string
    humanForm?: string
  }
  consistencyNotes?: string[]
  negativePrompt?: string
}

type ProgressionAiResponse = {
  targetLoreEntryId?: string
  targetProfileId?: string
  profile?: Record<string, unknown>
  update?: {
    shouldApply?: boolean
    summary?: string
    levelBefore?: number
    levelAfter?: number
    realmBefore?: string
    realmAfter?: string
    stageBefore?: string
    stageAfter?: string
    statChanges?: Record<string, number>
    abilityChanges?: string[]
    rewards?: string[]
    evidence?: string[]
  }
}

type CultivationImportResponse = {
  settings?: {
    realms?: string[]
    stageLabels?: string[]
    showLevels?: boolean
    showExp?: boolean
    showStats?: boolean
    statKeys?: string[]
    customFields?: string[]
    notes?: string
    cultivationSourceText?: string
    cultivationGuide?: string
  }
}

type ProgressionTemplateDesignResponse = {
  settings?: ProgressionTemplateDesignSettings
  profileTemplate?: ProgressionTemplateDesignSettings["profileTemplate"]
  realms?: string[]
  stageLabels?: string[]
  showLevels?: boolean
  showExp?: boolean
  showStats?: boolean
  statKeys?: string[]
  customFields?: string[]
  notes?: string
}

type ProgressionTemplateDesignSettings = {
  realms?: string[]
  stageLabels?: string[]
  showLevels?: boolean
  showExp?: boolean
  showStats?: boolean
  statKeys?: string[]
  customFields?: string[]
  notes?: string
  cultivationSourceText?: string
  cultivationGuide?: string
  profileTemplate?: {
    enabled?: boolean
    name?: string
    defaultRealm?: string
    defaultStage?: string
    defaultRank?: string
    defaultClassName?: string
    defaultCultivationPath?: string
    baseLevel?: number
    baseExp?: number
    nextLevelExp?: number
    defaultStats?: Record<string, number>
    defaultTraits?: string[]
    defaultAbilities?: unknown[]
    defaultCustomFields?: Record<string, string>
    cards?: unknown[]
    notes?: string
  }
}

type BibleConsistencyResponse = {
  conflicts?: Array<{
    entryName?: string
    severity?: "warning" | "critical"
    message?: string
    chapterEvidence?: string
    bibleEvidence?: string
    suggestedFix?: string
  }>
}

type BibleExtractResponse = {
  suggestions?: Array<{
    entryName?: string
    category?: "character" | "world" | "beast" | "place" | "item"
    summary?: string
    contentPatch?: string
    matchedEntryId?: string
    timelineFact?: {
      summary?: string
      evidence?: string
      status?: string
    }
  }>
}

function parseJsonObject<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function buildCultivationGuide(rawText: string, realms: string[], stageLabels: string[]): string {
  const sampleRealms = realms.slice(0, 24).join(" -> ")
  const sampleStages = stageLabels.join(" / ")
  const rawPreview = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 18)
    .join("; ")
  return [
    realms.length > 0 ? `Uploaded cultivation realms, weakest to strongest: ${sampleRealms}${realms.length > 24 ? " -> ..." : ""}.` : "",
    stageLabels.length > 0 ? `Cultivation sub-stages/stage labels: ${sampleStages}.` : "",
    "When a term appears in this cultivation ladder, treat it as cultivation: profile.realm for the major realm and profile.stage for the sub-stage.",
    "Do not store cultivation realms or stages in profile.className. Only use profile.className for explicit jobs/classes/roles such as Warrior, Mage, Necromancer, Hunter, or System Class.",
    rawPreview ? `Uploaded text sample: ${rawPreview.slice(0, 1200)}` : ""
  ].filter(Boolean).join(" ")
}

function parseCultivationSettingsFromText(rawText: string, currentSettings?: unknown): CultivationImportResponse {
  const current = currentSettings && typeof currentSettings === "object"
    ? currentSettings as { stageLabels?: string[]; statKeys?: string[]; customFields?: string[] }
    : {}
  const rawLines = rawText
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*•\d.)]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const knownStageOrder = ["Low", "Medium", "Middle", "High", "Peak", "Early", "Mid", "Late", "Initial", "Perfected", "Half-step"]
  const explicitStageLine = rawLines.find(line => /\b(stage|rank|sub[-\s]?realm|minor realm)\b/i.test(line))
  const parsedStages = explicitStageLine
    ? knownStageOrder.filter(stage => new RegExp(`\\b${stage}\\b`, "i").test(explicitStageLine))
    : []
  const stageLabels = Array.from(new Set((parsedStages.length > 0 ? parsedStages : current.stageLabels || ["Low", "Medium", "High", "Peak"])
    .map(stage => stage === "Middle" || stage === "Mid" ? "Medium" : stage)))

  const splitRealmTokens = rawLines.flatMap(line => {
    const withoutHeading = line.replace(/^(realm|realms|stage|stages|rank|ranks|cultivation|cultivation stages?)\s*[:：-]\s*/i, "")
    return withoutHeading.split(/\s*(?:,|->|→|>|;|\|)\s*/).map(item => item.trim()).filter(Boolean)
  })

  const stageSet = new Set(stageLabels.map(item => item.toLowerCase()))
  const realms = Array.from(new Set(splitRealmTokens
    .map(item => item.replace(/\s*\([^)]*\)\s*/g, "").trim())
    .filter(item => item.length > 1)
    .filter(item => !/^(stage|stages|rank|ranks|realm|realms|weakest|strongest)$/i.test(item))
    .filter(item => !stageSet.has(item.toLowerCase()))))
    .slice(0, 120)
  const cultivationGuide = buildCultivationGuide(rawText, realms, stageLabels)

  return {
    settings: {
      realms,
      stageLabels,
      showLevels: false,
      showExp: false,
      showStats: true,
      statKeys: current.statKeys || ["strength", "agility", "endurance", "vitality", "intelligence", "sense", "mana"],
      customFields: Array.from(new Set([...(current.customFields || []), "Race", "Affiliation"])),
      cultivationSourceText: rawText.slice(0, 20000),
      cultivationGuide,
      notes: `Imported ${realms.length} cultivation realms. Realm names such as Demigod belong in profile.realm; sub-ranks such as Medium belong in profile.stage. Class/job names stay in profile.className.`
    }
  }
}

async function generateWithGroq(systemInstruction: string, userPrompt: string, jsonMode: boolean) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Groq API key is not configured on the server. Please add GROQ_API_KEY to your environment.")
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      temperature: jsonMode ? 0.15 : 0.7,
      max_tokens: jsonMode ? 8192 : 4096,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq API error: ${response.status}`)
  }

  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== "string") {
    throw new Error("Groq returned an empty response.")
  }
  return text
}

function formatMemoryContext(memory: unknown) {
  if (!memory || typeof memory !== "object") return ""

  const safeMemory = memory as {
    projectName?: string
    activeChapter?: { title?: string; chapterNumber?: number } | null
    nearbyChapters?: string[]
    brainEntries?: Array<{
      entityName?: string
      entityType?: string
      importance?: string
      chapterNumber?: number
      summary?: string
      connections?: string[]
    }>
    loreEntries?: Array<{ name?: string; category?: string; content?: string }>
  }

  const lines = [
    safeMemory.projectName ? `Project: ${safeMemory.projectName}` : "",
    safeMemory.activeChapter ? `Active chapter: ${safeMemory.activeChapter.chapterNumber ? `Chapter ${safeMemory.activeChapter.chapterNumber} - ` : ""}${safeMemory.activeChapter.title || "Untitled"}` : "",
    Array.isArray(safeMemory.nearbyChapters) && safeMemory.nearbyChapters.length > 0
      ? `Nearby chapters:\n${safeMemory.nearbyChapters.slice(0, 3).map(item => `- ${item}`).join("\n")}`
      : "",
    Array.isArray(safeMemory.brainEntries) && safeMemory.brainEntries.length > 0
      ? `Brain Map memory:\n${safeMemory.brainEntries.slice(0, 20).map(entry => {
        const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : "Unknown chapter"
        const links = Array.isArray(entry.connections) && entry.connections.length > 0 ? ` Links: ${entry.connections.join("; ")}` : ""
        return `- ${chapter}: ${entry.entityName || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${entry.summary || ""}${links}`
      }).join("\n")}`
      : "",
    Array.isArray(safeMemory.loreEntries) && safeMemory.loreEntries.length > 0
      ? `World Bible:\n${safeMemory.loreEntries.slice(0, 16).map(entry => `- ${entry.name || "Unknown"} (${entry.category || "lore"}): ${entry.content || ""}`).join("\n")}`
      : ""
  ].filter(Boolean)

  return lines.length > 0 ? `\n\nManuscript memory context:\n${lines.join("\n\n")}` : ""
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, content, style, prompt, memory } = body
    const memoryContext = formatMemoryContext(memory)

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 })
    }

    let systemInstruction = ""
    let userPrompt = ""

    if (action === "continue") {
      if (!content) {
        return NextResponse.json({ error: "Content is required for continue action" }, { status: 400 })
      }
      systemInstruction = 
        "You are an expert creative writing partner. The user is writing a story/manuscript. " +
        "Your task is to write a brief continuation of the provided text.\n" +
        "Guidelines:\n" +
        "1. Do NOT repeat any part of the user's text.\n" +
        "2. Adopt the tone, vocabulary, perspective, and narrative style of the provided text.\n" +
        "3. Generate a natural, seamless continuation of about 2 to 4 sentences (approximately 50-80 words).\n" +
        "4. Output ONLY the continuation text. Do not include quotes around it, meta-commentary, intros (like 'Sure, here is more:'), or outros."
      
      userPrompt = `Please continue writing from where this text ends:${memoryContext}\n\nCurrent text:\n${content}`
    } else if (action === "rewrite") {
      if (!content) {
        return NextResponse.json({ error: "Content is required for rewrite action" }, { status: 400 })
      }
      if (!style) {
        return NextResponse.json({ error: "Style/tone is required for rewrite action" }, { status: 400 })
      }

      systemInstruction = 
        "You are a professional editor and prose stylist. The user will provide a passage and a style requirement. " +
        "Your task is to rewrite the passage according to that style while preserving the original core plot/actions.\n" +
        "Guidelines:\n" +
        "1. Output ONLY the rewritten text. Do not wrap it in quotes, and do not include any editorial comments, intros, or explanations.\n" +
        "2. If style is 'descriptive': Enrich the text with vivid sensory details, rich imagery, and show-dont-tell prose.\n" +
        "3. If style is 'dramatic': Intensify the emotional stakes, conflict, and vocabulary.\n" +
        "4. If style is 'suspenseful': Pace the sentences to build tension, anticipation, and mystery.\n" +
        "5. If style is 'poetic': Apply lyrical flow, metaphors, rhythm, and figurative language.\n" +
        "6. If style is 'professional': Elevate the syntax, clarity, and precision of the writing.\n" +
        "7. If style is 'shorten': Condense the passage to its absolute, punchiest essence without losing context.\n" +
        "8. If style is 'expand': Add depth to character thoughts, immediate surroundings, and sensory context."

      userPrompt = `Rewrite the following passage to make it more ${style.toUpperCase()}.${memoryContext}\n\nPassage:\n${content}`
    } else if (action === "outline") {
      if (!prompt) {
        return NextResponse.json({ error: "Prompt is required for outline action" }, { status: 400 })
      }

      systemInstruction = 
        "You are a highly structured story planning assistant. The user will request an outline for a chapter, book, or scene.\n" +
        "Guidelines:\n" +
        "1. Generate a beautifully structured markdown outline.\n" +
        "2. Use appropriate headings (#, ##, ###) and clear bullet points.\n" +
        "3. Include sections such as 'Core Theme/Atmosphere', 'Key Plot Points', 'Character Actions', and 'Setting Notes'.\n" +
        "4. Keep it highly creative, inspiring, and ready for a writer to expand.\n" +
        "5. Output ONLY the raw markdown. No intro or outro chat."

      userPrompt = `Generate a chapter outline based on this concept: ${prompt}${memoryContext}`
    } else if (action === "generate_lore") {
      const { name, category, context } = body
      if (!name) {
        return NextResponse.json({ error: "Name is required for lore generation" }, { status: 400 })
      }
      if (!category) {
        return NextResponse.json({ error: "Category is required for lore generation" }, { status: 400 })
      }

      systemInstruction = 
        "You are an expert creative world builder and character designer. The user will request a bible entry for their story.\n" +
        "Guidelines:\n" +
        "1. Generate a beautifully detailed profile in clean markdown.\n" +
        "2. Make the lore sound interesting, inspiring, and textured.\n" +
        "3. For characters, include sections: 'Overview', 'Appearance', 'Personality & Motives', 'Background', and 'Story Ideas'.\n" +
        "4. For world items/settings, include sections: 'Overview', 'Description', 'History & Origin', 'Significance', and 'Story Hooks'.\n" +
        "5. Output ONLY the raw markdown. No intro or outro comments."

      const contextPrompt = context ? `\nAdditional Context/Description: ${context}` : ""
      userPrompt = `Generate a detailed World Bible profile for a ${category.toUpperCase()} named "${name}".${contextPrompt}`
    } else if (action === "appearance_prompts") {
      const { name, selectedText, forms, chapter, loreEntry } = body
      const safeForms = forms && typeof forms === "object" ? forms as {
        beastForm?: string
        demiHumanForm?: string
        humanForm?: string
      } : {}
      const safeLoreEntry = loreEntry && typeof loreEntry === "object"
        ? loreEntry as { name?: string; category?: string; content?: string; groups?: string[] }
        : null
      const hasDescription = Boolean(
        selectedText ||
        safeForms.beastForm ||
        safeForms.demiHumanForm ||
        safeForms.humanForm ||
        safeLoreEntry?.content
      )

      if (!hasDescription) {
        return NextResponse.json({ error: "At least one appearance description or selected passage is required." }, { status: 400 })
      }

      systemInstruction =
        "You are an expert character concept prompt engineer for novelists and visual artists. " +
        "The user is describing a character, beast, or shapeshifter from a manuscript and wants polished image-generation prompts.\n" +
        "Guidelines:\n" +
        "1. Read the Story Bible entry and active chapter context, then infer the character's visual design from appearance notes, abilities, origin, faction, aura, personality, and scene behavior.\n" +
        "2. Generate separate prompts for beastForm, demiHumanForm, and humanForm. If a form is not applicable, still produce a useful alternate visual interpretation based on the lore and clearly preserve shared identity traits.\n" +
        "3. Include anatomy, silhouette, face, eyes, hair/fur/skin/scales, clothing or armor, aura, pose, lighting, mood, and background when useful.\n" +
        "4. Do not invent unrelated names, factions, or plot details. Use chapter context only to enrich visual accuracy.\n" +
        "5. Output ONLY valid JSON with keys: characterName, overview, prompts, consistencyNotes, negativePrompt. The prompts object must use keys beastForm, demiHumanForm, humanForm. No markdown fences."

      const chapterContext = chapter && typeof chapter === "object"
        ? chapter as { title?: string; chapterNumber?: number; content?: string }
        : null
      const chapterLine = chapterContext
        ? `\nActive Chapter: ${chapterContext.chapterNumber ? `Chapter ${chapterContext.chapterNumber} - ` : ""}${chapterContext.title || "Untitled"}`
        : ""
      const chapterContent = chapterContext?.content ? `\nChapter Context:\n${chapterContext.content}` : ""
      const selectedLine = selectedText ? `\nHighlighted Passage:\n${selectedText}` : ""
      const loreLine = safeLoreEntry
        ? `\nStory Bible Entry:\nName: ${safeLoreEntry.name || name || "Unknown"}\nType: ${safeLoreEntry.category || "unknown"}\nGroups: ${Array.isArray(safeLoreEntry.groups) ? safeLoreEntry.groups.join(", ") : "none"}\nLore Notes:\n${safeLoreEntry.content || ""}`
        : ""

      userPrompt =
        `Character or creature name: ${safeLoreEntry?.name || name || "Unknown / infer from context"}\n` +
        `Preferred visual style: ${style || "cinematic fantasy character concept art"}` +
        `${chapterLine}${selectedLine}${loreLine}\n\n` +
        `Form descriptions:\n` +
        `- Beast form: ${safeForms.beastForm || "Not directly described. Infer from available context."}\n` +
        `- Demi-human form: ${safeForms.demiHumanForm || "Not directly described. Infer from available context."}\n` +
        `- Human form: ${safeForms.humanForm || "Not directly described. Infer from available context."}` +
        `${chapterContent}${memoryContext}`
    } else if (action === "progression_update") {
      const { selectedText, loreEntry, chapter, existingProfile, progressionSystem, candidateProfiles, candidateLoreEntries } = body
      const safeLoreEntry = loreEntry && typeof loreEntry === "object"
        ? loreEntry as { id?: string; name?: string; category?: string; content?: string; groups?: string[] }
        : null
      const chapterContext = chapter && typeof chapter === "object"
        ? chapter as { id?: string; title?: string; chapterNumber?: number; content?: string; targetEvidence?: string }
        : null

      if (!chapterContext?.content || (!safeLoreEntry?.name && !Array.isArray(candidateProfiles))) {
        return NextResponse.json({ error: "A Story Bible entry or candidate profiles and chapter content are required for progression_update." }, { status: 400 })
      }

      const useCustomJsonTemplate = (progressionSystem as any)?.useCustomJsonTemplate === true
      const customJsonTemplate = (progressionSystem as any)?.customJsonTemplate || ""
      let customJsonTemplateStr = ""
      if (useCustomJsonTemplate && customJsonTemplate) {
        try {
          JSON.parse(customJsonTemplate)
          customJsonTemplateStr = customJsonTemplate
        } catch (e) {
          console.error("Invalid customJsonTemplate in progressionSystem:", e)
        }
      }

      let customJsonInstruction = ""
      if (customJsonTemplateStr) {
        customJsonInstruction = `\n15. CRITICAL: The user has enabled a custom JSON status template. The returned 'profile' object MUST contain a 'customJsonData' property. This 'customJsonData' property MUST be a valid JSON object matching the exact structure, keys, nesting, and value types of this template:\n${customJsonTemplateStr}\nAnalyze the chapter and fill in the values for the keys inside 'customJsonData' based on the chapter details. Preserve any existing values from the candidate/existing profile when no new details are found in the chapter.`
      }

      systemInstruction =
        "You are a web-novel character progression tracker for a novelist. " +
        "The writer wants a simple profile that can be refreshed whenever a chapter or chapters are scanned.\n" +
        "Guidelines:\n" +
        "1. Use the Story Bible entry, current chapter, target-specific chapter evidence, existing profile, and candidate profiles to create or update exactly one character profile.\n" +
        "2. If an explicit Story Bible entry is provided, that entry is the only target. Do not copy cultivation, powers, titles, bloodlines, skills, or lore from nearby characters. If no explicit Story Bible entry is provided, select the best candidate profile/lore entry based on names, aliases, actions, viewpoint, and progression evidence in the chapter.\n" +
        "3. Read in this order: target-specific evidence first, Story Bible notes second, full chapter third, existing profile last for preservation. Do not stop after the first mention; scan the full chapter for later corrections, reveals, awakenings, status screens, dialogue labels, and narration.\n" +
        "4. The profile schema includes: name, title, additional titles, cultivation realm (profile.realm), cultivation stage/sub-rank (profile.stage), rank (profile.rank), bloodline name, bloodline rank, affinity names/ranks, main class, secondary class or extra classes, weapons, skills, and lore.\n" +
        "5. Put the character's main class/job/role in profile.className only when the text explicitly presents it as a class, job, occupation, system class, or combat role. If the chapter gives a second class, subclass, job, or secondary role, put it in profile.customFields['Secondary Class']; if there are more classes, use distinct custom fields such as profile.customFields['Class 2'], profile.customFields['Class 3'], and matching rank fields when known. Put extra titles beyond profile.title in custom fields such as profile.customFields['Title 2']. Put weapons or equipment in custom fields such as profile.customFields['Weapon'] or profile.customFields['Weapon 2']. Do not put classes, titles, or weapons in abilities or lore unless the chapter explicitly says they are skills/techniques.\n" +
        "6. Put the bloodline name in profile.customFields['Bloodline'] and its rank/grade/tier/quality such as Supreme or Celestial in profile.customFields['Bloodline Rank']. Do not put bloodlines in affinities or skills.\n" +
        "7. Put affinity names in profile.customFields['Affinity Names'] as a comma-separated list, such as Fire, Ice, Void. Put paired affinity ranks in profile.customFields['Affinity Rank'], such as Fire (High), Ice (Celestial), Void (Supreme). Preserve pairings when multiple affinities have different ranks. Do not put affinities in bloodline or class.\n" +
        "8. Put the character's cultivation realm (such as Demigod, God) in profile.realm. Put their cultivation stage/sub-rank (such as Low, Medium, High, Peak) in profile.stage. If the system uses a non-cultivation rank (or if realm is not applicable), put it in profile.rank. Use the Configured Cultivation Realms, Configured Stage Labels, and Uploaded Cultivation Guide when available to match and normalize these values. Any term that appears in the uploaded cultivation ladder is cultivation, not className, unless the chapter explicitly says it is a class/job. Be extremely smart and precise to pick up on even the smallest error or detail in character growth and cultivation advancements.\n" +
        "9. Put skills, techniques, powers, spells, and signature abilities in profile.abilities. Each ability must include name, rank if known, level set to 1 when no number is stated, description, and evidence when available. Do not turn class names, bloodlines, or affinities into skills unless the chapter explicitly calls them skills/techniques.\n" +
        "10. Put one interesting reusable lore note in profile.notes: something said about the character that may matter later, such as reputation, prophecy, rumor, weakness, relationship, hidden identity, origin, temperament, or an unusual detail. Lore is not a dump of all stats.\n" +
        "11. Preserve existing values when the current chapter gives no direct evidence. If the chapter has no meaningful progression or new character detail, keep the profile stable and set update.shouldApply to false. Still summarize that it was reviewed.\n" +
        "12. Never double-count previous profile history. Use the existing profile and processed chapter history as current truth.\n" +
        "13. In update.evidence, include short exact snippets that justify every changed card field, especially class, secondary class, cultivation realm (realm), stage, bloodline, bloodline rank, affinity names, affinity rank, and skills.\n" +
        "14. Output ONLY valid JSON with keys: targetLoreEntryId, targetProfileId, profile, and update. No markdown fences. profile must include name, title, className, rank, realm, stage, abilities, customFields, notes, level, exp, nextLevelExp, stats, traits, nicknames, uniqueTrait, cultivationPath, and optionally customJsonData. customFields must include Bloodline, Bloodline Rank, Affinity Names, Affinity Rank, Secondary Class, and any observed extra title/class/weapon fields. update must include shouldApply, summary, levelBefore, levelAfter, realmBefore, realmAfter, stageBefore, stageAfter, statChanges, abilityChanges, rewards, and evidence." +
        customJsonInstruction

      const existing = existingProfile ? `\nExisting Profile JSON:\n${JSON.stringify(existingProfile).slice(0, 5000)}` : "\nExisting Profile JSON:\nNone yet."
      const configuredRealms = Array.isArray((progressionSystem as { realms?: unknown[] } | undefined)?.realms)
        ? (progressionSystem as { realms?: unknown[] }).realms?.map(item => String(item)).filter(Boolean).join(" -> ")
        : ""
      const configuredStages = Array.isArray((progressionSystem as { stageLabels?: unknown[] } | undefined)?.stageLabels)
        ? (progressionSystem as { stageLabels?: unknown[] }).stageLabels?.map(item => String(item)).filter(Boolean).join(" / ")
        : ""
      const cultivationGuide = typeof (progressionSystem as { cultivationGuide?: unknown } | undefined)?.cultivationGuide === "string"
        ? String((progressionSystem as { cultivationGuide?: unknown }).cultivationGuide).slice(0, 3000)
        : ""
      const cultivationSourceText = typeof (progressionSystem as { cultivationSourceText?: unknown } | undefined)?.cultivationSourceText === "string"
        ? String((progressionSystem as { cultivationSourceText?: unknown }).cultivationSourceText).slice(0, 5000)
        : ""
      const groups = Array.isArray(safeLoreEntry?.groups) && safeLoreEntry.groups.length > 0 ? safeLoreEntry.groups.join(", ") : "none"
      const explicitTarget = safeLoreEntry?.name
        ? `Target: ${safeLoreEntry.name}\nTarget lore id: ${safeLoreEntry.id || ""}\nHighlighted text: ${selectedText || ""}\nType: ${safeLoreEntry.category || "character"}\nGroups: ${groups}\nStory Bible Notes:\n${safeLoreEntry.content || ""}\n\n`
        : "Target: Auto-detect from candidate profiles and chapter content.\n"

      let customJsonPrompt = ""
      if (customJsonTemplateStr) {
        customJsonPrompt = `Custom JSON Template Fields Required:\n- Fill in the values for the custom JSON template inside 'profile.customJsonData':\n${customJsonTemplateStr}\nEnsure you match the structure and key names exactly.\n\n`
      }

      userPrompt =
        explicitTarget +
        `Simple Profile Fields Required:\n` +
        `- Name\n- Title\n- Cultivation Realm (profile.realm; e.g. Demigod, God; match against the configured cultivation realms list when possible)\n- Cultivation Stage (profile.stage; e.g. Low, Medium, High, Peak; match against the configured stage labels when possible)\n- Rank (profile.rank; e.g. Tier 1, Rank 4)\n- Bloodline (profile.customFields.Bloodline)\n- Bloodline Rank (profile.customFields['Bloodline Rank']; examples: Supreme, Celestial)\n- Affinity Names (profile.customFields['Affinity Names']; comma-separated for multiple affinities)\n- Affinity Rank (profile.customFields['Affinity Rank']; preserve pairings like Fire (High), Void (Supreme))\n- Main Class (profile.className)\n- Secondary Class (profile.customFields['Secondary Class'])\n- Skills (profile.abilities)\n- Lore (profile.notes)\n\n` +
        customJsonPrompt +
        `Extraction Checklist:\n` +
        `1. Identify only the target character.\n` +
        `2. Search target evidence and full chapter for explicit status-like details.\n` +
        `3. Fill exact fields: Bloodline != Affinity != Class != Skills.\n` +
        `4. Keep existing values when no new evidence appears.\n` +
        `5. Put supporting snippets in update.evidence.\n\n` +
        `Configured Cultivation Realms, weakest to strongest:\n${configuredRealms || "No realm ladder uploaded."}\nConfigured Stage Labels:\n${configuredStages || "Low / Medium / High / Peak"}\n\n` +
        `Uploaded Cultivation Guide:\n${cultivationGuide || "No uploaded cultivation guide saved."}\n\n` +
        `Uploaded Cultivation Source Text:\n${cultivationSourceText || "No cultivation source text saved."}\n\n` +
        `Class vs Cultivation Decision Rules:\n- If a term is in the uploaded realm ladder, place it in profile.realm.\n- If a term is in the uploaded stage labels, place it in profile.stage.\n- Only place a term in profile.className when the chapter labels it as class, job, profession, role, or system class.\n- If the status screen has both Class and Cultivation, fill both separately and never copy one into the other.\n\n` +
        `Candidate Profiles JSON:\n${JSON.stringify(Array.isArray(candidateProfiles) ? candidateProfiles : []).slice(0, 6000)}\n\n` +
        `Candidate Lore Entries JSON:\n${JSON.stringify(Array.isArray(candidateLoreEntries) ? candidateLoreEntries : []).slice(0, 8000)}\n\n` +
        `Active Chapter: ${chapterContext.chapterNumber ? `Chapter ${chapterContext.chapterNumber} - ` : ""}${chapterContext.title || "Untitled"}\n` +
        `Target-Specific Chapter Evidence:\n${chapterContext.targetEvidence || "No target-specific excerpt found. Use the full chapter carefully and only update the target."}\n\n` +
        `Chapter Content:\n${chapterContext.content}${existing}${memoryContext}`
    } else if (action === "cultivation_realm_import") {
      const { rawText, currentSettings } = body
      if (!rawText || typeof rawText !== "string") {
        return NextResponse.json({ error: "rawText is required for cultivation_realm_import." }, { status: 400 })
      }

      systemInstruction =
        "You organize cultivation, realm, rank, and progression-stage lists for web novel writing tools. " +
        "The writer uploaded plain text that may contain messy headings, numbering, notes, duplicate stages, or mixed realm/stage terms.\n" +
        "Return ONLY valid JSON with key settings. settings must include realms, stageLabels, showLevels, showExp, showStats, statKeys, customFields, notes, and cultivationGuide.\n" +
        "Realms should be ordered weakest to strongest. stageLabels should include repeated sub-stages such as Low, Middle, High, Peak when present. " +
        "If the text is cultivation-focused, set showLevels and showExp to false unless numeric levels are clearly part of the system. Keep useful custom fields like Sect, Bloodline, Race, Affiliation, Dao, Core, Physique, or Legion. " +
        "cultivationGuide must explain that uploaded realm/stage terms belong in profile.realm/profile.stage and must not be confused with profile.className."

      userPrompt =
        `Current settings JSON:\n${JSON.stringify(currentSettings || {}).slice(0, 4000)}\n\n` +
        `Uploaded progression text:\n${rawText.slice(0, 12000)}`
    } else if (action === "brain_analyze") {
      const { highlightedText, chapterContent, chapterTitle, chapterNumber, existingBrainEntries } = body
      if (!highlightedText || !chapterContent) {
        return NextResponse.json({ error: "highlightedText and chapterContent are required for brain_analyze" }, { status: 400 })
      }

      systemInstruction = 
        "You are a sharp story analyst and creative writing memory assistant. The user is writing a novel/manuscript. " +
        "They highlighted a specific word, name, phrase, or element from their chapter and want to remember its significance.\n" +
        "Your task:\n" +
        "1. Read the chapter content provided and identify what the highlighted element refers to.\n" +
        "2. Write a detailed and visually premium summary. If the element refers to groups, factions, teams, relationships, or multiple items being formed/changed (e.g., team setups, member listings, alliances, rivalries), do NOT just say 'teams were formed' or summarize it in a plain sentence. Instead, write a highly structured markdown section: use bold titles, bullet points to list the teams and their members (with their roles/alignments), or tables to represent structured data. Use markdown formatting to make the structure clear, readable, and immediately scanning-friendly so the writer knows exactly who belongs to what or what was formed at a single glance. Keep it concise but structurally rich.\n" +
        "3. Classify the element as one of: character, place, object, concept, event, foreshadowing, unknown.\n" +
        "4. Choose an importance value: minor, major, or critical.\n" +
        "5. Compare against existing Brain Map entries and list up to 3 meaningful recurring connections.\n" +
        "6. Analyze if the highlighted entity is located inside, belongs to, is part of, or is a member of any of the existing Brain Map entries (e.g. a room/cave/street inside a city/world, a person/member inside a harem/sect/faction/group, a member of a team/squad). If a parent entity exists in the list, set `isSubEntity` to true and set `parentEntityName` to the exact `entityName` of that parent entity from the list. If no parent entity exists, set `isSubEntity` to false and `parentEntityName` to empty string.\n" +
        "7. Output ONLY valid JSON with keys: summary, entityType, entityName, importance, connections, parentEntityName, isSubEntity. No markdown fences."

      const parsedChapterNumber = Number(chapterNumber)
      const numberContext = chapterNumber !== null && chapterNumber !== undefined && Number.isFinite(parsedChapterNumber) && parsedChapterNumber > 0
        ? `\nChapter Number: ${parsedChapterNumber}`
        : ""
      const titleContext = chapterTitle ? `\nChapter Title: "${chapterTitle}"` : ""
      const existingContext = Array.isArray(existingBrainEntries) && existingBrainEntries.length > 0
        ? `\n\nExisting Brain Map entries:\n${existingBrainEntries.slice(0, 50).map((entry: {
          highlightedText?: string
          aiSummary?: string
          chapterTitle?: string
          chapterNumber?: number
          entityType?: string
          entityName?: string
          importance?: string
        }) => {
          const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Unknown chapter"
          return `- ${chapter}: ${entry.entityName || entry.highlightedText || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${entry.aiSummary || ""}`
        }).join("\n")}`
        : ""
      userPrompt = `The writer highlighted: "${highlightedText}"${numberContext}${titleContext}\n\nFull chapter content:\n${chapterContent}${existingContext}`
    } else if (action === "brain_ask") {
      const { question, brainEntries } = body
      if (!question || !Array.isArray(brainEntries)) {
        return NextResponse.json({ error: "question and brainEntries are required for brain_ask" }, { status: 400 })
      }

      systemInstruction =
        "You are a manuscript memory assistant. Answer questions using only the provided Brain Map entries.\n" +
        "Guidelines:\n" +
        "1. Be direct and useful for a novelist checking continuity.\n" +
        "2. Mention chapter numbers or titles when available.\n" +
        "3. If the answer is not in the Brain Map, say that clearly and suggest what entry would help.\n" +
        "4. Output concise, beautiful markdown (using lists, bold accents, or tables where appropriate to represent groups, squads, or lists of details). No intro or outro."

      const memory = brainEntries.slice(0, 120).map((entry: {
        highlightedText?: string
        aiSummary?: string
        chapterTitle?: string
        chapterNumber?: number
        entityType?: string
        entityName?: string
        importance?: string
        connections?: string[]
      }) => {
        const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Unknown chapter"
        const connections = Array.isArray(entry.connections) && entry.connections.length > 0
          ? ` Connections: ${entry.connections.join("; ")}`
          : ""
        return `- ${chapter}: ${entry.entityName || entry.highlightedText || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${entry.aiSummary || ""}${connections}`
      }).join("\n")

      userPrompt = `Brain Map entries:\n${memory || "No entries yet."}\n\nQuestion: ${question}`
    } else if (action === "progression_template_design") {
      const { prompt, currentSettings } = body
      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Prompt is required for progression_template_design." }, { status: 400 })
      }

      systemInstruction =
        "You are a professional LitRPG, xianxia, and web-novel progression system designer.\n" +
        "The user is describing their novel's character status screen / progression structure (e.g. realms, stats, affinities, levels, class, rank).\n" +
        "Your task is to generate a comprehensive profile template matching their requirements.\n" +
        "Return ONLY valid JSON with key settings. settings must include realms, stageLabels, showLevels, showExp, showStats, statKeys, customFields, notes, and profileTemplate.\n" +
        "profileTemplate must contain: enabled (true), name, defaultRealm, defaultStage, defaultRank, defaultClassName, defaultCultivationPath, baseLevel, baseExp, nextLevelExp, defaultStats, defaultTraits, defaultAbilities, defaultCustomFields, cards, and notes.\n" +
        "Each card in profileTemplate.cards must have id (starts with 'template-'), label, type ('text' | 'rank' | 'progress' | 'resource' | 'stat' | 'ability' | 'compound' | 'counter'), sourceKey (the variable name like 'name', 'cultivation', 'abilities', 'exp', or a custom field name like 'Affinity'), fields (array of sub-field names displayed in the card), color (rose, violet, cyan, amber, emerald, blue, fuchsia, or lime), and enabled (true).\n" +
        "Use type 'progress' for values like EXP that render as current/max timelines, with values such as 120/300. Use type 'counter' for simple numeric counters such as Level Ups or available points.\n" +
        "Ensure all requested categories (like Name, Cultivation, Levels, Attributes, Affinity/Element, Titles, Classes, and Weapons) are mapped to appropriate template cards. For attributes, create a 'stat' or 'compound' card and ensure the used stats are in settings.statKeys and set defaults in profileTemplate.defaultStats. For elemental affinity or bloodline cards, create a compound card with companion fields for ranks/grades, such as ['Affinity Names', 'Rank'] (card name: 'Affinity') or ['Bloodline', 'Bloodline Grade'], and include those fields in settings.customFields. When the user wants more than one title, class, or weapon, create separate compound cards with distinct custom field names such as ['Title 2', 'Title 2 Effect'], ['Class 2', 'Class 2 Rank'], or ['Weapon', 'Weapon Grade', 'Weapon Status']; include those fields in settings.customFields. Always include all non-direct card source fields and fields in settings.customFields."

      userPrompt =
        `Current settings JSON:\n${JSON.stringify(currentSettings || {}).slice(0, 4000)}\n\n` +
        `User Prompt for Template Design:\n${prompt}`
    } else if (action === "brain_consistency_check") {
      const { chapterContent, chapterTitle, existingBrainEntries } = body
      if (!chapterContent) {
        return NextResponse.json({ error: "chapterContent is required for brain_consistency_check" }, { status: 400 })
      }

      systemInstruction =
        "You are an expert story editor and continuity supervisor. The user is writing a novel.\n" +
        "You are given the draft of the active chapter and the existing Brain Map lore entries.\n" +
        "Your task is to analyze the draft against the Brain Map to identify any plot holes, lore contradictions, or character status issues.\n" +
        "Compare details such as: character physical features, character locations, whether characters are alive/dead, magical powers, item ownership, and history.\n" +
        "Output ONLY a valid JSON object with keys:\n" +
        "- conflicts: an array of objects, each containing:\n" +
        "  - entityName: the name of the entity involved\n" +
        "  - severity: 'warning' or 'critical'\n" +
        "  - message: a concise description of the contradiction, citing the conflict between the chapter and the Brain Map.\n" +
        "If there are no conflicts, the conflicts array must be empty. Do not include markdown formatting or backticks around the JSON."

      const titleContext = chapterTitle ? `\nChapter Title: "${chapterTitle}"` : ""
      const existingContext = Array.isArray(existingBrainEntries) && existingBrainEntries.length > 0
        ? `\n\nExisting Brain Map entries:\n${existingBrainEntries.slice(0, 100).map((entry: any) => {
            const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Unknown chapter"
            return `- ${chapter}: ${entry.entityName || entry.highlightedText || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${entry.aiSummary || ""}`
          }).join("\n")}`
        : ""
      userPrompt = `Active Chapter Draft:${titleContext}\n\n${chapterContent}${existingContext}`
    } else if (action === "brain_suggest_additions") {
      const { chapterContent, existingBrainEntries } = body
      if (!chapterContent) {
        return NextResponse.json({ error: "chapterContent is required for brain_suggest_additions" }, { status: 400 })
      }

      systemInstruction =
        "You are a helpful creative writing assistant. Scan the provided chapter text and extract up to 5 key names, items, places, concepts, or events " +
        "that are NOT already tracked in the existing Brain Map entries list.\n" +
        "For each suggestion, provide a name, class classification, importance, and brief context recap from the chapter.\n" +
        "Output ONLY a JSON object with key:\n" +
        "- suggestions: an array of objects, each containing:\n" +
        "  - entityName: name of the entity (e.g. 'Arthur')\n" +
        "  - entityType: one of 'character', 'place', 'object', 'concept', 'event', 'foreshadowing'\n" +
        "  - importance: one of 'minor', 'major', 'critical'\n" +
        "  - aiSummary: a concise 1-2 sentence recap explaining what it is based on the chapter content.\n" +
        "Do not include markdown formatting or backticks around the JSON."

      const existingContext = Array.isArray(existingBrainEntries) && existingBrainEntries.length > 0
        ? `\n\nExisting tracked Brain Map entities:\n${existingBrainEntries.map((e: any) => e.entityName || e.highlightedText).filter(Boolean).slice(0, 100).join(", ")}`
        : ""
      userPrompt = `Chapter Content:\n${chapterContent}${existingContext}`
    } else if (action === "brain_generate_dossier") {
      const { entityName, entityType, brainEntries } = body
      if (!entityName || !Array.isArray(brainEntries)) {
        return NextResponse.json({ error: "entityName and brainEntries are required for brain_generate_dossier" }, { status: 400 })
      }

      systemInstruction =
        "You are a professional story coordinator. Analyze all the provided Brain Map mentions for the entity \"" + entityName + "\" (" + (entityType || "unknown") + ").\n" +
        "Synthesize them into a single, cohesive, premium markdown dossier summary.\n" +
        "Structure it with sections such as Description, Key Mentions, and Relationships/Significance (use rich markdown tables and lists to summarize teams/factions they belong to and their interaction dynamics).\n" +
        "Be concise, creative, and professional. Output ONLY valid JSON with keys:\n" +
        "- dossierText: the compiled markdown dossier biography.\n" +
        "Do not include markdown formatting or backticks around the JSON."

      const mentions = brainEntries.map((entry: any) => {
        const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Unknown chapter"
        return `- ${chapter}: ${entry.highlightedText} - ${entry.aiSummary}`
      }).join("\n")
      userPrompt = `Entity Name: ${entityName}\nEntity Type: ${entityType}\n\nMentions across chapters:\n${mentions}`
    } else if (action === "bible_consistency_check") {
      const { chapterContent, chapterTitle, chapterNumber, bibleEntries } = body
      if (!chapterContent || !Array.isArray(bibleEntries)) {
        return NextResponse.json({ error: "chapterContent and bibleEntries are required for bible_consistency_check" }, { status: 400 })
      }

      systemInstruction =
        "You are a senior canon continuity editor for a novelist. Compare the active chapter against the Story Bible.\n" +
        "Use both entry notes and timeline facts. Timeline facts are chapter-specific canon, so respect their chapter order when judging whether a change is a contradiction or a legitimate later update.\n" +
        "Flag contradictions in identity, physical traits, aliases, faction membership, location, item ownership, relationship status, death/alive status, cultivation/class/status details, rules of magic, and timeline order.\n" +
        "Do not flag a change if the chapter explicitly explains the change. Output ONLY valid JSON with key conflicts.\n" +
        "Each conflict must include entryName, severity ('warning' or 'critical'), message, chapterEvidence, bibleEvidence, and suggestedFix."

      const bibleContext = bibleEntries.slice(0, 120).map((entry: any) => {
        const facts = Array.isArray(entry.timelineFacts)
          ? entry.timelineFacts.slice(-12).map((fact: any) => {
            const chapter = fact.chapterNumber ? `Chapter ${fact.chapterNumber}` : fact.chapterTitle || "Unknown chapter"
            return `  - ${chapter}: ${fact.summary || ""}${fact.evidence ? ` Evidence: ${fact.evidence}` : ""}`
          }).join("\n")
          : ""
        return `- ${entry.name || "Untitled"} (${entry.category || "world"})\nNotes: ${String(entry.content || "").slice(0, 1600)}\nTimeline:\n${facts || "  - none"}`
      }).join("\n\n")

      userPrompt =
        `Active Chapter: ${chapterNumber ? `Chapter ${chapterNumber} - ` : ""}${chapterTitle || "Untitled"}\n\n` +
        `Chapter Content:\n${String(chapterContent).slice(0, 60000)}\n\n` +
        `Story Bible Canon:\n${bibleContext || "No Story Bible entries yet."}`
    } else if (action === "bible_extract_from_chapter") {
      const { chapterContent, chapterTitle, chapterNumber, bibleEntries } = body
      if (!chapterContent || !Array.isArray(bibleEntries)) {
        return NextResponse.json({ error: "chapterContent and bibleEntries are required for bible_extract_from_chapter" }, { status: 400 })
      }

      systemInstruction =
        "You are a meticulous Story Bible curator for a novelist. Scan the active chapter and propose high-value canon additions.\n" +
        "Prefer facts that should be remembered later: new characters, beasts, factions, locations, artifacts, vows, relationships, status reveals, rules, secrets, deaths, promotions, and chapter-specific changes.\n" +
        "Match existing Story Bible entries by exact name or obvious alias when possible. For matched entries, provide matchedEntryId and a concise contentPatch to append. For new entries, provide category and starter notes.\n" +
        "Every suggestion must include a timelineFact with summary, evidence, and optional status. Output ONLY valid JSON with key suggestions. Limit to 8 suggestions."

      const existingContext = bibleEntries.slice(0, 120).map((entry: any) => {
        const facts = Array.isArray(entry.timelineFacts)
          ? entry.timelineFacts.slice(-8).map((fact: any) => `${fact.chapterNumber ? `Ch ${fact.chapterNumber}` : fact.chapterTitle || "Chapter"}: ${fact.summary || ""}`).join("; ")
          : ""
        return `- id=${entry.id}; name=${entry.name}; category=${entry.category}; notes=${String(entry.content || "").slice(0, 800)}; timeline=${facts}`
      }).join("\n")

      userPrompt =
        `Active Chapter: ${chapterNumber ? `Chapter ${chapterNumber} - ` : ""}${chapterTitle || "Untitled"}\n\n` +
        `Existing Story Bible Entries:\n${existingContext || "No Story Bible entries yet."}\n\n` +
        `Chapter Content:\n${String(chapterContent).slice(0, 60000)}`
    } else {
      return NextResponse.json({ error: "Invalid action. Must be continue, rewrite, outline, generate_lore, appearance_prompts, progression_update, cultivation_realm_import, brain_analyze, brain_ask, brain_consistency_check, brain_suggest_additions, brain_generate_dossier, bible_consistency_check, bible_extract_from_chapter, or progression_template_design." }, { status: 400 })
    }

    const jsonActions = new Set([
      "appearance_prompts",
      "progression_update",
      "cultivation_realm_import",
      "brain_analyze",
      "progression_template_design",
      "brain_consistency_check",
      "brain_suggest_additions",
      "brain_generate_dossier",
      "bible_consistency_check",
      "bible_extract_from_chapter"
    ])
    let text = ""
    if (action === "cultivation_realm_import" && !process.env.GROQ_API_KEY) {
      text = JSON.stringify({ settings: parseCultivationSettingsFromText(body.rawText, body.currentSettings).settings })
    } else {
      text = await generateWithGroq(systemInstruction, userPrompt, jsonActions.has(action))
    }

    if (action === "brain_consistency_check") {
      const result = parseJsonObject<any>(text)
      return NextResponse.json({
        conflicts: result?.conflicts || []
      })
    }

    if (action === "brain_suggest_additions") {
      const result = parseJsonObject<any>(text)
      return NextResponse.json({
        suggestions: result?.suggestions || []
      })
    }

    if (action === "brain_generate_dossier") {
      const result = parseJsonObject<any>(text)
      return NextResponse.json({
        dossierText: result?.dossierText || "Failed to generate dossier."
      })
    }

    if (action === "brain_analyze") {
      const analysis = parseJsonObject<BrainAnalysis>(text)
      const allowedTypes = new Set(["character", "place", "object", "concept", "event", "foreshadowing", "unknown"])
      const allowedImportance = new Set(["minor", "major", "critical"])

      if (!analysis) {
        return NextResponse.json({ text })
      }

      const entityType = allowedTypes.has(String(analysis.entityType)) ? analysis.entityType : "unknown"
      const importance = allowedImportance.has(String(analysis.importance)) ? analysis.importance : "minor"
      const connections = Array.isArray(analysis.connections)
        ? analysis.connections.filter(item => typeof item === "string").slice(0, 3)
        : []

      return NextResponse.json({
        text: analysis.summary || text,
        entityType,
        entityName: analysis.entityName || "",
        importance,
        connections,
        parentEntityName: analysis.parentEntityName || "",
        isSubEntity: analysis.isSubEntity || false
      })
    }

    if (action === "appearance_prompts") {
      const appearance = parseJsonObject<AppearancePromptResult>(text)
      if (!appearance) {
        return NextResponse.json({
          appearancePrompts: {
            overview: "",
            prompts: {
              beastForm: text,
              demiHumanForm: "",
              humanForm: ""
            },
            consistencyNotes: [],
            negativePrompt: ""
          }
        })
      }

      return NextResponse.json({
        appearancePrompts: {
          characterName: appearance.characterName || "",
          overview: appearance.overview || "",
          prompts: {
            beastForm: appearance.prompts?.beastForm || "",
            demiHumanForm: appearance.prompts?.demiHumanForm || "",
            humanForm: appearance.prompts?.humanForm || ""
          },
          consistencyNotes: Array.isArray(appearance.consistencyNotes)
            ? appearance.consistencyNotes.filter(item => typeof item === "string").slice(0, 6)
            : [],
          negativePrompt: appearance.negativePrompt || ""
        }
      })
    }

    if (action === "progression_update") {
      const progression = parseJsonObject<ProgressionAiResponse>(text)
      if (!progression) {
        return NextResponse.json({
          progression: {
            targetLoreEntryId: "",
            targetProfileId: "",
            profile: {
              notes: text
            },
            update: {
              shouldApply: false,
              summary: "Could not parse a structured progression update.",
              levelBefore: 1,
              levelAfter: 1,
              realmBefore: "",
              realmAfter: "",
              stageBefore: "",
              stageAfter: "",
              statChanges: {},
              abilityChanges: [],
              rewards: [],
              evidence: []
            }
          }
        })
      }

      return NextResponse.json({
        progression: {
          targetLoreEntryId: progression.targetLoreEntryId || "",
          targetProfileId: progression.targetProfileId || "",
          profile: progression.profile || {},
          update: {
            shouldApply: progression.update?.shouldApply !== false,
            summary: progression.update?.summary || "Progression reviewed.",
            levelBefore: Number(progression.update?.levelBefore || 1),
            levelAfter: Number(progression.update?.levelAfter || progression.update?.levelBefore || 1),
            realmBefore: progression.update?.realmBefore || "",
            realmAfter: progression.update?.realmAfter || "",
            stageBefore: progression.update?.stageBefore || "",
            stageAfter: progression.update?.stageAfter || "",
            statChanges: progression.update?.statChanges || {},
            abilityChanges: Array.isArray(progression.update?.abilityChanges) ? progression.update.abilityChanges : [],
            rewards: Array.isArray(progression.update?.rewards) ? progression.update.rewards : [],
            evidence: Array.isArray(progression.update?.evidence) ? progression.update.evidence : []
          }
        }
      })
    }

    if (action === "cultivation_realm_import") {
      const imported = parseJsonObject<CultivationImportResponse>(text)
      const fallback = parseCultivationSettingsFromText(body.rawText, body.currentSettings)
      if (!imported) {
        return NextResponse.json({ imported: fallback })
      }
      const settings = imported.settings && Array.isArray(imported.settings.realms) && imported.settings.realms.length > 0
        ? {
          ...fallback.settings,
          ...imported.settings,
          cultivationSourceText: String(body.rawText || "").slice(0, 20000),
          cultivationGuide: imported.settings.cultivationGuide || fallback.settings?.cultivationGuide || "",
          notes: imported.settings.notes || fallback.settings?.notes || ""
        }
        : fallback.settings

      return NextResponse.json({
        imported: {
          settings
        }
      })
    }

    if (action === "progression_template_design") {
      const design = parseJsonObject<ProgressionTemplateDesignResponse>(text)
      const settings = design?.settings || (design?.profileTemplate ? {
        realms: design.realms,
        stageLabels: design.stageLabels,
        showLevels: design.showLevels,
        showExp: design.showExp,
        showStats: design.showStats,
        statKeys: design.statKeys,
        customFields: design.customFields,
        notes: design.notes,
        profileTemplate: design.profileTemplate
      } : null)
      if (!settings?.profileTemplate || !Array.isArray(settings.profileTemplate.cards) || settings.profileTemplate.cards.length === 0) {
        return NextResponse.json({ error: "Could not parse a complete profile template from the AI response. Please include the cards you want in the prompt." }, { status: 500 })
      }
      return NextResponse.json({
        imported: {
          settings
        }
      })
    }

    if (action === "bible_consistency_check") {
      const result = parseJsonObject<BibleConsistencyResponse>(text)
      return NextResponse.json({
        conflicts: Array.isArray(result?.conflicts)
          ? result.conflicts.map(conflict => ({
            entryName: String(conflict.entryName || "Unknown"),
            severity: conflict.severity === "critical" ? "critical" : "warning",
            message: String(conflict.message || ""),
            chapterEvidence: String(conflict.chapterEvidence || ""),
            bibleEvidence: String(conflict.bibleEvidence || ""),
            suggestedFix: String(conflict.suggestedFix || "")
          })).filter(conflict => conflict.message)
          : []
      })
    }

    if (action === "bible_extract_from_chapter") {
      const result = parseJsonObject<BibleExtractResponse>(text)
      return NextResponse.json({
        suggestions: Array.isArray(result?.suggestions)
          ? result.suggestions.map(suggestion => ({
            entryName: String(suggestion.entryName || "").trim(),
            category: ["character", "world", "beast", "place", "item"].includes(String(suggestion.category))
              ? suggestion.category
              : "world",
            summary: String(suggestion.summary || "").trim(),
            contentPatch: String(suggestion.contentPatch || suggestion.summary || "").trim(),
            matchedEntryId: String(suggestion.matchedEntryId || "").trim(),
            timelineFact: {
              summary: String(suggestion.timelineFact?.summary || suggestion.summary || "").trim(),
              evidence: String(suggestion.timelineFact?.evidence || "").trim(),
              status: String(suggestion.timelineFact?.status || "").trim()
            }
          })).filter(suggestion => suggestion.entryName && suggestion.summary)
          : []
      })
    }

    return NextResponse.json({ text })
  } catch (error: unknown) {
    console.error("Groq API error:", error)
    const message = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: `AI Generation failed: ${message}` }, { status: 500 })
  }
}
