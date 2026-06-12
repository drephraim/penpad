/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/components/Providers"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState, useEffect, useCallback, Suspense, useRef, useMemo } from "react"
import { 
  Plus, Search, Type,
  Eye, Edit3, Maximize2, Minimize2,
  ArrowLeft, Loader2, FileText, RefreshCw,
  Feather, X, Check, AlertCircle, Trash2,
  Download, Save, BookOpen,
  Play, Pause, RotateCcw,
  Sparkles, Wand2, Copy, Clipboard, BarChart3,
  Book, Volume2, VolumeX, Headphones,
  Bold, Italic, Strikethrough, Heading1, Heading2, Quote, Code, List, ChevronLeft, ChevronRight, ChevronDown,
  User, PawPrint, MapPin, Globe, Package, BrainCircuit, Link2, MessageSquare, Star, History, FileDown, Layers, TrendingUp, GripVertical
} from "lucide-react"
import { 
  saveDirectoryHandleForProject, 
  getDirectoryHandleForProject,
  saveManuscriptLocal,
  getManuscriptLocal,
  saveStoryBibleLocal,
  getStoryBibleLocal,
  saveStoryBrainLocal,
  getStoryBrainLocal,
  saveChapterVersionsLocal,
  getChapterVersionsLocal
} from '@/lib/db'
import { 
  syncChaptersWithCloud, 
  saveChapterToCloud, 
  deleteChapterFromCloud,
  syncBibleWithCloud,
  saveBibleEntryToCloud,
  deleteBibleEntryFromCloud,
  syncBrainWithCloud,
  saveBrainEntryToCloud,
  deleteBrainEntryFromCloud,
  BibleEntry,
  BrainEntry
} from '@/lib/sync'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import JSZip from 'jszip'

interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
  wordGoal?: number
  volumeId?: string | null
  sortOrder?: number
}

interface Milestone {
  id: string
  title: string
  reqWords: number
  description: string
  badge: string
}

interface SprintRecord {
  id: string
  duration: number
  wordsWritten: number
  completedAt: number
}

const MILESTONES: Milestone[] = [
  { id: "scribe", title: "Novice Scribe", reqWords: 1000, description: "Wrote your first 1,000 words.", badge: "📜" },
  { id: "disciple", title: "Sect Disciple", reqWords: 5000, description: "Amassed 5,000 words of lore.", badge: "🔮" },
  { id: "elder", title: "Grand Elder", reqWords: 10000, description: "Reached 10,000 words of manuscript.", badge: "⚡" },
  { id: "immortal", title: "Ascended Immortal", reqWords: 25000, description: "Achieved 25,000 words.", badge: "🌌" },
  { id: "sovereign", title: "Heavenly Sovereign", reqWords: 50000, description: "Penned a grand epic of 50,000 words.", badge: "👑" }
]

type ViewMode = 'edit' | 'preview'
type SidebarTab = 'manuscript' | 'insights' | 'appearance' | 'progression' | 'bible' | 'sounds' | 'brain' | 'analytics'
type BrainEntityType = NonNullable<BrainEntry['entityType']>
type BrainImportance = NonNullable<BrainEntry['importance']>
type BrainTypeFilter = 'all' | BrainEntityType
type ExportFormat = 'folder' | 'txt' | 'md' | 'html' | 'doc' | 'pdf' | 'epub'
type SearchSource = 'chapter' | 'brain' | 'lore'
type AppearanceFormKey = 'beastForm' | 'demiHumanForm' | 'humanForm'
type ProgressionStatKey = 'strength' | 'agility' | 'endurance' | 'vitality' | 'intelligence' | 'sense' | 'mana'

interface GlobalSearchResult {
  id: string
  source: SearchSource
  title: string
  subtitle: string
  preview: string
  chapterId?: string
}

interface ChapterVersion {
  id: string
  title: string
  content: string
  savedAt: number
  wordCount: number
}

interface ManuscriptVolume {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  sortOrder: number
  isOpen?: boolean
}

interface StoryBibleGroup {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  sortOrder: number
}

interface ExportHistoryRecord {
  filename: string
  fingerprint: string
  exportedAt: number
}

interface AppearancePromptResult {
  characterName?: string
  overview?: string
  prompts?: Partial<Record<AppearanceFormKey, string>>
  consistencyNotes?: string[]
  negativePrompt?: string
}

interface ProgressionAbility {
  id: string
  name: string
  level: number
  rank?: string
  description: string
  evidence?: string
}

type ProgressionTemplateCardType = 'text' | 'rank' | 'progress' | 'resource' | 'stat' | 'ability' | 'compound' | 'counter'

interface ProgressionTemplateCard {
  id: string
  label: string
  type: ProgressionTemplateCardType
  sourceKey: string
  fields: string[]
  color: string
  enabled: boolean
}

interface ProgressionProfileTemplate {
  enabled: boolean
  name: string
  defaultRealm: string
  defaultStage: string
  defaultRank: string
  defaultClassName: string
  defaultCultivationPath: string
  baseLevel: number
  baseExp: number
  nextLevelExp: number
  defaultStats: Partial<Record<ProgressionStatKey, number>>
  defaultTraits: string[]
  defaultAbilities: ProgressionAbility[]
  defaultCustomFields: Record<string, string>
  cards: ProgressionTemplateCard[]
  notes: string
}

interface ProgressionSystemSettings {
  realms: string[]
  stageLabels: string[]
  showLevels: boolean
  showExp: boolean
  showStats: boolean
  statKeys: ProgressionStatKey[]
  customFields: string[]
  profileTemplate: ProgressionProfileTemplate
  notes: string
  useCustomJsonTemplate?: boolean
  customJsonTemplate?: string
  jsonCardOrder?: string[]
  updatedAt?: number
}

interface ProgressionHistoryEntry {
  id: string
  chapterId: string
  chapterTitle: string
  chapterNumber?: number | null
  appliedAt: number
  summary: string
  levelBefore: number
  levelAfter: number
  realmBefore?: string
  realmAfter?: string
  stageBefore?: string
  stageAfter?: string
  statChanges: Partial<Record<ProgressionStatKey, number>>
  abilityChanges: string[]
  rewards: string[]
  evidence: string[]
  customJsonDataBefore?: Record<string, any>
  customJsonDataAfter?: Record<string, any>
}

interface CharacterProgressionProfile {
  id: string
  loreEntryId: string
  name: string
  title?: string
  className?: string
  rank?: string
  nicknames?: string[]
  uniqueTrait?: string
  realm?: string
  stage?: string
  cultivationPath?: string
  level: number
  exp: number
  nextLevelExp: number
  stats: Record<ProgressionStatKey, number>
  abilities: ProgressionAbility[]
  traits: string[]
  customFields?: Record<string, string>
  customJsonData?: Record<string, any>
  notes: string
  processedChapterIds: string[]
  history: ProgressionHistoryEntry[]
  createdAt: number
  updatedAt: number
}

interface ProgressionAiResponse {
  targetLoreEntryId?: string
  targetProfileId?: string
  profile?: Partial<CharacterProgressionProfile>
  update?: {
    shouldApply?: boolean
    summary?: string
    levelBefore?: number
    levelAfter?: number
    realmBefore?: string
    realmAfter?: string
    stageBefore?: string
    stageAfter?: string
    statChanges?: Partial<Record<ProgressionStatKey, number>>
    abilityChanges?: string[]
    rewards?: string[]
    evidence?: string[]
  }
}

const MIN_LEFT_SIDEBAR_WIDTH = 280
const MAX_LEFT_SIDEBAR_WIDTH = 560
const DEFAULT_LEFT_SIDEBAR_WIDTH = 336
const UNASSIGNED_VOLUME_ID = "unassigned"
const DEFAULT_PROGRESSION_STATS: Record<ProgressionStatKey, number> = {
  strength: 1,
  agility: 1,
  endurance: 1,
  vitality: 1,
  intelligence: 1,
  sense: 1,
  mana: 0
}
const PROGRESSION_CARD_COLORS = ["rose", "violet", "cyan", "amber", "emerald", "blue", "fuchsia", "lime"]
const RANKED_PROGRESSION_RANK_WORDS = ["rank", "ranks", "grade", "grades", "tier", "tiers", "quality", "qualities"]
const DIRECT_PROGRESSION_TEMPLATE_KEYS = new Set([
  "name",
  "title",
  "cultivation",
  "cultivationstage",
  "realm",
  "stage",
  "rank",
  "level",
  "levelrank",
  "classname",
  "class",
  "jobclass",
  "abilities",
  "nicknames",
  "uniquetrait",
  "cultivationpath",
  "path",
  "exp",
  "experience",
  ...Object.keys(DEFAULT_PROGRESSION_STATS)
])
const PROGRESSION_TEMPLATE_CARD_TYPES: ProgressionTemplateCardType[] = ["text", "rank", "progress", "resource", "stat", "ability", "compound", "counter"]
const PROGRESSION_PRESET_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "template-preset-exp", label: "EXP", type: "progress", sourceKey: "exp", fields: ["EXP"], color: "lime", enabled: true },
  { id: "template-preset-level-up", label: "Level Up", type: "counter", sourceKey: "Level Ups", fields: ["Level Ups"], color: "fuchsia", enabled: true },
  { id: "template-preset-realm-stage", label: "Realm / Stage", type: "rank", sourceKey: "cultivation", fields: ["Realm", "Stage"], color: "violet", enabled: true },
  { id: "template-preset-affinity", label: "Affinity", type: "compound", sourceKey: "Affinity", fields: ["Affinity Names", "Rank"], color: "cyan", enabled: true },
  { id: "template-preset-bloodline", label: "Bloodline", type: "compound", sourceKey: "Bloodline", fields: ["Bloodline", "Bloodline Grade"], color: "emerald", enabled: true },
  { id: "template-preset-titles", label: "Titles", type: "compound", sourceKey: "Titles", fields: ["Title", "Reputation"], color: "amber", enabled: true },
  { id: "template-preset-resources", label: "Resources", type: "resource", sourceKey: "Resources", fields: ["HP", "Mana / Qi", "Stamina"], color: "blue", enabled: true },
  { id: "template-preset-artifacts", label: "Inventory / Artifacts", type: "compound", sourceKey: "Artifacts", fields: ["Artifact", "Grade", "Status"], color: "rose", enabled: true }
]
const DEFAULT_PROFILE_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "template-name", label: "Name", type: "text", sourceKey: "name", fields: ["Name", "Title"], color: "rose", enabled: true },
  { id: "template-cultivation", label: "Cultivation Stage", type: "rank", sourceKey: "cultivation", fields: ["Cultivation Stage", "Rank"], color: "violet", enabled: true },
  { id: "template-bloodline", label: "Bloodline", type: "compound", sourceKey: "Bloodline", fields: ["Bloodline", "Bloodline Rank"], color: "emerald", enabled: true },
  { id: "template-class", label: "Class", type: "text", sourceKey: "className", fields: ["Class"], color: "cyan", enabled: true },
  { id: "template-skills", label: "Skills", type: "ability", sourceKey: "abilities", fields: ["Skill", "Rank", "Description"], color: "amber", enabled: true },
  { id: "template-lore", label: "Lore", type: "text", sourceKey: "notes", fields: ["Lore"], color: "blue", enabled: true }
]
const LITRPG_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "litrpg-name", label: "Character Profile", type: "text", sourceKey: "name", fields: ["Name", "Race", "Class"], color: "rose", enabled: true },
  { id: "litrpg-level", label: "Level & EXP", type: "rank", sourceKey: "level", fields: ["Level", "EXP"], color: "lime", enabled: true },
  { id: "litrpg-resources", label: "Vital Pools", type: "resource", sourceKey: "Resources", fields: ["HP", "MP", "SP"], color: "blue", enabled: true },
  { id: "litrpg-stats", label: "Core Attributes", type: "stat", sourceKey: "stats", fields: ["STR", "AGI", "VIT", "INT", "DEX", "WIS"], color: "cyan", enabled: true },
  { id: "litrpg-titles", label: "Acquired Titles", type: "compound", sourceKey: "Titles", fields: ["Title", "Effect"], color: "amber", enabled: true },
  { id: "litrpg-skills", label: "Active & Passive Skills", type: "ability", sourceKey: "abilities", fields: ["Skill Name", "Rank", "Description"], color: "violet", enabled: true },
  { id: "litrpg-inventory", label: "Equipment & Wealth", type: "compound", sourceKey: "Inventory", fields: ["Equipment", "Gold"], color: "emerald", enabled: true }
]
const SOLO_LEVELING_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "sl-identity", label: "Hunter Status", type: "text", sourceKey: "name", fields: ["Name", "Class"], color: "rose", enabled: true },
  { id: "sl-level", label: "Hunter Level", type: "rank", sourceKey: "level", fields: ["Level"], color: "lime", enabled: true },
  { id: "sl-resources", label: "Combat Pools", type: "resource", sourceKey: "Resources", fields: ["HP", "MP"], color: "blue", enabled: true },
  { id: "sl-stats", label: "Attributes", type: "stat", sourceKey: "stats", fields: ["Strength", "Agility", "Stamina", "Intelligence", "Perception"], color: "cyan", enabled: true },
  { id: "sl-skills", label: "Monarch Skills", type: "ability", sourceKey: "abilities", fields: ["Skill Name", "Type", "Description"], color: "violet", enabled: true },
  { id: "sl-shadows", label: "Shadow Army", type: "compound", sourceKey: "Shadows", fields: ["Current Soldiers", "Max Soldiers"], color: "fuchsia", enabled: true }
]
const XIANXIA_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "xianxia-profile", label: "Daoist Profile", type: "text", sourceKey: "name", fields: ["Name", "Dao Title", "Faction"], color: "rose", enabled: true },
  { id: "xianxia-cultivation", label: "Cultivation Realm", type: "rank", sourceKey: "cultivation", fields: ["Realm", "Stage", "Foundation"], color: "violet", enabled: true },
  { id: "xianxia-qi", label: "Qi Capacity & Lifespan", type: "resource", sourceKey: "Resources", fields: ["Qi Capacity", "Lifespan"], color: "blue", enabled: true },
  { id: "xianxia-lineage", label: "Bloodline & Physique", type: "compound", sourceKey: "Bloodline", fields: ["Bloodline", "Physique"], color: "emerald", enabled: true },
  { id: "xianxia-laws", label: "Elements & Intents", type: "compound", sourceKey: "Affinities", fields: ["Elements", "Comprehensions / Intents"], color: "cyan", enabled: true },
  { id: "xianxia-techniques", label: "Cultivation Techniques", type: "ability", sourceKey: "abilities", fields: ["Technique Name", "Layer/Rank", "Description"], color: "amber", enabled: true },
  { id: "xianxia-treasures", label: "Spiritual Treasures", type: "compound", sourceKey: "Artifacts", fields: ["Spiritual Weapon", "Grade"], color: "lime", enabled: true }
]
const SHADOW_SLAVE_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "ss-identity", label: "Soul Profile", type: "text", sourceKey: "name", fields: ["Name", "True Name"], color: "rose", enabled: true },
  { id: "ss-rank", label: "Ascension Rank & Class", type: "rank", sourceKey: "rank", fields: ["Rank", "Class"], color: "violet", enabled: true },
  { id: "ss-cores", label: "Shadow Fragments", type: "progress", sourceKey: "Shadow Fragments", fields: ["Shadow Cores", "Fragments"], color: "fuchsia", enabled: true },
  { id: "ss-aspect", label: "Aspect & Legacy", type: "compound", sourceKey: "Aspect", fields: ["Aspect Name", "Aspect Legacy"], color: "cyan", enabled: true },
  { id: "ss-attributes", label: "Aspect Attributes", type: "compound", sourceKey: "Attributes", fields: ["Aspect Attributes"], color: "amber", enabled: true },
  { id: "ss-memories", label: "Memories & Echoes", type: "ability", sourceKey: "abilities", fields: ["Memory/Echo Name", "Rank", "Type", "Description"], color: "blue", enabled: true }
]
const TALENT_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "talent-profile", label: "Fate Profile", type: "text", sourceKey: "name", fields: ["Name", "Destiny", "Karma"], color: "rose", enabled: true },
  { id: "talent-cultivation", label: "Cultivation Realm", type: "rank", sourceKey: "cultivation", fields: ["Cultivation Realm", "Potential"], color: "violet", enabled: true },
  { id: "talent-talents", label: "Innate Talents", type: "compound", sourceKey: "Talents", fields: ["Primary Talent", "SSS Grades"], color: "cyan", enabled: true },
  { id: "talent-luck", label: "Luck & Karma", type: "counter", sourceKey: "Luck", fields: ["Luck Value", "Karma State"], color: "amber", enabled: true },
  { id: "talent-comprehension", label: "Comprehension", type: "progress", sourceKey: "Comprehension", fields: ["Comprehension Multiplier"], color: "lime", enabled: true }
]
const DEFAULT_PROFILE_TEMPLATE: ProgressionProfileTemplate = {
  enabled: true,
  name: "Simple Character Progression",
  defaultRealm: "",
  defaultStage: "",
  defaultRank: "",
  defaultClassName: "",
  defaultCultivationPath: "",
  baseLevel: 1,
  baseExp: 0,
  nextLevelExp: 100,
  defaultStats: DEFAULT_PROGRESSION_STATS,
  defaultTraits: [],
  defaultAbilities: [],
  defaultCustomFields: {},
  cards: DEFAULT_PROFILE_TEMPLATE_CARDS,
  notes: ""
}
const DEFAULT_PROGRESSION_SYSTEM: ProgressionSystemSettings = {
  realms: [],
  stageLabels: ["Low", "Medium", "High", "Peak"],
  showLevels: false,
  showExp: false,
  showStats: false,
  statKeys: Object.keys(DEFAULT_PROGRESSION_STATS) as ProgressionStatKey[],
  customFields: ["Bloodline", "Bloodline Rank"],
  profileTemplate: DEFAULT_PROFILE_TEMPLATE,
  useCustomJsonTemplate: false,
  customJsonTemplate: JSON.stringify({
    "title": "Mortal",
    "cultivation": {
      "realm": "Body Tempering",
      "stage": "Low"
    },
    "class": "None",
    "race": "Human",
    "weapon": "Iron Sword",
    "skills": ["Slash"],
    "affiliation": "Seven Stars Sect",
    "relations": []
  }, null, 2),
  jsonCardOrder: ["title", "cultivation", "class", "race", "weapon", "skills", "affiliation", "relations"],
  notes: "Simple character progression tracks Name, Title, Cultivation Stage, Rank, Bloodline, Bloodline Rank, Class, Skills, and Lore."
}

const getRankedProgressionFieldKind = (value: unknown) => {
  const cleanValue = String(value || "").toLowerCase()
  if (cleanValue.includes("bloodline")) return "bloodline"
  if (cleanValue.includes("affinity") || cleanValue.includes("element")) return "affinity"
  return ""
}

const getAffinitiesList = (namesStr: string, ranksStr: string) => {
  const names = String(namesStr || "").split(",").map(s => s.trim()).filter(Boolean)
  if (names.length === 0) return []
  
  const ranksList = String(ranksStr || "").split(",").map(s => s.trim()).filter(Boolean)
  
  const elementRankMap: Record<string, string> = {}
  ranksList.forEach(rankPart => {
    const match = rankPart.match(/^([^(]+)(?:\(([^)]+)\)|-\s*(.+))$/)
    if (match) {
      const elementName = match[1].trim().toLowerCase()
      const rankValue = (match[2] || match[3] || "").trim()
      if (elementName && rankValue) {
        elementRankMap[elementName] = rankValue
      }
    }
  })

  return names.map((name, index) => {
    const lowerName = name.toLowerCase()
    if (elementRankMap[lowerName]) {
      return { name, rank: elementRankMap[lowerName] }
    }
    
    const matchingRank = ranksList.find(r => r.toLowerCase().includes(lowerName))
    if (matchingRank) {
      const cleanR = matchingRank.replace(new RegExp(`^${name}\\s*[(-]?`, "i"), "").replace(/[)]$/, "").trim()
      return { name, rank: cleanR || matchingRank }
    }
    
    if (ranksList.length === names.length) {
      const r = ranksList[index]
      const cleanR = r.replace(new RegExp(`^${name}\\s*[(-]?`, "i"), "").replace(/[)]$/, "").trim()
      return { name, rank: cleanR || r }
    }
    
    if (ranksList.length === 1) {
      const r = ranksList[0]
      const cleanR = r.replace(new RegExp(`^${name}\\s*[(-]?`, "i"), "").replace(/[)]$/, "").trim()
      return { name, rank: cleanR || r }
    }
    
    return { name, rank: "Not set" }
  })
}

const isProgressionRankFieldName = (value: unknown) => {
  const cleanValue = String(value || "").toLowerCase()
  return RANKED_PROGRESSION_RANK_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(cleanValue))
}

const getProgressionRankCompanionFieldName = (label: string, sourceKey: string) => {
  const baseName = String(label || sourceKey || "").trim()
  const kind = getRankedProgressionFieldKind(`${label} ${sourceKey}`)
  if (!baseName || !kind) return ""
  if (kind === "bloodline") return `${baseName} Grade`
  if (kind === "affinity") return "Rank"
  return `${baseName} Ranks`
}

const getProgressionRankedTemplateFields = (label: string, sourceKey: string, fields: string[]) => {
  const initialFields = fields.length > 0 ? fields : [label]
  const kind = getRankedProgressionFieldKind(`${label} ${sourceKey} ${initialFields.join(" ")}`)
  const hasOnlyPlaceholderFields = initialFields.every(field => /^new field(?: \d+)?$/i.test(field) || /^field$/i.test(field))
  let baseFields = kind && hasOnlyPlaceholderFields ? [label] : initialFields
  
  if (kind === "affinity") {
    if (baseFields.length === 1 && (baseFields[0].toLowerCase() === "affinity" || baseFields[0].toLowerCase() === "spirit affinity" || baseFields[0].toLowerCase() === "elemental affinity")) {
      baseFields = ["Affinity Names"]
    }
  }

  if (!kind || baseFields.some(isProgressionRankFieldName)) return baseFields
  const companionField = getProgressionRankCompanionFieldName(label, sourceKey)
  return companionField ? [...baseFields, companionField] : baseFields
}

const normalizeProgressionTemplateLookupKey = (value: unknown) => {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "")
}

const isDirectProgressionTemplateKey = (value: unknown) => {
  return DIRECT_PROGRESSION_TEMPLATE_KEYS.has(normalizeProgressionTemplateLookupKey(value))
}

const clampLeftSidebarWidth = (width: number) => {
  return Math.min(MAX_LEFT_SIDEBAR_WIDTH, Math.max(MIN_LEFT_SIDEBAR_WIDTH, width))
}

// Synthesizer class using native Web Audio API
class AudioFocusSynthesizer {
  ctx: AudioContext | null = null
  sources: { [key: string]: AudioBufferSourceNode | null } = {}
  gainNodes: { [key: string]: GainNode | null } = {}
  activeType: string = 'none'
  volume: number = 0.5
  cafeInterval: NodeJS.Timeout | null = null

  init() {
    if (!this.ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  stopAll() {
    this.activeType = 'none'
    if (this.cafeInterval) {
      clearInterval(this.cafeInterval)
      this.cafeInterval = null
    }
    for (const key of Object.keys(this.sources)) {
      if (this.sources[key]) {
        try { this.sources[key]!.stop() } catch {}
        this.sources[key] = null
      }
      if (this.gainNodes[key]) {
        try { this.gainNodes[key]!.disconnect() } catch {}
        this.gainNodes[key] = null
      }
    }
  }

  setVolume(vol: number) {
    this.volume = vol
    for (const key of Object.keys(this.gainNodes)) {
      if (this.gainNodes[key] && this.ctx) {
        this.gainNodes[key]!.gain.setValueAtTime(vol, this.ctx.currentTime)
      }
    }
  }

  play(type: string) {
    this.init()
    this.stopAll()
    if (type === 'none') return
    this.activeType = type

    const ctx = this.ctx!
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(this.volume, ctx.currentTime)
    gainNode.connect(ctx.destination)
    this.gainNodes[type] = gainNode

    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (type === 'brown' || type === 'rain' || type === 'cafe') {
      let lastOut = 0.0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        data[i] = (lastOut + (0.02 * white)) / 1.02
        lastOut = data[i]
        data[i] *= 3.5
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    if (type === 'rain') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(900, ctx.currentTime)

      const peak = ctx.createBiquadFilter()
      peak.type = 'peaking'
      peak.frequency.setValueAtTime(1600, ctx.currentTime)
      peak.Q.setValueAtTime(1.5, ctx.currentTime)
      peak.gain.setValueAtTime(-10, ctx.currentTime)

      source.connect(lp)
      lp.connect(peak)
      peak.connect(gainNode)
    } else if (type === 'cafe') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(600, ctx.currentTime)

      source.connect(lp)
      lp.connect(gainNode)
      this.startCafeClinks(gainNode)
    } else {
      source.connect(gainNode)
    }

    source.start()
    this.sources[type] = source
  }

  startCafeClinks(destination: AudioNode) {
    const triggerClink = () => {
      if (this.activeType !== 'cafe' || !this.ctx) return
      const ctx = this.ctx
      try {
        const osc = ctx.createOscillator()
        const clickGain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1900 + Math.random() * 700, ctx.currentTime)

        clickGain.gain.setValueAtTime(0.0, ctx.currentTime)
        clickGain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, ctx.currentTime + 0.004)
        clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)

        osc.connect(clickGain)
        clickGain.connect(destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } catch {}

      const nextDelay = 1500 + Math.random() * 4500
      this.cafeInterval = setTimeout(triggerClink, nextDelay)
    }
    this.cafeInterval = setTimeout(triggerClink, 2000)
  }

  playChime() {
    this.init()
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const freqs = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (C Major Chord)
    freqs.forEach((freq, idx) => {
      try {
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        gainNode.gain.setValueAtTime(0, now)
        gainNode.gain.linearRampToValueAtTime(0.12 * this.volume, now + 0.05 + idx * 0.015)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2 + idx * 0.08)
        osc.connect(gainNode)
        gainNode.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 2.0)
      } catch {}
    })
  }
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

function EditorContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id')

  const [projectName, setProjectName] = useState("Loading...")
  const [notes, setNotes] = useState<Note[]>([])
  const [volumes, setVolumes] = useState<ManuscriptVolume[]>([])
  const [collapsedVolumeIds, setCollapsedVolumeIds] = useState<Set<string>>(new Set())
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null)
  const [chapterMoveMenu, setChapterMoveMenu] = useState<{ noteId: string; x: number; y: number } | null>(null)
  const [showVolumeCreateModal, setShowVolumeCreateModal] = useState(false)
  const [newVolumeName, setNewVolumeName] = useState("")
  const [newVolumeIsOpen, setNewVolumeIsOpen] = useState(true)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionTime, setSessionTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  const activeNote = notes.find(n => n && n.id === activeNoteId)

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false)

  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState("")
  const [showTimelinePanel, setShowTimelinePanel] = useState(true)
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [chapterVersions, setChapterVersions] = useState<ChapterVersion[]>([])
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<ChapterVersion | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dirHandle, setDirHandle] = useState<any>(null)

  // Redesign States
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('manuscript')
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_LEFT_SIDEBAR_WIDTH
    const stored = Number(window.localStorage.getItem('penpad_left_sidebar_width'))
    return Number.isFinite(stored) && stored > 0
      ? clampLeftSidebarWidth(stored)
      : DEFAULT_LEFT_SIDEBAR_WIDTH
  })
  const [isZenMode, setIsZenMode] = useState(false)

  // AI Assistant state variables
  const [showAISidebar, setShowAISidebar] = useState(false)
  const [aiTab, setAiTab] = useState<'continue' | 'rewrite' | 'outline'>('continue')
  const [aiSelectionText, setAiSelectionText] = useState("")
  const [aiSelectionStart, setAiSelectionStart] = useState(0)
  const [aiSelectionEnd, setAiSelectionEnd] = useState(0)
  const [aiTone, setAiTone] = useState("descriptive")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOutlinePrompt, setAiOutlinePrompt] = useState("")
  const [aiError, setAiError] = useState("")
  const [aiCopied, setAiCopied] = useState(false)

  // World Bible States
  const [bibleEntries, setBibleEntries] = useState<BibleEntry[]>([])
  const [bibleGroups, setBibleGroups] = useState<StoryBibleGroup[]>([])
  const [activeBibleGroupId, setActiveBibleGroupId] = useState<string>('all')
  const [draggedBibleEntryId, setDraggedBibleEntryId] = useState<string | null>(null)
  const [activeBibleEntryId, setActiveBibleEntryId] = useState<string | null>(null)
  const [isBibleDrawerOpen, setIsBibleDrawerOpen] = useState(false)
  const [bibleSearchQuery, setBibleSearchQuery] = useState('')
  const [bibleCategoryFilter, setBibleCategoryFilter] = useState<'all' | 'character' | 'world' | 'beast' | 'place' | 'item'>('all')
  const [isBibleSelectionMode, setIsBibleSelectionMode] = useState(false)
  const [selectedBibleIds, setSelectedBibleIds] = useState<Set<string>>(new Set())
  const [isBibleGroupAddMenuOpen, setIsBibleGroupAddMenuOpen] = useState(false)
  const [showMultiBibleDeleteModal, setShowMultiBibleDeleteModal] = useState(false)

  const activeBibleEntry = bibleEntries.find(e => e.id === activeBibleEntryId)

  // Brain Map States
  const [brainEntries, setBrainEntries] = useState<BrainEntry[]>([])
  const [brainSearchQuery, setBrainSearchQuery] = useState('')
  const [selectedBrainEntryId, setSelectedBrainEntryId] = useState<string | null>(null)
  const [brainTypeFilter, setBrainTypeFilter] = useState<BrainTypeFilter>('all')
  const [selectedBrainEntityName, setSelectedBrainEntityName] = useState<string | null>(null)
  const [brainAskQuestion, setBrainAskQuestion] = useState('')
  const [brainAskAnswer, setBrainAskAnswer] = useState('')
  const [brainAskLoading, setBrainAskLoading] = useState(false)
  const [brainAskError, setBrainAskError] = useState('')

  // Focus Sprints & Gamified Focus Tracker States
  const [sprintDuration, setSprintDuration] = useState(1500)
  const [sprintTimeRemaining, setSprintTimeRemaining] = useState(1500)
  const [sprintActive, setSprintActive] = useState(false)
  const [sprintStartTotalWords, setSprintStartTotalWords] = useState(0)
  const [sprintWordsWritten, setSprintWordsWritten] = useState(0)
  const [showSprintCompleteModal, setShowSprintCompleteModal] = useState(false)
  const [sprintCompleteWords, setSprintCompleteWords] = useState(0)
  const [sprintHistory, setSprintHistory] = useState<SprintRecord[]>(() => {
    if (typeof window === "undefined") return []
    const stored = localStorage.getItem("penpad_sprint_history")
    return stored ? JSON.parse(stored) : []
  })

  const [dailyWordLog, setDailyWordLog] = useState<Record<string, number>>({})
  const [unlockedMilestones, setUnlockedMilestones] = useState<Set<string>>(new Set())
  const [showMilestoneAlert, setShowMilestoneAlert] = useState<Milestone | null>(null)

  const currentTotalWords = useMemo(() => {
    return notes.reduce((total, note) => total + countWords(note?.content || ""), 0)
  }, [notes])

  const last28Days = useMemo(() => {
    const days: { date: Date; dateStr: string; count: number }[] = []
    const now = new Date()
    for (let i = 27; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const dateStr = d.toLocaleDateString('en-CA') // YYYY-MM-DD
      days.push({
        date: d,
        dateStr,
        count: dailyWordLog[dateStr] || 0
      })
    }
    return days
  }, [dailyWordLog])

  // Timer countdown loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (sprintActive && sprintTimeRemaining > 0) {
      interval = setInterval(() => {
        setSprintTimeRemaining(prev => {
          if (prev <= 1) {
            setSprintActive(false)
            if (interval) clearInterval(interval)
            
            const finalWords = Math.max(0, currentTotalWords - sprintStartTotalWords)
            setSprintCompleteWords(finalWords)
            setShowSprintCompleteModal(true)
            
            const newSprint: SprintRecord = {
              id: crypto.randomUUID(),
              duration: sprintDuration,
              wordsWritten: finalWords,
              completedAt: Date.now()
            }
            setSprintHistory(prev => {
              const updated = [newSprint, ...prev].slice(0, 10)
              localStorage.setItem("penpad_sprint_history", JSON.stringify(updated))
              return updated
            })
            
            if (synthRef.current) {
              synthRef.current.playChime()
            }
            
            const todayStr = new Date().toLocaleDateString('en-CA')
            setDailyWordLog(prevLog => {
              const currentTodayVal = prevLog[todayStr] || 0
              const nextLog = {
                ...prevLog,
                [todayStr]: currentTodayVal + finalWords
              }
              if (projectId) {
                localStorage.setItem(`penpad_daily_word_log_${projectId}`, JSON.stringify(nextLog))
              }
              return nextLog
            })
            
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sprintActive, sprintTimeRemaining, currentTotalWords, sprintStartTotalWords, projectId, sprintDuration])

  // Track words written in active sprint
  useEffect(() => {
    if (sprintActive) {
      setSprintWordsWritten(Math.max(0, currentTotalWords - sprintStartTotalWords))
    }
  }, [currentTotalWords, sprintStartTotalWords, sprintActive])

  // Initial load daily word log and milestones
  useEffect(() => {
    if (!projectId) return
    
    const storedLog = localStorage.getItem(`penpad_daily_word_log_${projectId}`)
    if (storedLog) {
      try {
        setDailyWordLog(JSON.parse(storedLog))
      } catch {}
    }
    
    const storedMilestones = localStorage.getItem(`penpad_unlocked_milestones_${projectId}`)
    if (storedMilestones) {
      try {
        setUnlockedMilestones(new Set(JSON.parse(storedMilestones)))
      } catch {}
    } else if (notes.length > 0) {
      const initialUnlocked = new Set<string>()
      MILESTONES.forEach(m => {
        if (currentTotalWords >= m.reqWords) {
          initialUnlocked.add(m.id)
        }
      })
      if (initialUnlocked.size > 0) {
        setUnlockedMilestones(initialUnlocked)
        localStorage.setItem(`penpad_unlocked_milestones_${projectId}`, JSON.stringify(Array.from(initialUnlocked)))
      }
    }
  }, [projectId, notes.length, currentTotalWords])

  // Track daily start words for daily progress calculation
  useEffect(() => {
    if (!projectId || notes.length === 0) return
    const todayStr = new Date().toLocaleDateString('en-CA')
    const storedStartMeta = localStorage.getItem(`penpad_daily_start_words_${projectId}`)
    
    let dailyStart = currentTotalWords
    if (storedStartMeta) {
      try {
        const parsed = JSON.parse(storedStartMeta)
        if (parsed.dateString === todayStr) {
          dailyStart = parsed.count
        } else {
          localStorage.setItem(`penpad_daily_start_words_${projectId}`, JSON.stringify({
            dateString: todayStr,
            count: currentTotalWords
          }))
        }
      } catch {}
    } else {
      localStorage.setItem(`penpad_daily_start_words_${projectId}`, JSON.stringify({
        dateString: todayStr,
        count: currentTotalWords
      }))
    }
    
    const writtenToday = Math.max(0, currentTotalWords - dailyStart)
    setDailyWordLog(prevLog => {
      if (prevLog[todayStr] === writtenToday) return prevLog
      const nextLog = {
        ...prevLog,
        [todayStr]: writtenToday
      }
      localStorage.setItem(`penpad_daily_word_log_${projectId}`, JSON.stringify(nextLog))
      return nextLog
    })
  }, [currentTotalWords, projectId, notes.length])

  // Check and trigger milestones
  useEffect(() => {
    if (!projectId || notes.length === 0) return
    
    MILESTONES.forEach(m => {
      if (currentTotalWords >= m.reqWords && !unlockedMilestones.has(m.id)) {
        setUnlockedMilestones(prev => {
          const next = new Set(prev)
          next.add(m.id)
          localStorage.setItem(`penpad_unlocked_milestones_${projectId}`, JSON.stringify(Array.from(next)))
          return next
        })
        
        setShowMilestoneAlert(m)
        if (synthRef.current) {
          synthRef.current.playChime()
        }
      }
    })
  }, [currentTotalWords, unlockedMilestones, projectId, notes.length])

  const startSprint = (durationSec: number) => {
    setSprintDuration(durationSec)
    setSprintTimeRemaining(durationSec)
    setSprintStartTotalWords(currentTotalWords)
    setSprintWordsWritten(0)
    setSprintActive(true)
  }

  const pauseSprint = () => {
    setSprintActive(false)
  }

  const resumeSprint = () => {
    setSprintActive(true)
  }

  const resetSprint = () => {
    setSprintActive(false)
    setSprintTimeRemaining(sprintDuration)
    setSprintWordsWritten(0)
  }

  // Character Progression States
  const [progressionProfiles, setProgressionProfiles] = useState<CharacterProgressionProfile[]>([])
  const [progressionSystem, setProgressionSystem] = useState<ProgressionSystemSettings>(DEFAULT_PROGRESSION_SYSTEM)
  const [selectedProgressionProfileId, setSelectedProgressionProfileId] = useState<string | null>(null)
  const [progressionSelectedEntryId, setProgressionSelectedEntryId] = useState<string | null>(null)
  const [progressionLoading, setProgressionLoading] = useState(false)
  const [progressionError, setProgressionError] = useState("")
  const [progressionNotice, setProgressionNotice] = useState("")
  const [characterProfileSubTab, setCharacterProfileSubTab] = useState<'cards' | 'json'>('cards')
  const [characterJsonText, setCharacterJsonText] = useState("")
  const [isProgressionEditMode, setIsProgressionEditMode] = useState(false)
  const [progressionEditProfileDraft, setProgressionEditProfileDraft] = useState<CharacterProgressionProfile | null>(null)
  const [progressionNewFieldName, setProgressionNewFieldName] = useState("")
  const [progressionNewFieldValue, setProgressionNewFieldValue] = useState("")
  const [progressionNewFieldType, setProgressionNewFieldType] = useState<ProgressionTemplateCardType>("text")
  const [showProgressionCharactersModal, setShowProgressionCharactersModal] = useState(false)
  const [showProgressionTemplateModal, setShowProgressionTemplateModal] = useState(false)
  const [draggedProgressionTemplateCardId, setDraggedProgressionTemplateCardId] = useState<string | null>(null)
  const [progressionRealmImportText, setProgressionRealmImportText] = useState("")
  const [progressionRealmImportLoading, setProgressionRealmImportLoading] = useState(false)
  const [isProgressionCultivationImportOpen, setIsProgressionCultivationImportOpen] = useState(false)
  const [progressionTemplatePrompt, setProgressionTemplatePrompt] = useState("")
  const [progressionTemplatePromptLoading, setProgressionTemplatePromptLoading] = useState(false)
  const [progressionTemplatePromptError, setProgressionTemplatePromptError] = useState("")
  const [isProgressionPromptDesignerOpen, setIsProgressionPromptDesignerOpen] = useState(false)
  const [progressionBulkUpdating, setProgressionBulkUpdating] = useState(false)
  const [progressionBulkUpdateStatus, setProgressionBulkUpdateStatus] = useState("")
  const [showStatsChart, setShowStatsChart] = useState(false)
  const [selectedGraphStat, setSelectedGraphStat] = useState<string>("level")
  const [hoveredGraphPoint, setHoveredGraphPoint] = useState<{ x: number; y: number; value: string | number; label: string; index: number } | null>(null)

  // Ambient Sound States
  const [activeSound, setActiveSound] = useState<string>('none')
  const [soundVolume, setSoundVolume] = useState<number>(0.5)
  const synthRef = useRef<AudioFocusSynthesizer | null>(null)

  // Slash Menu Commands States
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuQuery, setSlashMenuQuery] = useState("")
  const [slashMenuIndex, setSlashMenuIndex] = useState(0)
  
  // AI Lore Generation States
  const [showAILoreModal, setShowAILoreModal] = useState(false)
  const [aiLoreName, setAiLoreName] = useState("")
  const [aiLoreCategory, setAiLoreCategory] = useState<"character" | "world">("character")
  const [aiLoreContext, setAiLoreContext] = useState("")
  const [aiLoreLoading, setAiLoreLoading] = useState(false)
  const [aiLoreError, setAiLoreError] = useState("")

  // Appearance Prompt Lab States
  const [appearanceStyle, setAppearanceStyle] = useState("cinematic fantasy character concept art")
  const [appearanceSelectedEntryId, setAppearanceSelectedEntryId] = useState<string | null>(null)
  const [appearanceResult, setAppearanceResult] = useState<AppearancePromptResult | null>(null)
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState("")
  const [appearanceCopiedKey, setAppearanceCopiedKey] = useState<string | null>(null)

  // Hover Tooltip States
  const [hoveredLore, setHoveredLore] = useState<BibleEntry | null>(null)
  const [hoveredLorePosition, setHoveredLorePosition] = useState<{ top: number; left: number } | null>(null)

  // Autocomplete States
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const [autocompleteTriggerPos, setAutocompleteTriggerPos] = useState(0)

  const handleLoreMouseEnter = (e: React.MouseEvent, entry: BibleEntry) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredLore(entry)
    setHoveredLorePosition({
      top: rect.top + window.scrollY - 10,
      left: rect.left + window.scrollX + rect.width / 2
    })
  }

  const handleLoreMouseLeave = () => {
    setHoveredLore(null)
    setHoveredLorePosition(null)
  }

  const persistLeftSidebarWidth = (width: number) => {
    const clamped = clampLeftSidebarWidth(width)
    setLeftSidebarWidth(clamped)
    window.localStorage.setItem('penpad_left_sidebar_width', String(clamped))
  }

  const startLeftSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isLeftSidebarOpen) return

    event.preventDefault()
    const startX = event.clientX
    const startWidth = leftSidebarWidth
    document.body.classList.add('resizing-sidebar')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setLeftSidebarWidth(clampLeftSidebarWidth(startWidth + moveEvent.clientX - startX))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('resizing-sidebar')
      setLeftSidebarWidth(current => {
        const clamped = clampLeftSidebarWidth(current)
        window.localStorage.setItem('penpad_left_sidebar_width', String(clamped))
        return clamped
      })
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  const handleSidebarResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 24 : -24
    persistLeftSidebarWidth(leftSidebarWidth + direction)
  }

  const handleLoreClick = (entry: BibleEntry) => {
    setActiveSidebarTab('bible')
    setIsLeftSidebarOpen(true)
    setActiveBibleEntryId(entry.id)
    setIsBibleDrawerOpen(true)
  }

  const handleGenerateAILore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiLoreName.trim() || !user || !projectId) return
    setAiLoreLoading(true)
    setAiLoreError("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_lore",
          name: aiLoreName,
          category: aiLoreCategory,
          context: aiLoreContext
        })
      })
      const data = await res.json()
      if (data.error) {
        setAiLoreError(data.error)
      } else {
        const now = Date.now()
        const newEntry: BibleEntry = {
          id: crypto.randomUUID(),
          name: aiLoreName,
          category: aiLoreCategory,
          content: data.text || "",
          createdAt: now,
          updatedAt: now
        }
        const updated = [newEntry, ...bibleEntries]
        setBibleEntries(updated)
        await saveStoryBibleLocal(projectId, updated)
        
        await saveBibleEntryToCloud(user.uid, projectId, newEntry)

        setActiveBibleEntryId(newEntry.id)
        setIsBibleDrawerOpen(true)
        setShowAILoreModal(false)
        setAiLoreName("")
        setAiLoreContext("")
      }
    } catch (err) {
      setAiLoreError(err instanceof Error ? err.message : "Failed to generate lore")
    } finally {
      setAiLoreLoading(false)
    }
  }

  const selectedAppearanceEntry = bibleEntries.find(entry => entry.id === appearanceSelectedEntryId)

  const buildAppearanceLoreContent = (result: AppearancePromptResult) => {
    const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
    const chapterLine = activeNote
      ? `${activeChapterNumber ? `Chapter ${activeChapterNumber} - ` : ""}${activeNote.title || "Untitled"}`
      : "No chapter selected"
    const prompts = result.prompts || {}
    const notes = Array.isArray(result.consistencyNotes) && result.consistencyNotes.length > 0
      ? result.consistencyNotes.map(note => `- ${note}`).join("\n")
      : "- Keep recognizable traits consistent across every form."

    return [
      "## Appearance Prompt Sheet",
      `Source: ${chapterLine}`,
      `Style Direction: ${appearanceStyle}`,
      "",
      result.overview ? `### Visual Core\n${result.overview}\n` : "",
      "### Beast Form",
      prompts.beastForm || "Not generated.",
      "",
      "### Demi-human Form",
      prompts.demiHumanForm || "Not generated.",
      "",
      "### Human Form",
      prompts.humanForm || "Not generated.",
      "",
      "### Consistency Notes",
      notes,
      "",
      result.negativePrompt ? `### Negative Prompt\n${result.negativePrompt}` : ""
    ].filter(Boolean).join("\n")
  }

  const findLoreEntryFromSelection = (selectedText: string) => {
    const cleanSelection = selectedText.trim().toLowerCase()
    if (!cleanSelection) return null
    return bibleEntries.find(entry => {
      const aliases = getLoreAliases(entry).map(alias => alias.toLowerCase())
      return aliases.some(alias => alias === cleanSelection || cleanSelection.includes(alias))
    }) || null
  }

  const handleGenerateAppearancePrompts = async (entryId?: string | null, selectedTextOverride?: string) => {
    const selectedText = selectedTextOverride ?? aiSelectionText
    const sourceEntry = entryId
      ? bibleEntries.find(entry => entry.id === entryId)
      : selectedAppearanceEntry || findLoreEntryFromSelection(selectedText)

    if (!sourceEntry) {
      setAppearanceError("Highlight a Story Bible name in the chapter or choose a lore entry first.")
      return
    }

    setAppearanceSelectedEntryId(sourceEntry.id)
    setAppearanceLoading(true)
    setAppearanceError("")
    setAppearanceResult(null)

    try {
      const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
      const chapterContext = activeNote?.content
        ? activeNote.content.slice(0, 5000)
        : ""
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appearance_prompts",
          name: sourceEntry.name,
          style: appearanceStyle,
          selectedText,
          loreEntry: {
            name: sourceEntry.name,
            category: sourceEntry.category,
            content: sourceEntry.content,
            groups: (sourceEntry.groupIds || [])
              .map(groupId => bibleGroups.find(group => group.id === groupId)?.name)
              .filter(Boolean)
          },
          chapter: activeNote ? {
            title: activeNote.title,
            chapterNumber: activeChapterNumber,
            content: chapterContext
          } : null,
          memory: buildStoryMemoryContext()
        })
      })
      const data = await res.json()
      if (data.error) {
        setAppearanceError(data.error)
      } else {
        setAppearanceResult(data.appearancePrompts || { overview: "", prompts: {}, negativePrompt: "", consistencyNotes: [], characterName: sourceEntry.name })
      }
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Failed to generate appearance prompts")
    } finally {
      setAppearanceLoading(false)
    }
  }

  const copyAppearanceText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setAppearanceCopiedKey(key)
    setTimeout(() => setAppearanceCopiedKey(null), 1500)
  }

  const saveAppearanceToLore = async () => {
    if (!appearanceResult || !user || !projectId) return

    const now = Date.now()
    const targetEntry = selectedAppearanceEntry
    if (!targetEntry) return

    const promptSheet = buildAppearanceLoreContent(appearanceResult)
    const updatedEntry: BibleEntry = {
      ...targetEntry,
      content: `${targetEntry.content || ""}\n\n${promptSheet}`.trim(),
      updatedAt: now
    }

    const updated = bibleEntries.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry)
    setBibleEntries(updated)
    await saveStoryBibleLocal(projectId, updated)
    await saveBibleEntryToCloud(user.uid, projectId, updatedEntry)

    setActiveSidebarTab("bible")
    setIsLeftSidebarOpen(true)
    setActiveBibleEntryId(updatedEntry.id)
    setIsBibleDrawerOpen(true)
  }

  const selectedProgressionProfile = progressionProfiles.find(profile => profile.id === selectedProgressionProfileId) || null
  const selectedProgressionBibleEntry = progressionSelectedEntryId
    ? bibleEntries.find(entry => entry.id === progressionSelectedEntryId) || null
    : null

  useEffect(() => {
    if (selectedProgressionProfile) {
      setCharacterJsonText(JSON.stringify(selectedProgressionProfile.customJsonData || {}, null, 2))
    } else {
      setCharacterJsonText("")
    }
  }, [selectedProgressionProfileId, selectedProgressionProfile])

  const getNumericKeysOfJson = useCallback((obj: any, prefix = ""): string[] => {
    if (!obj || typeof obj !== "object") return []
    let keys: string[] = []
    Object.keys(obj).forEach(k => {
      const val = obj[k]
      const path = prefix ? `${prefix}.${k}` : k
      if (typeof val === "number") {
        keys.push(path)
      } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        keys = [...keys, ...getNumericKeysOfJson(val, path)]
      }
    })
    return keys
  }, [])

  useEffect(() => {
    if (progressionSystem.useCustomJsonTemplate && selectedProgressionProfile) {
      const keys = getNumericKeysOfJson(selectedProgressionProfile.customJsonData || {})
      if (keys.length > 0 && !keys.includes(selectedGraphStat)) {
        setSelectedGraphStat(keys[0])
      }
    }
  }, [progressionSystem.useCustomJsonTemplate, selectedProgressionProfileId, selectedProgressionProfile, getNumericKeysOfJson, selectedGraphStat])

  const getValueByPath = useCallback((obj: any, path: string): number => {
    const parts = path.split(".")
    let curr = obj
    for (const part of parts) {
      if (curr && typeof curr === "object" && part in curr) {
        curr = curr[part]
      } else {
        return 0
      }
    }
    return typeof curr === "number" ? curr : 0
  }, [])

  const saveCharacterJsonData = () => {
    if (!selectedProgressionProfile) return
    try {
      const parsed = JSON.parse(characterJsonText)
      if (parsed === null || typeof parsed !== "object") {
        throw new Error("Value must be a JSON object")
      }
      updateProgressionProfile(selectedProgressionProfile.id, (p) => ({
        ...p,
        customJsonData: parsed,
        updatedAt: Date.now()
      }))
      setProgressionNotice("Character JSON status updated!")
      setCharacterProfileSubTab('cards')
    } catch (err) {
      alert(`JSON Error: ${(err as Error).message}`)
    }
  }


  const renderCustomJsonValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined) {
      return <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", fontStyle: "italic" }}>Empty</span>
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", fontStyle: "italic" }}>No entries</span>
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.35rem" }}>
          {val.map((item, idx) => (
            <span key={idx} className="badge-skill-tag" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "4px", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </span>
          ))}
        </div>
      )
    }
    if (typeof val === "object") {
      const subKeys = Object.keys(val)
      if (subKeys.length === 0) return <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", fontStyle: "italic" }}>Empty object</span>
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.35rem" }}>
          {subKeys.map(subKey => (
            <div key={subKey} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderBottom: "1px solid rgba(255, 255, 255, 0.03)", paddingBottom: "0.15rem" }}>
              <span style={{ color: "var(--text-dim)", textTransform: "capitalize" }}>{subKey}:</span>
              <strong style={{ color: "var(--text-primary)" }}>{typeof val[subKey] === "object" ? JSON.stringify(val[subKey]) : String(val[subKey])}</strong>
            </div>
          ))}
        </div>
      )
    }
    return <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)", display: "block", marginTop: "0.2rem" }}>{String(val)}</strong>
  }

  const formatProgressionStatLabel = useCallback((key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, char => char.toUpperCase())
  }, [])

  const getCultivationValue = useCallback((realm?: string, stage?: string) => {
    const realms = progressionSystem.realms || []
    const stages = progressionSystem.stageLabels || []
    const rIdx = realm ? realms.indexOf(realm) : -1
    const sIdx = stage ? stages.indexOf(stage) : -1
    
    if (rIdx === -1) return 0
    const stagesCount = stages.length || 1
    const stageVal = sIdx >= 0 ? sIdx : 0
    return rIdx * stagesCount + stageVal
  }, [progressionSystem])

  const growthChartData = useMemo(() => {
    if (!selectedProgressionProfile) return []
    const history = [...selectedProgressionProfile.history].sort((a, b) => (a.appliedAt || 0) - (b.appliedAt || 0))
    
    if (progressionSystem.useCustomJsonTemplate) {
      const points: { chapterNumber: number; chapterTitle: string; value: number; label: string }[] = []
      
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i]
        const val = getValueByPath(entry.customJsonDataAfter || {}, selectedGraphStat)
        points.unshift({
          chapterNumber: entry.chapterNumber || 0,
          chapterTitle: entry.chapterTitle || "Untitled",
          value: val,
          label: `${selectedGraphStat.split('.').pop()}: ${val}`
        })
      }
      
      if (history.length > 0) {
        const firstEntry = history[0]
        const val = getValueByPath(firstEntry.customJsonDataBefore || {}, selectedGraphStat)
        points.unshift({
          chapterNumber: Math.max(0, (firstEntry.chapterNumber || 1) - 1),
          chapterTitle: "Before updates",
          value: val,
          label: `${selectedGraphStat.split('.').pop()}: ${val}`
        })
      }
      
      return points
    }

    let currentVal = 0
    if (selectedGraphStat === "level") {
      currentVal = selectedProgressionProfile.level || 0
    } else if (selectedGraphStat === "cultivation") {
      currentVal = getCultivationValue(selectedProgressionProfile.realm, selectedProgressionProfile.stage)
    } else {
      currentVal = selectedProgressionProfile.stats?.[selectedGraphStat as ProgressionStatKey] || 0
    }
    
    const points: { chapterNumber: number; chapterTitle: string; value: number; label: string }[] = []
    let runningStatVal = currentVal
    
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i]
      let val = 0
      let label = ""
      
      if (selectedGraphStat === "level") {
        val = entry.levelAfter || 0
        label = `Lv ${val}`
      } else if (selectedGraphStat === "cultivation") {
        val = getCultivationValue(entry.realmAfter, entry.stageAfter)
        label = entry.realmAfter && entry.stageAfter ? `${entry.realmAfter} (${entry.stageAfter})` : entry.realmAfter || entry.stageAfter || "Mortal"
      } else {
        val = runningStatVal
        label = `${formatProgressionStatLabel(selectedGraphStat)}: ${val}`
        const delta = entry.statChanges?.[selectedGraphStat as ProgressionStatKey] || 0
        runningStatVal -= delta
      }
      
      points.unshift({
        chapterNumber: entry.chapterNumber || 0,
        chapterTitle: entry.chapterTitle || "Untitled",
        value: val,
        label: label
      })
    }
    
    if (history.length > 0) {
      const firstEntry = history[0]
      let val = 0
      let label = ""
      if (selectedGraphStat === "level") {
        val = firstEntry.levelBefore || 0
        label = `Lv ${val}`
      } else if (selectedGraphStat === "cultivation") {
        val = getCultivationValue(firstEntry.realmBefore, firstEntry.stageBefore)
        label = firstEntry.realmBefore && firstEntry.stageBefore ? `${firstEntry.realmBefore} (${firstEntry.stageBefore})` : firstEntry.realmBefore || firstEntry.stageBefore || "Mortal"
      } else {
        const delta = firstEntry.statChanges?.[selectedGraphStat as ProgressionStatKey] || 0
        val = runningStatVal - delta
        label = `${formatProgressionStatLabel(selectedGraphStat)}: ${val}`
      }
      points.unshift({
        chapterNumber: Math.max(0, (firstEntry.chapterNumber || 1) - 1),
        chapterTitle: "Before updates",
        value: val,
        label: label
      })
    }
    
    return points
  }, [selectedProgressionProfile, selectedGraphStat, getCultivationValue, formatProgressionStatLabel, progressionSystem.useCustomJsonTemplate, getValueByPath])

  const diffLines = useMemo(() => {
    if (!activeNote || !selectedVersionForDiff) return { oldLines: [], newLines: [] }
    
    const oldStr = selectedVersionForDiff.content
    const newStr = activeNote.content
    
    const oldArr = oldStr.split('\n')
    const newArr = newStr.split('\n')
    
    const m = oldArr.length
    const n = newArr.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldArr[i - 1] === newArr[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }
    
    const oldLines: { text: string; type: 'unchanged' | 'removed' | 'empty' }[] = []
    const newLines: { text: string; type: 'unchanged' | 'added' | 'empty' }[] = []
    
    let i = m, j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldArr[i - 1] === newArr[j - 1]) {
        oldLines.unshift({ text: oldArr[i - 1], type: 'unchanged' })
        newLines.unshift({ text: newArr[j - 1], type: 'unchanged' })
        i--
        j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        oldLines.unshift({ text: '', type: 'empty' })
        newLines.unshift({ text: newArr[j - 1], type: 'added' })
        j--
      } else {
        oldLines.unshift({ text: oldArr[i - 1], type: 'removed' })
        newLines.unshift({ text: '', type: 'empty' })
        i--
      }
    }
    
    return { oldLines, newLines }
  }, [activeNote, selectedVersionForDiff])

  const [dailyWritingGoal, setDailyWritingGoal] = useState(() => {
    if (typeof window === "undefined") return 1000
    const stored = localStorage.getItem("penpad_daily_writing_goal")
    return stored ? Number(stored) : 1000
  })

  const handleDailyGoalChange = (val: number) => {
    setDailyWritingGoal(val)
    localStorage.setItem("penpad_daily_writing_goal", String(val))
  }

  const streaks = useMemo(() => {
    const dates = Object.keys(dailyWordLog)
      .filter(dateStr => dailyWordLog[dateStr] > 0)
      .map(dateStr => new Date(dateStr + "T00:00:00"))
      .sort((a, b) => a.getTime() - b.getTime())

    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 }

    let longest = 0
    let current = 0
    let tempStreak = 0
    let prevDate: Date | null = null

    for (let idx = 0; idx < dates.length; idx++) {
      const d = dates[idx]
      if (prevDate === null) {
        tempStreak = 1
      } else {
        const diffTime = Math.abs(d.getTime() - prevDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays <= 1) {
          tempStreak++
        } else {
          if (tempStreak > longest) longest = tempStreak
          tempStreak = 1
        }
      }
      prevDate = d
    }
    if (tempStreak > longest) longest = tempStreak

    const todayStr = new Date().toLocaleDateString('en-CA')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')

    const hasWrittenToday = (dailyWordLog[todayStr] || 0) > 0
    const hasWrittenYesterday = (dailyWordLog[yesterdayStr] || 0) > 0

    if (!hasWrittenToday && !hasWrittenYesterday) {
      current = 0
    } else {
      let runningStreak = 0
      const checkDate = hasWrittenToday ? new Date() : yesterday
      
      while (true) {
        const checkStr = checkDate.toLocaleDateString('en-CA')
        if ((dailyWordLog[checkStr] || 0) > 0) {
          runningStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
      current = runningStreak
    }

    return { currentStreak: current, longestStreak: longest }
  }, [dailyWordLog])

  const contributionGridDays = useMemo(() => {
    const days = []
    const today = new Date()
    const dayOfWeek = today.getDay()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + (6 - dayOfWeek))
    
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 111) // 16 weeks * 7 - 1
    
    const curr = new Date(startDate)
    while (curr <= endDate) {
      const dateStr = curr.toLocaleDateString('en-CA')
      const count = dailyWordLog[dateStr] || 0
      days.push({
        date: new Date(curr),
        dateStr,
        count
      })
      curr.setDate(curr.getDate() + 1)
    }
    return days
  }, [dailyWordLog])

  const formatProgressionDate = (timestamp?: number) => {
    if (!timestamp) return ""
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }



  const normalizeProgressionLookupText = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[\[\]#*_`"'.?!,;:(){}<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  const findProgressionSourceEntry = (selectedText: string) => {
    const cleanSelection = normalizeProgressionLookupText(selectedText)
    if (!cleanSelection) return null
    return bibleEntries.find(entry => {
      const aliases = getLoreAliases(entry).map(alias => normalizeProgressionLookupText(alias)).filter(Boolean)
      return aliases.some(alias => {
        if (alias === cleanSelection) return true
        if (cleanSelection.length >= 3 && alias.includes(cleanSelection)) return true
        return alias.length >= 3 && cleanSelection.includes(alias)
      })
    }) || null
  }

  const createProgressionSourceEntryFromHighlight = async (selectedText: string) => {
    if (!projectId) return null
    const cleanName = selectedText.replace(/\s+/g, " ").trim().replace(/^["'“”‘’]+|["'“”‘’.,!?;:]+$/g, "")
    if (!cleanName) return null
    const existing = findProgressionSourceEntry(cleanName)
    if (existing) return existing

    const now = Date.now()
    const newEntry: BibleEntry = {
      id: crypto.randomUUID(),
      name: cleanName,
      category: "character",
      content: activeNote
        ? `Created from highlighted text in ${activeNote.title || "the active chapter"}.`
        : "Created from highlighted text for progression tracking.",
      createdAt: now,
      updatedAt: now
    }
    const updated = [newEntry, ...bibleEntries]
    setBibleEntries(updated)
    await saveStoryBibleLocal(projectId, updated)
    if (user) {
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
    }
    return newEntry
  }

  const buildProgressionTargetEvidence = (entry: BibleEntry, chapterContent: string, selectedText: string) => {
    const aliases = Array.from(new Set([
      ...getLoreAliases(entry),
      selectedText
    ].map(alias => normalizeProgressionLookupText(alias)).filter(alias => alias.length >= 2)))

    if (aliases.length === 0 || !chapterContent.trim()) return ""

    const lines = chapterContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const matchedIndexes = new Set<number>()
    lines.forEach((line, index) => {
      const cleanLine = normalizeProgressionLookupText(line)
      if (aliases.some(alias => cleanLine.includes(alias))) {
        for (let offset = -2; offset <= 3; offset += 1) {
          const nearbyIndex = index + offset
          if (nearbyIndex >= 0 && nearbyIndex < lines.length) {
            matchedIndexes.add(nearbyIndex)
          }
        }
      }
    })

    const evidenceLines = Array.from(matchedIndexes)
      .sort((a, b) => a - b)
      .map(index => lines[index])

    return evidenceLines.join("\n").slice(0, 8000)
  }

  const getProgressionTemplateCardId = useCallback((label: string) => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card"
    return `template-${slug}`
  }, [])

  const inferProgressionTemplateCardType = useCallback((label: string): ProgressionTemplateCardType => {
    const cleanLabel = label.toLowerCase()
    if (/(ability|abilities|skill|technique|summon|art)\b/.test(cleanLabel)) return "ability"
    if (/(level[\s-]?up|counter|count|points available|available points)\b/.test(cleanLabel)) return "counter"
    if (/(bloodline|physique|attribute|affinity|element|custom|unnamed)\b/.test(cleanLabel)) return "compound"
    if (/(exp|experience|progress|points|xp)\b/.test(cleanLabel)) return "progress"
    if (/(hp|health|mana|qi|ki|stamina|energy|spirit|aura|essence|divinity)\b/.test(cleanLabel)) return "resource"
    if (/(realm|stage|rank|tier|grade|level|cultivation|class)\b/.test(cleanLabel)) return "rank"
    if (Object.keys(DEFAULT_PROGRESSION_STATS).some(stat => cleanLabel === stat || cleanLabel.includes(stat))) return "stat"
    return "text"
  }, [])

  const getProgressionCardColor = useCallback((index: number, type?: ProgressionTemplateCardType) => {
    if (type === "progress") return "lime"
    if (type === "ability") return "amber"
    if (type === "rank") return "violet"
    if (type === "resource") return "cyan"
    if (type === "stat") return "blue"
    if (type === "counter") return "fuchsia"
    return PROGRESSION_CARD_COLORS[index % PROGRESSION_CARD_COLORS.length]
  }, [])

  const normalizeProgressionTemplateCards = useCallback((
    cards?: Partial<ProgressionTemplateCard>[],
    customFields: string[] = []
  ): ProgressionTemplateCard[] => {
    const rawCards = Array.isArray(cards)
      ? cards.filter((card): card is Partial<ProgressionTemplateCard> => Boolean(card) && typeof card === "object")
      : []
    const source = cards === undefined ? DEFAULT_PROFILE_TEMPLATE_CARDS : rawCards
    const normalized = source
      .map((card, index) => {
        let label = String(card.label || card.sourceKey || `Card ${index + 1}`).trim()
        if (!label) return null
        if (label === "Spirit Affinity" || label === "Elemental Affinity") {
          label = "Affinity"
        }
        const type = card.type && PROGRESSION_TEMPLATE_CARD_TYPES.includes(card.type)
          ? card.type
          : inferProgressionTemplateCardType(label)
        let sourceKey = String(card.sourceKey || label).trim()
        if (sourceKey === "Spirit Affinity" || sourceKey === "Elemental Affinity") {
          sourceKey = "Affinity"
        }
        const rawFields = Array.isArray(card.fields)
          ? card.fields.map(field => {
              const f = String(field).trim()
              if (f === "Spirit Affinity" || f === "Elemental Affinity" || f === "Spirit Affinity Names" || f === "Elemental Affinity Names" || f === "Affinity") {
                return "Affinity Names"
              }
              if (f === "Spirit Affinity Ranks" || f === "Elemental Affinity Ranks" || f === "Spirit Affinity Grade" || f === "Elemental Affinity Grade" || f === "Affinity Rank" || f === "Affinity Ranks" || f === "Affinity Grade") {
                return "Rank"
              }
              return f
            }).filter(Boolean)
          : []
        const fields = getProgressionRankedTemplateFields(label, sourceKey, rawFields)
        return {
          id: card.id || getProgressionTemplateCardId(label),
          label,
          type,
          sourceKey,
          fields,
          color: card.color && PROGRESSION_CARD_COLORS.includes(card.color) ? card.color : getProgressionCardColor(index, type),
          enabled: card.enabled !== false
        }
      })
      .filter(Boolean) as ProgressionTemplateCard[]

    const seen = new Set<string>()
    const uniqueCards = normalized.filter(card => {
      const key = `${normalizeProgressionTemplateLookupKey(card.sourceKey)}::${normalizeProgressionTemplateLookupKey(card.label)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    customFields.forEach(fieldName => {
      let cleanName = String(fieldName || "").trim()
      if (!cleanName) return
      if (cleanName === "Spirit Affinity" || cleanName === "Elemental Affinity") {
        cleanName = "Affinity"
      }
      const companionKind = getRankedProgressionFieldKind(cleanName)
      if (isProgressionRankFieldName(cleanName)) {
        const hasParentCard = uniqueCards.some(card => {
          const cardKind = getRankedProgressionFieldKind(`${card.label} ${card.sourceKey} ${card.fields.join(" ")}`)
          if (companionKind && cardKind === companionKind) {
            return card.fields.some(field => !isProgressionRankFieldName(field))
          }
          return card.fields.some(field => field.toLowerCase() === cleanName.toLowerCase())
        })
        if (hasParentCard) return
      }
      const key = `${normalizeProgressionTemplateLookupKey(cleanName)}::${normalizeProgressionTemplateLookupKey(cleanName)}`
      if (seen.has(key)) return
      const type = inferProgressionTemplateCardType(cleanName)
      uniqueCards.push({
        id: getProgressionTemplateCardId(cleanName),
        label: cleanName,
        type,
        sourceKey: cleanName,
        fields: getProgressionRankedTemplateFields(cleanName, cleanName, [cleanName]),
        color: getProgressionCardColor(normalized.length, type),
        enabled: true
      })
      seen.add(key)
    })

    return uniqueCards
  }, [getProgressionCardColor, getProgressionTemplateCardId, inferProgressionTemplateCardType])

  const parseProgressionRatio = (value: string | number | undefined) => {
    if (typeof value === "number") return { current: value, max: 100 }
    const cleanValue = String(value || "").trim()
    const match = cleanValue.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    if (!match) return null
    const current = Number(match[1])
    const max = Number(match[2])
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return null
    return { current, max }
  }

  const getProgressionCustomFieldValue = (profile: CharacterProgressionProfile, key: string) => {
    const customFields = profile.customFields || {}
    const direct = customFields[key]
    if (direct) return direct
    const foundKey = Object.keys(customFields).find(fieldName => fieldName.toLowerCase() === key.toLowerCase())
    return foundKey ? customFields[foundKey] : ""
  }

  const getProgressionRankedFieldValue = (profile: CharacterProgressionProfile, card: ProgressionTemplateCard, fieldName: string) => {
    const cardContext = `${card.label} ${card.sourceKey} ${card.fields.join(" ")}`
    const kind = getRankedProgressionFieldKind(`${cardContext} ${fieldName}`)
    if (!kind) return ""

    const labelCandidates = Array.from(new Set([
      fieldName,
      card.sourceKey,
      card.label,
      kind === "bloodline" ? "Bloodline" : "Affinity",
      kind === "bloodline" ? "Bloodline Name" : "Affinity Names",
      kind === "bloodline" ? "Bloodline Type" : "Elemental Affinity",
      "Spirit Affinity",
      "Affinity Names",
      "Elemental Affinity",
      "Spirit Affinity"
    ].filter(Boolean)))
    const rankCandidates = Array.from(new Set([
      fieldName,
      `${card.label} Rank`,
      `${card.label} Ranks`,
      `${card.label} Grade`,
      `${card.label} Grades`,
      `${card.sourceKey} Rank`,
      `${card.sourceKey} Ranks`,
      `${card.sourceKey} Grade`,
      `${card.sourceKey} Grades`,
      kind === "bloodline" ? "Bloodline Rank" : "Affinity Rank",
      kind === "bloodline" ? "Bloodline Grade" : "Affinity Grade",
      kind === "bloodline" ? "Bloodline Ranks" : "Affinity Ranks",
      kind === "bloodline" ? "Bloodline Grades" : "Affinity Grades",
      kind === "bloodline" ? "Bloodline Quality" : "Elemental Affinity Rank",
      kind === "bloodline" ? "Bloodline Tier" : "Elemental Affinity Grade",
      kind === "bloodline" ? "Bloodline Realm" : "Spirit Affinity Ranks",
      kind === "bloodline" ? "Bloodline Stage" : "Spirit Affinity Grade",
      "Affinity Rank",
      "Affinity Ranks",
      "Affinity Grade",
      "Affinity Grades",
      "Elemental Affinity Rank",
      "Elemental Affinity Grade",
      "Spirit Affinity Ranks",
      "Spirit Affinity Grade",
      "Rank"
    ].filter(Boolean)))

    const candidates = isProgressionRankFieldName(fieldName) ? rankCandidates : labelCandidates
    for (const candidate of candidates) {
      const value = getProgressionCustomFieldValue(profile, candidate)
      if (value) return value
    }
    return ""
  }

  const getProgressionTemplateFieldValue = (profile: CharacterProgressionProfile, card: ProgressionTemplateCard, fieldName: string) => {
    const cleanField = fieldName.toLowerCase()
    const cleanCard = card.label.toLowerCase()
    const rankedFieldValue = getProgressionRankedFieldValue(profile, card, fieldName)
    if (rankedFieldValue) return rankedFieldValue
    if (cleanField === "name") return profile.name
    if (cleanField === "title") return profile.title
    if (cleanField === "cultivation stage" || cleanField === "realm") return profile.realm || getProgressionCustomFieldValue(profile, "Cultivation Stage")
    if (cleanField === "stage") return profile.stage || getProgressionCustomFieldValue(profile, "Stage")
    if (cleanField === "rank") return profile.stage || profile.rank || getProgressionCustomFieldValue(profile, "Rank")
    if (cleanField === "realm") return profile.realm
    if (cleanField === "class" || cleanField === "job class") return profile.className
    if (cleanField === "lore" || cleanField === "notes") return profile.notes
    if (cleanField === "level") return String(profile.level || "")
    if (cleanField === "description") return profile.notes
    if (cleanField === "bloodline name") return getProgressionCustomFieldValue(profile, "Bloodline Name") || getProgressionCustomFieldValue(profile, "Bloodline")
    if (cleanField === "affinity names") return getProgressionCustomFieldValue(profile, "Affinity Names") || getProgressionCustomFieldValue(profile, "Affinity") || getProgressionCustomFieldValue(profile, "Spirit Affinity") || getProgressionCustomFieldValue(profile, "Elemental Affinity")
    if (cleanField === "physique name") return getProgressionCustomFieldValue(profile, "Physique Name") || getProgressionCustomFieldValue(profile, "Physique")
    if (cleanField === "exp") return `${profile.exp}/${profile.nextLevelExp}`

    const statKey = cleanField.replace(/\s+/g, "") as ProgressionStatKey
    const directStatKey = Object.keys(profile.stats).find(key => key.toLowerCase() === cleanField || key.toLowerCase() === statKey)
    if (directStatKey) return String(profile.stats[directStatKey as ProgressionStatKey] ?? "")

    return getProgressionCustomFieldValue(profile, fieldName)
      || getProgressionCustomFieldValue(profile, `${card.label} ${fieldName}`)
      || getProgressionCustomFieldValue(profile, `${card.label} - ${fieldName}`)
      || getProgressionCustomFieldValue(profile, `${cleanCard}.${cleanField}`)
  }

  const getProgressionTemplateCardFields = (profile: CharacterProgressionProfile, card: ProgressionTemplateCard) => {
    const fields = card.fields.length > 0 ? card.fields : [card.label]
    return fields.map(fieldName => ({
      label: fieldName,
      value: getProgressionTemplateFieldValue(profile, card, fieldName)
    }))
  }

  const getProgressionTemplateCardValue = (profile: CharacterProgressionProfile, card: ProgressionTemplateCard) => {
    const sourceKey = card.sourceKey || card.label
    const cleanSource = sourceKey.toLowerCase()
    if (cleanSource === "name") return profile.name
    if (cleanSource === "cultivationstage" || cleanSource === "cultivation") return [profile.realm, profile.stage || profile.rank].filter(Boolean).join(" - ")
    if (cleanSource === "levelrank") return progressionSystem.showLevels ? `Level ${profile.level}` : profile.stage || profile.rank
    if (cleanSource === "classname" || cleanSource === "class") return profile.className
    if (cleanSource === "title") return profile.title
    if (cleanSource === "notes" || cleanSource === "lore") return profile.notes
    if (cleanSource === "nicknames") return profile.nicknames?.join(", ")
    if (cleanSource === "uniquetrait" || cleanSource === "unique trait") return profile.uniqueTrait || getProgressionCustomFieldValue(profile, "Unique Trait")
    if (cleanSource === "cultivationpath" || cleanSource === "path") return profile.cultivationPath
    if (cleanSource === "exp" || cleanSource === "experience") return `${profile.exp}/${profile.nextLevelExp}`
    if (cleanSource in profile.stats) return String(profile.stats[cleanSource as ProgressionStatKey] ?? "")
    return getProgressionCustomFieldValue(profile, sourceKey)
  }

  const getProgressionTemplateCardsForProfile = (profile: CharacterProgressionProfile) => {
    const configuredCards = normalizeProgressionTemplateCards(
      progressionSystem?.profileTemplate?.cards,
      Array.from(new Set([...(progressionSystem?.customFields || []), ...Object.keys(profile.customFields || {})]))
    )
    return configuredCards.filter(card => card.enabled)
  }

  const getProgressionCustomFieldsFromTemplateCards = (cards: ProgressionTemplateCard[]) => {
    const fields = new Set<string>()
    cards.forEach(card => {
      const cardKind = getRankedProgressionFieldKind(`${card.label} ${card.sourceKey} ${card.fields.join(" ")}`)
      if (card.sourceKey && !isDirectProgressionTemplateKey(card.sourceKey)) {
        fields.add(card.sourceKey)
      }
      card.fields.forEach(fieldName => {
        const isRankedCompanion = Boolean(cardKind && isProgressionRankFieldName(fieldName))
        if (fieldName && (isRankedCompanion || card.type === "counter" || !isDirectProgressionTemplateKey(fieldName))) {
          fields.add(fieldName)
        }
      })
    })
    return Array.from(fields)
  }

  const setProgressionTemplateCards = (updater: (cards: ProgressionTemplateCard[]) => ProgressionTemplateCard[]) => {
    const currentCards = normalizeProgressionTemplateCards(progressionSystem?.profileTemplate?.cards, progressionSystem?.customFields || [])
    const nextCards = updater(currentCards)
    const enabledCards = nextCards.filter(card => card.enabled)
    const nextCustomFields = getProgressionCustomFieldsFromTemplateCards(enabledCards)

    // Clean up defaultCustomFields to remove keys that are no longer in nextCustomFields
    const nextDefaultCustomFields = { ...(progressionSystem?.profileTemplate?.defaultCustomFields || {}) }
    Object.keys(nextDefaultCustomFields).forEach(key => {
      if (!nextCustomFields.includes(key)) {
        delete nextDefaultCustomFields[key]
      }
    })

    // Also clean up all character profiles to remove custom fields that are no longer in nextCustomFields
    const updatedProfiles = progressionProfiles.map(profile => {
      const nextProfileCustomFields = { ...(profile.customFields || {}) }
      let changed = false
      Object.keys(nextProfileCustomFields).forEach(key => {
        if (!nextCustomFields.includes(key) && !["Affiliation", "Bloodline", "Race"].includes(key)) {
          delete nextProfileCustomFields[key]
          changed = true
        }
      })
      return changed ? { ...profile, customFields: nextProfileCustomFields, updatedAt: Date.now() } : profile
    })

    const hasChanges = updatedProfiles.some((p, idx) => p !== progressionProfiles[idx])
    if (hasChanges) {
      persistProgressionProfiles(updatedProfiles)
    }

    persistProgressionSystem({
      ...progressionSystem,
      customFields: nextCustomFields,
      profileTemplate: {
        ...(progressionSystem?.profileTemplate || DEFAULT_PROFILE_TEMPLATE),
        defaultCustomFields: nextDefaultCustomFields,
        cards: nextCards
      }
    })
  }

  const removeProgressionTemplateCard = (cardId: string) => {
    setProgressionTemplateCards(cards => cards.filter(card => card.id !== cardId))
  }

  const deleteEntireTemplate = () => {
    // Clean up all character profiles
    const updatedProfiles = progressionProfiles.map(profile => {
      return {
        ...profile,
        realm: "",
        stage: "",
        level: 1,
        rank: "",
        exp: 0,
        nextLevelExp: 100,
        stats: {} as Record<ProgressionStatKey, number>,
        customFields: {},
        abilities: [],
        traits: [],
        updatedAt: Date.now()
      }
    })
    persistProgressionProfiles(updatedProfiles)

    // Reset progression settings to a completely empty template
    const emptySystem: ProgressionSystemSettings = {
      realms: [],
      stageLabels: [],
      showLevels: false,
      showExp: false,
      showStats: false,
      statKeys: [],
      customFields: [],
      profileTemplate: {
        ...DEFAULT_PROFILE_TEMPLATE,
        defaultStats: {} as Record<ProgressionStatKey, number>,
        defaultTraits: [],
        defaultAbilities: [],
        defaultCustomFields: {},
        cards: [],
        notes: "Template cleared.",
        enabled: true
      },
      notes: ""
    }

    persistProgressionSystem(emptySystem)
    setProgressionNotice("The progression template and all character stats have been completely deleted/reset.")
  }

  const copyProgressionTemplateToClipboard = () => {
    try {
      const exportData = {
        realms: progressionSystem.realms,
        stageLabels: progressionSystem.stageLabels,
        showLevels: progressionSystem.showLevels,
        showExp: progressionSystem.showExp,
        showStats: progressionSystem.showStats,
        statKeys: progressionSystem.statKeys,
        customFields: progressionSystem.customFields,
        profileTemplate: progressionSystem.profileTemplate,
        notes: progressionSystem.notes
      }
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setProgressionNotice("Template settings copied to clipboard! You can now paste this into another novel.")
    } catch (e) {
      console.error(e)
      setProgressionError("Failed to copy template to clipboard.")
    }
  }

  const pasteProgressionTemplateFromClipboard = () => {
    const jsonStr = window.prompt("Paste the progression template JSON here:")
    if (!jsonStr) return
    try {
      const parsed = JSON.parse(jsonStr)
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid template format: Must be an object")
      }
      
      const newSystem = normalizeProgressionSystem(parsed)
      persistProgressionSystem(newSystem)
      setProgressionNotice("Progression template successfully imported from clipboard!")
    } catch (e) {
      console.error(e)
      setProgressionError(e instanceof Error ? `Import failed: ${e.message}` : "Failed to import template.")
    }
  }

  const addProgressionPresetCard = (preset: ProgressionTemplateCard) => {
    const currentCards = normalizeProgressionTemplateCards(progressionSystem?.profileTemplate?.cards, progressionSystem?.customFields || [])
    const presetMatchKey = `${normalizeProgressionTemplateLookupKey(preset.sourceKey)}::${normalizeProgressionTemplateLookupKey(preset.label)}`
    let matched = false
    const nextCards = currentCards.map(card => {
      const cardMatchKey = `${normalizeProgressionTemplateLookupKey(card.sourceKey)}::${normalizeProgressionTemplateLookupKey(card.label)}`
      if (card.id === preset.id || cardMatchKey === presetMatchKey) {
        matched = true
        return {
          ...preset,
          ...card,
          id: card.id || preset.id,
          fields: card.fields.length > 0 ? card.fields : preset.fields,
          color: card.color || preset.color,
          enabled: true
        }
      }
      return card
    })
    if (!matched) {
      nextCards.push({ ...preset, id: `${preset.id}-${crypto.randomUUID()}` })
    }

    persistProgressionSystem({
      ...progressionSystem,
      customFields: Array.from(new Set([
        ...(progressionSystem?.customFields || []),
        ...getProgressionCustomFieldsFromTemplateCards(nextCards)
      ])),
      profileTemplate: {
        ...(progressionSystem?.profileTemplate || DEFAULT_PROFILE_TEMPLATE),
        cards: nextCards
      }
    })
    setProgressionNotice(`${preset.label} card added to the profile template.`)
  }

  const reorderProgressionTemplateCard = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setProgressionTemplateCards(cards => {
      const fromIndex = cards.findIndex(card => card.id === draggedId)
      const toIndex = cards.findIndex(card => card.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return cards
      const reordered = [...cards]
      const [movedCard] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, movedCard)
      return reordered
    })
  }

  const addProgressionTemplateField = (cardId: string) => {
    setProgressionTemplateCards(cards => cards.map(card => {
      if (card.id !== cardId) return card
      const baseName = "New Field"
      let nextName = baseName
      let suffix = 2
      while (card.fields.some(field => field.toLowerCase() === nextName.toLowerCase())) {
        nextName = `${baseName} ${suffix}`
        suffix += 1
      }
      return { ...card, fields: [...card.fields, nextName] }
    }))
  }

  const updateProgressionTemplateField = (cardId: string, fieldIndex: number, value: string) => {
    setProgressionTemplateCards(cards => cards.map(card => card.id === cardId ? {
      ...card,
      fields: card.fields.map((field, index) => index === fieldIndex ? value : field).filter(field => field.trim())
    } : card))
  }

  const removeProgressionTemplateField = (cardId: string, fieldIndex: number) => {
    setProgressionTemplateCards(cards => cards.map(card => card.id === cardId ? {
      ...card,
      fields: card.fields.filter((_, index) => index !== fieldIndex)
    } : card))
  }

  const handleCultivationRealmImport = async (rawText?: string) => {
    const text = (rawText ?? progressionRealmImportText).trim()
    if (!text || progressionRealmImportLoading) return
    setProgressionRealmImportLoading(true)
    setProgressionError("")
    setProgressionNotice("")

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cultivation_realm_import",
          rawText: text,
          currentSettings: progressionSystem
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not import cultivation stages.")
      }

      const importedSettings = data.imported?.settings || {}
      persistProgressionSystem({
        ...progressionSystem,
        ...importedSettings,
        customFields: Array.from(new Set([
          ...progressionSystem.customFields,
          ...(Array.isArray(importedSettings.customFields) ? importedSettings.customFields : [])
        ].map(item => String(item).trim()).filter(Boolean))),
        profileTemplate: progressionSystem.profileTemplate,
        notes: importedSettings.notes || progressionSystem.notes
      })
      setProgressionRealmImportText("")
      setIsProgressionCultivationImportOpen(false)
      setProgressionNotice("Cultivation stages imported. The AI will use this realm order when updating profiles.")
    } catch (err) {
      setProgressionError(err instanceof Error ? err.message : "Failed to import cultivation stages.")
    } finally {
      setProgressionRealmImportLoading(false)
    }
  }

  const handleCultivationRealmFileUpload = async (file?: File | null) => {
    if (!file) return
    const text = await file.text()
    setProgressionRealmImportText(text)
    await handleCultivationRealmImport(text)
  }

  const handleDesignTemplateWithAi = async () => {
    if (!progressionTemplatePrompt.trim() || progressionTemplatePromptLoading) return
    setProgressionTemplatePromptLoading(true)
    setProgressionTemplatePromptError("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progression_template_design",
          prompt: progressionTemplatePrompt,
          currentSettings: progressionSystem
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not design the profile template.")
      }

      const importedSettings = data.imported?.settings || {}
      const importedTemplate = importedSettings.profileTemplate || {}
      const rawDesignedCards = Array.isArray(importedTemplate.cards) ? importedTemplate.cards : []
      if (rawDesignedCards.length === 0) {
        throw new Error("The AI response did not include any template cards. Try describing the exact cards you want.")
      }
      const designedCards = normalizeProgressionTemplateCards(rawDesignedCards, Array.isArray(importedSettings.customFields) ? importedSettings.customFields : [])
      const designedCustomFields = Array.from(new Set([
        ...(Array.isArray(importedSettings.customFields) ? importedSettings.customFields.map((item: unknown) => String(item).trim()).filter(Boolean) : []),
        ...Object.keys(importedTemplate.defaultCustomFields || {}),
        ...getProgressionCustomFieldsFromTemplateCards(designedCards)
      ]))

      persistProgressionSystem({
        ...progressionSystem,
        ...importedSettings,
        customFields: designedCustomFields,
        profileTemplate: {
          ...DEFAULT_PROFILE_TEMPLATE,
          ...importedTemplate,
          cards: designedCards,
          enabled: true
        }
      })
      setProgressionTemplatePrompt("")
      setIsProgressionPromptDesignerOpen(false)
      setProgressionNotice("Profile template successfully redesigned by AI.")
    } catch (err) {
      setProgressionTemplatePromptError(err instanceof Error ? err.message : "Failed to design the template.")
    } finally {
      setProgressionTemplatePromptLoading(false)
    }
  }

  const normalizeProgressionProfile = (
    sourceEntry: BibleEntry,
    aiProfile: Partial<CharacterProgressionProfile> | undefined,
    existingProfile: CharacterProgressionProfile | undefined,
    historyEntry: ProgressionHistoryEntry,
    now: number
  ): CharacterProgressionProfile => {
    const sharedTemplate = progressionSystem.profileTemplate?.enabled ? progressionSystem.profileTemplate : DEFAULT_PROFILE_TEMPLATE
    const rawAbilities = Array.isArray(aiProfile?.abilities)
      ? aiProfile?.abilities || []
      : existingProfile?.abilities || sharedTemplate.defaultAbilities || []
    const abilities = rawAbilities.map((abilityItem, index) => {
      const ability = typeof abilityItem === "object" && abilityItem !== null
        ? abilityItem as unknown as Record<string, unknown>
        : { name: String(abilityItem) }
      return {
        id: String(ability.id || `${ability.name || "ability"}-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: String(ability.name || `Ability ${index + 1}`),
        level: Number.isFinite(Number(ability.level)) ? Number(ability.level) : 1,
        rank: String(ability.rank || ""),
        description: String(ability.description || ""),
        evidence: String(ability.evidence || "")
      }
    })
    const customFields = {
      ...(existingProfile?.customFields || {}),
      ...(aiProfile?.customFields || {})
    }
    customFields.Bloodline = customFields.Bloodline || customFields["Bloodline Name"] || ""
    customFields["Bloodline Rank"] = customFields["Bloodline Rank"] || customFields["Bloodline Grade"] || customFields["Bloodline Quality"] || ""

    return {
      id: existingProfile?.id || crypto.randomUUID(),
      loreEntryId: sourceEntry.id,
      name: aiProfile?.name || existingProfile?.name || sourceEntry.name,
      title: aiProfile?.title || existingProfile?.title || "",
      className: aiProfile?.className || existingProfile?.className || sharedTemplate.defaultClassName || "",
      rank: aiProfile?.rank || existingProfile?.rank || sharedTemplate.defaultRank || "",
      nicknames: Array.isArray(aiProfile?.nicknames) ? aiProfile.nicknames : existingProfile?.nicknames || [],
      uniqueTrait: aiProfile?.uniqueTrait || existingProfile?.uniqueTrait || "",
      realm: aiProfile?.realm || existingProfile?.realm || sharedTemplate.defaultRealm || "",
      stage: aiProfile?.stage || existingProfile?.stage || sharedTemplate.defaultStage || "",
      cultivationPath: aiProfile?.cultivationPath || existingProfile?.cultivationPath || sharedTemplate.defaultCultivationPath || "",
      level: Number.isFinite(Number(aiProfile?.level)) ? Number(aiProfile?.level) : existingProfile?.level || sharedTemplate.baseLevel || 1,
      exp: Number.isFinite(Number(aiProfile?.exp)) ? Number(aiProfile?.exp) : existingProfile?.exp || sharedTemplate.baseExp || 0,
      nextLevelExp: Number.isFinite(Number(aiProfile?.nextLevelExp)) ? Number(aiProfile?.nextLevelExp) : existingProfile?.nextLevelExp || sharedTemplate.nextLevelExp || 100,
      stats: { ...DEFAULT_PROGRESSION_STATS, ...(sharedTemplate.defaultStats || {}), ...(existingProfile?.stats || {}), ...(aiProfile?.stats || {}) },
      abilities,
      traits: Array.isArray(aiProfile?.traits) ? aiProfile?.traits || [] : existingProfile?.traits || sharedTemplate.defaultTraits || [],
      customFields,
      notes: aiProfile?.notes || existingProfile?.notes || sharedTemplate.notes || "",
      customJsonData: {
        ...(() => {
          if (progressionSystem.useCustomJsonTemplate && progressionSystem.customJsonTemplate) {
            try {
              return JSON.parse(progressionSystem.customJsonTemplate)
            } catch {}
          }
          return {}
        })(),
        ...(existingProfile?.customJsonData || {}),
        ...(aiProfile?.customJsonData || {})
      },
      processedChapterIds: Array.from(new Set([...(existingProfile?.processedChapterIds || []), historyEntry.chapterId])),
      history: [
        historyEntry,
        ...(existingProfile?.history || []).filter(entry => entry.chapterId !== historyEntry.chapterId)
      ],
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now
    }
  }

  const createFallbackProgressionProfile = (
    sourceEntry: BibleEntry,
    existingProfile: CharacterProgressionProfile | undefined,
    chapterNumber: number | null,
    summary: string,
    now: number
  ): CharacterProgressionProfile => {
    const sharedTemplate = progressionSystem.profileTemplate?.enabled ? progressionSystem.profileTemplate : DEFAULT_PROFILE_TEMPLATE
    const historyEntry: ProgressionHistoryEntry | null = activeNote ? {
      id: crypto.randomUUID(),
      chapterId: activeNote.id,
      chapterTitle: activeNote.title || "Untitled",
      chapterNumber,
      appliedAt: now,
      summary,
      levelBefore: existingProfile?.level || sharedTemplate.baseLevel || 1,
      levelAfter: existingProfile?.level || sharedTemplate.baseLevel || 1,
      realmBefore: existingProfile?.realm || "",
      realmAfter: existingProfile?.realm || sharedTemplate.defaultRealm || "",
      stageBefore: existingProfile?.stage || "",
      stageAfter: existingProfile?.stage || sharedTemplate.defaultStage || "",
      statChanges: {},
      abilityChanges: [],
      rewards: [],
      evidence: []
    } : null
    const customFields = { ...(existingProfile?.customFields || {}) }
    customFields.Bloodline = customFields.Bloodline || customFields["Bloodline Name"] || ""
    customFields["Bloodline Rank"] = customFields["Bloodline Rank"] || customFields["Bloodline Grade"] || customFields["Bloodline Quality"] || ""

    return {
      id: existingProfile?.id || crypto.randomUUID(),
      loreEntryId: sourceEntry.id,
      name: existingProfile?.name || sourceEntry.name,
      title: existingProfile?.title || "",
      className: existingProfile?.className || sharedTemplate.defaultClassName || "",
      rank: existingProfile?.rank || sharedTemplate.defaultRank || "",
      nicknames: existingProfile?.nicknames || [],
      uniqueTrait: existingProfile?.uniqueTrait || "",
      realm: existingProfile?.realm || sharedTemplate.defaultRealm || "",
      stage: existingProfile?.stage || sharedTemplate.defaultStage || "",
      cultivationPath: existingProfile?.cultivationPath || sharedTemplate.defaultCultivationPath || "",
      level: existingProfile?.level || sharedTemplate.baseLevel || 1,
      exp: existingProfile?.exp || sharedTemplate.baseExp || 0,
      nextLevelExp: existingProfile?.nextLevelExp || sharedTemplate.nextLevelExp || 100,
      stats: { ...DEFAULT_PROGRESSION_STATS, ...(sharedTemplate.defaultStats || {}), ...(existingProfile?.stats || {}) },
      abilities: existingProfile?.abilities || sharedTemplate.defaultAbilities || [],
      traits: existingProfile?.traits || sharedTemplate.defaultTraits || [],
      customFields,
      notes: existingProfile?.notes || sourceEntry.content || sharedTemplate.notes || "",
      processedChapterIds: historyEntry
        ? Array.from(new Set([...(existingProfile?.processedChapterIds || []), historyEntry.chapterId]))
        : existingProfile?.processedChapterIds || [],
      history: historyEntry
        ? [
          historyEntry,
          ...(existingProfile?.history || []).filter(entry => entry.chapterId !== historyEntry.chapterId)
        ]
        : existingProfile?.history || [],
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now
    }
  }

  const handleProgressionUpdate = async (entryId?: string | null, selectedTextOverride?: string) => {
    if (!projectId) {
      setProgressionError("Open a project first.")
      return
    }

    const selectedText = (selectedTextOverride ?? aiSelectionText).trim()
    const selectedDropdownEntry = progressionSelectedEntryId
      ? bibleEntries.find(entry => entry.id === progressionSelectedEntryId)
      : null
    const selectedProfileEntry = selectedProgressionProfile
      ? bibleEntries.find(entry => entry.id === selectedProgressionProfile.loreEntryId)
      : null
    const highlightedEntry = selectedText ? findProgressionSourceEntry(selectedText) : null
    let sourceEntry = entryId
      ? bibleEntries.find(entry => entry.id === entryId)
      : highlightedEntry || selectedDropdownEntry || selectedProfileEntry

    if (!sourceEntry && selectedText) {
      sourceEntry = await createProgressionSourceEntryFromHighlight(selectedText)
    }

    if (!sourceEntry && (selectedText || progressionProfiles.length === 0)) {
      setProgressionError("Highlight a Story Bible character name or select a profile first.")
      return
    }

    const existingProfile = sourceEntry ? progressionProfiles.find(profile => profile.loreEntryId === sourceEntry.id) : undefined
    if (!activeNote && sourceEntry) {
      const now = Date.now()
      const nextProfile = createFallbackProgressionProfile(sourceEntry, existingProfile, null, "Created a base progression profile from the selected Story Bible entry.", now)
      const nextProfiles = existingProfile
        ? progressionProfiles.map(profile => profile.id === existingProfile.id ? nextProfile : profile)
        : [nextProfile, ...progressionProfiles]
      persistProgressionProfiles(nextProfiles)
      setSelectedProgressionProfileId(nextProfile.id)
      setProgressionSelectedEntryId(sourceEntry.id)
      setProgressionError("")
      setProgressionNotice(`Created ${sourceEntry.name}'s progression profile. Select a chapter and update later for chapter-based growth.`)
      setActiveSidebarTab("progression")
      setIsLeftSidebarOpen(true)
      return
    }

    if (!activeNote) {
      setProgressionError("Select a chapter first.")
      return
    }

    setProgressionLoading(true)
    setProgressionError("")
    setProgressionNotice("")
    setActiveSidebarTab("progression")
    setIsLeftSidebarOpen(true)

    try {
      const chapterNumber = getNoteChapterNumber(activeNote)
      const selectedTextForAi = sourceEntry && highlightedEntry?.id !== sourceEntry.id ? "" : selectedText
      const targetEvidence = sourceEntry ? buildProgressionTargetEvidence(sourceEntry, activeNote.content, selectedTextForAi) : ""
      const chapterContentForAi = activeNote.content.slice(0, 22000)
      const candidateProfilesForAi = sourceEntry
        ? progressionProfiles
          .filter(profile => profile.loreEntryId === sourceEntry.id)
          .map(profile => ({
            id: profile.id,
            loreEntryId: profile.loreEntryId,
            name: profile.name,
            title: profile.title,
            realm: profile.realm,
            stage: profile.stage,
            rank: profile.rank,
            bloodline: profile.customFields?.Bloodline || "",
            bloodlineRank: profile.customFields?.["Bloodline Rank"] || profile.customFields?.["Bloodline Grade"] || "",
            className: profile.className,
            skills: profile.abilities?.map(ability => ability.name).filter(Boolean),
            lore: profile.notes,
            level: profile.level,
            processedChapterIds: profile.processedChapterIds
          }))
        : progressionProfiles.map(profile => ({
          id: profile.id,
          loreEntryId: profile.loreEntryId,
          name: profile.name,
          title: profile.title,
          realm: profile.realm,
          stage: profile.stage,
          rank: profile.rank,
          bloodline: profile.customFields?.Bloodline || "",
          bloodlineRank: profile.customFields?.["Bloodline Rank"] || profile.customFields?.["Bloodline Grade"] || "",
          className: profile.className,
          skills: profile.abilities?.map(ability => ability.name).filter(Boolean),
          lore: profile.notes,
          level: profile.level,
          processedChapterIds: profile.processedChapterIds
        }))
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progression_update",
          selectedText: selectedTextForAi,
          loreEntry: sourceEntry ? {
            id: sourceEntry.id,
            name: sourceEntry.name,
            category: sourceEntry.category,
            content: sourceEntry.content,
            groups: (sourceEntry.groupIds || [])
              .map(groupId => bibleGroups.find(group => group.id === groupId)?.name)
              .filter(Boolean)
          } : null,
          chapter: {
            id: activeNote.id,
            title: activeNote.title,
            chapterNumber,
            content: chapterContentForAi,
            targetEvidence
          },
          progressionSystem,
          existingProfile,
          candidateProfiles: candidateProfilesForAi,
          candidateLoreEntries: sourceEntry ? [] : bibleEntries
            .filter(entry => entry.category === "character" || entry.category === "beast")
            .slice(0, 80)
            .map(entry => ({
              id: entry.id,
              name: entry.name,
              category: entry.category,
              aliases: getLoreAliases(entry),
              content: (entry.content || "").slice(0, 1200)
            })),
          memory: buildStoryMemoryContext()
        })
      })
      const data = await res.json()
      if (data.error) {
        if (sourceEntry) {
          const now = Date.now()
          const chapterNumber = getNoteChapterNumber(activeNote)
          const fallbackProfile = createFallbackProgressionProfile(sourceEntry, existingProfile, chapterNumber, "Created a base progression profile because AI progression update failed.", now)
          const fallbackProfiles = existingProfile
            ? progressionProfiles.map(profile => profile.id === existingProfile.id ? fallbackProfile : profile)
            : [fallbackProfile, ...progressionProfiles]
          persistProgressionProfiles(fallbackProfiles)
          setSelectedProgressionProfileId(fallbackProfile.id)
          setProgressionSelectedEntryId(sourceEntry.id)
          setProgressionNotice(`Created ${sourceEntry.name}'s profile. AI update can be retried later.`)
          return
        }
        setProgressionError(data.error)
        return
      }

      const progression = (data.progression || {}) as ProgressionAiResponse
      const finalSourceEntry = sourceEntry
        || bibleEntries.find(entry => entry.id === progression.targetLoreEntryId)
        || bibleEntries.find(entry => entry.id === progression.profile?.loreEntryId)
        || bibleEntries.find(entry => String(entry.name || "").toLowerCase() === String(progression.profile?.name || "").toLowerCase())
      if (!finalSourceEntry) {
        setProgressionError("The AI could not determine which progression profile this chapter should update.")
        return
      }
      const finalExistingProfile = progressionProfiles.find(profile => profile.loreEntryId === finalSourceEntry.id)
      const wasChapterReviewed = Boolean(finalExistingProfile?.processedChapterIds?.includes(activeNote.id))
      const now = Date.now()
      const aiUpdate = progression.update || {}
      const levelBefore = aiUpdate.levelBefore ?? finalExistingProfile?.level ?? 1
      const levelAfter = aiUpdate.levelAfter ?? progression.profile?.level ?? levelBefore
      const historyEntry: ProgressionHistoryEntry = {
        id: crypto.randomUUID(),
        chapterId: activeNote.id,
        chapterTitle: activeNote.title || "Untitled",
        chapterNumber,
        appliedAt: now,
        summary: aiUpdate.summary || "Progression profile reviewed from this chapter.",
        levelBefore,
        levelAfter,
        realmBefore: aiUpdate.realmBefore ?? finalExistingProfile?.realm ?? "",
        realmAfter: aiUpdate.realmAfter ?? progression.profile?.realm ?? finalExistingProfile?.realm ?? "",
        stageBefore: aiUpdate.stageBefore ?? finalExistingProfile?.stage ?? "",
        stageAfter: aiUpdate.stageAfter ?? progression.profile?.stage ?? finalExistingProfile?.stage ?? "",
        statChanges: aiUpdate.statChanges || {},
        abilityChanges: Array.isArray(aiUpdate.abilityChanges) ? aiUpdate.abilityChanges : [],
        rewards: Array.isArray(aiUpdate.rewards) ? aiUpdate.rewards : [],
        evidence: Array.isArray(aiUpdate.evidence) ? aiUpdate.evidence : [],
        customJsonDataBefore: finalExistingProfile?.customJsonData || {},
        customJsonDataAfter: progression.profile?.customJsonData || {}
      }
      const nextProfile = normalizeProgressionProfile(finalSourceEntry, progression.profile, finalExistingProfile, historyEntry, now)
      const nextProfiles = finalExistingProfile
        ? progressionProfiles.map(profile => profile.id === finalExistingProfile.id ? nextProfile : profile)
        : [nextProfile, ...progressionProfiles]
      persistProgressionProfiles(nextProfiles)
      learnProgressionProfileShape(nextProfile)
      setSelectedProgressionProfileId(nextProfile.id)
      setProgressionSelectedEntryId(finalSourceEntry.id)
      setProgressionNotice(wasChapterReviewed
        ? `Refreshed ${finalSourceEntry.name}'s progression update for ${activeNote.title || "this chapter"}.`
        : aiUpdate.shouldApply === false
        ? `No major progression change found, but this chapter has been marked as reviewed for ${finalSourceEntry.name}.`
        : `Updated ${finalSourceEntry.name} from ${activeNote.title || "this chapter"}.`)
    } catch (err) {
      setProgressionError(err instanceof Error ? err.message : "Failed to update progression profile")
    } finally {
      setProgressionLoading(false)
    }
  }

  const runSingleProfileUpdate = async (
    profile: CharacterProgressionProfile,
    entry: BibleEntry,
    note: Note
  ): Promise<CharacterProgressionProfile> => {
    const chapterNumber = getNoteChapterNumber(note)
    const chapterContentForAi = note.content.slice(0, 22000)
    const candidateProfilesForAi = [{
      id: profile.id,
      loreEntryId: profile.loreEntryId,
      name: profile.name,
      title: profile.title,
      realm: profile.realm,
      stage: profile.stage,
      rank: profile.rank,
      bloodline: profile.customFields?.Bloodline || "",
      bloodlineRank: profile.customFields?.["Bloodline Rank"] || profile.customFields?.["Bloodline Grade"] || "",
      className: profile.className,
      skills: profile.abilities?.map(ability => ability.name).filter(Boolean),
      lore: profile.notes,
      level: profile.level,
      processedChapterIds: profile.processedChapterIds
    }]
    
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "progression_update",
        selectedText: "",
        loreEntry: {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          content: entry.content,
          groups: (entry.groupIds || [])
            .map(groupId => bibleGroups.find(group => group.id === groupId)?.name)
            .filter(Boolean)
        },
        chapter: {
          id: note.id,
          title: note.title,
          chapterNumber,
          content: chapterContentForAi,
          targetEvidence: ""
        },
        progressionSystem,
        existingProfile: profile,
        candidateProfiles: candidateProfilesForAi,
        candidateLoreEntries: [],
        memory: buildStoryMemoryContext()
      })
    })

    const data = await res.json()
    if (data.error) {
      throw new Error(data.error)
    }

    const progression = (data.progression || {}) as ProgressionAiResponse
    const now = Date.now()
    const aiUpdate = progression.update || {}
    const levelBefore = aiUpdate.levelBefore ?? profile.level ?? 1
    const levelAfter = aiUpdate.levelAfter ?? progression.profile?.level ?? levelBefore
    
    const historyEntry: ProgressionHistoryEntry = {
      id: crypto.randomUUID(),
      chapterId: note.id,
      chapterTitle: note.title || "Untitled",
      chapterNumber,
      appliedAt: now,
      summary: aiUpdate.summary || "Progression profile reviewed from this chapter.",
      levelBefore,
      levelAfter,
      realmBefore: aiUpdate.realmBefore ?? profile.realm ?? "",
      realmAfter: aiUpdate.realmAfter ?? progression.profile?.realm ?? profile.realm ?? "",
      stageBefore: aiUpdate.stageBefore ?? profile.stage ?? "",
      stageAfter: aiUpdate.stageAfter ?? progression.profile?.stage ?? profile.stage ?? "",
      statChanges: aiUpdate.statChanges || {},
      abilityChanges: Array.isArray(aiUpdate.abilityChanges) ? aiUpdate.abilityChanges : [],
      rewards: Array.isArray(aiUpdate.rewards) ? aiUpdate.rewards : [],
      evidence: Array.isArray(aiUpdate.evidence) ? aiUpdate.evidence : [],
      customJsonDataBefore: profile.customJsonData || {},
      customJsonDataAfter: progression.profile?.customJsonData || {}
    }

    return normalizeProgressionProfile(entry, progression.profile, profile, historyEntry, now)
  }

  const handleProgressionBulkUpdate = async () => {
    if (!projectId) {
      setProgressionError("Open a project first.")
      return
    }
    if (notes.length === 0) {
      setProgressionError("No chapters found in this project.")
      return
    }
    if (progressionProfiles.length === 0) {
      setProgressionError("No character profiles found. Create at least one character profile first.")
      return
    }

    setProgressionBulkUpdating(true)
    setProgressionError("")
    setProgressionNotice("")
    setProgressionBulkUpdateStatus("Scanning chapters...")

    try {
      const recentChapters = getManuscriptNotesList(notes).slice(-5)
      let currentProfiles = [...progressionProfiles]
      const updatesQueue: { note: Note; profileId: string; entry: BibleEntry }[] = []
      
      for (const note of recentChapters) {
        for (const profile of currentProfiles) {
          const entry = bibleEntries.find(e => e.id === profile.loreEntryId)
          if (!entry) continue

          const isProcessed = profile.processedChapterIds?.includes(note.id)
          if (isProcessed) continue

          const appears = doesCharacterAppearInChapter(profile, note.content)
          if (appears) {
            updatesQueue.push({ note, profileId: profile.id, entry })
          }
        }
      }

      if (updatesQueue.length === 0) {
        setProgressionNotice("All profiles are already up-to-date for the 5 recent chapters.")
        return
      }

      setProgressionBulkUpdateStatus(`Found ${updatesQueue.length} updates. Starting processing...`)

      for (let i = 0; i < updatesQueue.length; i++) {
        const { note, profileId, entry } = updatesQueue[i]
        const latestProfile = currentProfiles.find(p => p.id === profileId)
        if (!latestProfile) continue

        setProgressionBulkUpdateStatus(`Updating ${latestProfile.name} (${i + 1}/${updatesQueue.length})...`)

        try {
          const updatedProfile = await runSingleProfileUpdate(latestProfile, entry, note)
          currentProfiles = currentProfiles.map(p => p.id === profileId ? updatedProfile : p)
          persistProgressionProfiles(currentProfiles)
          learnProgressionProfileShape(updatedProfile)
        } catch (err) {
          console.error(`Failed to update ${latestProfile.name} in chapter ${note.title || note.id}:`, err)
        }
      }

      setProgressionNotice(`Successfully processed ${updatesQueue.length} character profile updates.`)
    } catch (err) {
      setProgressionError(err instanceof Error ? err.message : "Failed to run bulk update")
    } finally {
      setProgressionBulkUpdating(false)
      setProgressionBulkUpdateStatus("")
    }
  }

  const updateProgressionProfile = (profileId: string, updater: (profile: CharacterProgressionProfile) => CharacterProgressionProfile) => {
    const nextProfiles = progressionProfiles.map(profile => profile.id === profileId ? updater(profile) : profile)
    persistProgressionProfiles(nextProfiles)
  }

  const deleteProgressionProfile = (profileId: string) => {
    const profile = progressionProfiles.find(item => item.id === profileId)
    if (!profile) return
    const confirmed = window.confirm(`Delete the progression profile for ${profile.name}? This will remove its stats, abilities, and history.`)
    if (!confirmed) return
    const nextProfiles = progressionProfiles.filter(item => item.id !== profileId)
    persistProgressionProfiles(nextProfiles)
    const nextSelected = nextProfiles[0] || null
    setSelectedProgressionProfileId(nextSelected?.id || null)
    setProgressionSelectedEntryId(nextSelected?.loreEntryId || null)
    setIsProgressionEditMode(false)
    setProgressionNotice(`Deleted ${profile.name}'s progression profile.`)
  }

  const openProgressionEditModal = (profile: CharacterProgressionProfile) => {
    setProgressionEditProfileDraft({
      ...profile,
      stats: { ...DEFAULT_PROGRESSION_STATS, ...(profile.stats || {}) },
      abilities: [...profile.abilities],
      traits: [...profile.traits],
      nicknames: [...(profile.nicknames || [])],
      customFields: { ...(profile.customFields || {}) },
      processedChapterIds: [...profile.processedChapterIds],
      history: [...profile.history]
    })
    setProgressionNewFieldName("")
    setProgressionNewFieldValue("")
    setProgressionNewFieldType("text")
    setIsProgressionEditMode(true)
  }

  const closeProgressionEditModal = () => {
    setIsProgressionEditMode(false)
    setProgressionEditProfileDraft(null)
    setProgressionNewFieldName("")
    setProgressionNewFieldValue("")
    setProgressionNewFieldType("text")
  }

  const setProgressionDraftField = (field: keyof CharacterProgressionProfile, value: string | number | string[]) => {
    setProgressionEditProfileDraft(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const setProgressionDraftCustomField = (fieldName: string, value: string) => {
    setProgressionEditProfileDraft(prev => prev ? ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [fieldName]: value
      }
    }) : prev)
  }

  const setProgressionDraftStatField = (fieldName: string, value: string) => {
    const normalizedName = fieldName.toLowerCase().replace(/\s+/g, "")
    const statKey = Object.keys(DEFAULT_PROGRESSION_STATS).find(key => key.toLowerCase() === normalizedName) as ProgressionStatKey | undefined
    if (!statKey) {
      setProgressionDraftCustomField(fieldName, value)
      return
    }
    const parsed = Number(value)
    setProgressionEditProfileDraft(prev => prev ? ({
      ...prev,
      stats: {
        ...prev.stats,
        [statKey]: Number.isFinite(parsed) ? parsed : prev.stats[statKey]
      },
      customFields: {
        ...(prev.customFields || {}),
        [fieldName]: value
      }
    }) : prev)
  }

  const setProgressionDraftTemplateField = (card: ProgressionTemplateCard, fieldName: string, value: string) => {
    const cleanField = fieldName.toLowerCase()
    if (cleanField === "name") {
      setProgressionDraftField("name", value)
      return
    }
    if (cleanField === "cultivation stage" || cleanField === "realm" || cleanField === "stage") {
      setProgressionDraftField("realm", value)
      setProgressionDraftCustomField(fieldName, value)
      return
    }
    if (cleanField === "rank") {
      setProgressionDraftField("stage", value)
      setProgressionDraftField("rank", value)
      setProgressionDraftCustomField(fieldName, value)
      return
    }
    if (cleanField === "class" || cleanField === "job class") {
      setProgressionDraftField("className", value)
      setProgressionDraftCustomField(fieldName, value)
      return
    }
    if (cleanField === "exp" || card.type === "progress") {
      const ratio = parseProgressionRatio(value)
      if (ratio) {
        setProgressionDraftField("exp", ratio.current)
        setProgressionDraftField("nextLevelExp", ratio.max)
      }
      setProgressionDraftCustomField(fieldName, value)
      return
    }
    if (card.type === "stat") {
      setProgressionDraftStatField(fieldName, value)
      return
    }
    setProgressionDraftCustomField(fieldName, value)
  }

  const addProgressionDraftCustomField = () => {
    const cleanName = progressionNewFieldName.trim()
    if (!cleanName) return
    setProgressionDraftCustomField(cleanName, progressionNewFieldValue)
    setProgressionTemplateCards(cards => {
      const existingIndex = cards.findIndex(card => card.sourceKey.toLowerCase() === cleanName.toLowerCase() || card.label.toLowerCase() === cleanName.toLowerCase())
      if (existingIndex >= 0) {
        return cards.map((card, index) => index === existingIndex ? { ...card, type: progressionNewFieldType, enabled: true } : card)
      }
      return [
        ...cards,
        {
          id: getProgressionTemplateCardId(cleanName),
          label: cleanName,
          type: progressionNewFieldType,
          sourceKey: cleanName,
          fields: getProgressionRankedTemplateFields(cleanName, cleanName, [cleanName]),
          color: getProgressionCardColor(cards.length, progressionNewFieldType),
          enabled: true
        }
      ]
    })
    setProgressionNewFieldName("")
    setProgressionNewFieldValue("")
    setProgressionNewFieldType("text")
  }

  const removeProgressionDraftCustomField = (fieldName: string) => {
    setProgressionEditProfileDraft(prev => {
      if (!prev) return prev
      const nextCustomFields = { ...(prev.customFields || {}) }
      delete nextCustomFields[fieldName]
      return { ...prev, customFields: nextCustomFields }
    })
  }

  const setProgressionDraftAbility = (abilityId: string, updates: Partial<ProgressionAbility>) => {
    setProgressionEditProfileDraft(prev => prev ? ({
      ...prev,
      abilities: prev.abilities.map(ability => ability.id === abilityId ? { ...ability, ...updates } : ability)
    }) : prev)
  }

  const addProgressionDraftAbility = () => {
    setProgressionEditProfileDraft(prev => prev ? ({
      ...prev,
      abilities: [
        ...prev.abilities,
        {
          id: crypto.randomUUID(),
          name: "New Ability",
          level: 1,
          rank: "Level 1",
          description: "",
          evidence: ""
        }
      ]
    }) : prev)
  }

  const removeProgressionDraftAbility = (abilityId: string) => {
    setProgressionEditProfileDraft(prev => prev ? ({
      ...prev,
      abilities: prev.abilities.filter(ability => ability.id !== abilityId)
    }) : prev)
  }

  const learnProgressionProfileShape = (profile: CharacterProgressionProfile) => {
    const customFieldNames = Object.keys(profile.customFields || {}).map(item => item.trim()).filter(Boolean)
    const learnedCustomFields = Array.from(new Set([...(progressionSystem?.customFields || []), ...customFieldNames]))
    const learnedDefaultCustomFields = learnedCustomFields.reduce<Record<string, string>>((acc, fieldName) => {
      const defaultCustomFields = progressionSystem?.profileTemplate?.defaultCustomFields || {}
      acc[fieldName] = defaultCustomFields[fieldName] || ""
      return acc
    }, {})
    const learnedCards = normalizeProgressionTemplateCards(
      progressionSystem?.profileTemplate?.cards,
      learnedCustomFields
    )
    persistProgressionSystem({
      ...progressionSystem,
      customFields: learnedCustomFields,
      profileTemplate: {
        ...(progressionSystem?.profileTemplate || DEFAULT_PROFILE_TEMPLATE),
        defaultStats: {
          ...(progressionSystem?.profileTemplate?.defaultStats || {}),
          ...Object.fromEntries((progressionSystem?.statKeys || []).map(statKey => [statKey, progressionSystem?.profileTemplate?.defaultStats?.[statKey] ?? DEFAULT_PROGRESSION_STATS[statKey]]))
        },
        defaultCustomFields: learnedDefaultCustomFields,
        defaultAbilities: (progressionSystem?.profileTemplate?.defaultAbilities || []).length > 0
          ? (progressionSystem?.profileTemplate?.defaultAbilities || [])
          : profile.abilities.map(ability => ({ ...ability, evidence: "" })),
        cards: learnedCards,
        notes: progressionSystem?.profileTemplate?.notes || "Use edited profile fields as the baseline shape for this novel."
      }
    })
  }

  const saveProgressionProfileDraft = () => {
    if (!progressionEditProfileDraft) return
    const now = Date.now()
    const updatedProfile: CharacterProgressionProfile = {
      ...progressionEditProfileDraft,
      abilities: progressionEditProfileDraft.abilities.map((ability, index) => ({
        ...ability,
        id: ability.id || crypto.randomUUID(),
        name: ability.name || `Ability ${index + 1}`,
        level: Number.isFinite(Number(ability.level)) ? Number(ability.level) : 1,
        rank: ability.rank || (Number.isFinite(Number(ability.level)) ? `Level ${ability.level}` : ""),
        description: ability.description || ""
      })),
      traits: Array.isArray(progressionEditProfileDraft.traits) ? progressionEditProfileDraft.traits : [],
      nicknames: Array.isArray(progressionEditProfileDraft.nicknames) ? progressionEditProfileDraft.nicknames : [],
      customFields: progressionEditProfileDraft.customFields || {},
      updatedAt: now
    }
    updateProgressionProfile(updatedProfile.id, () => updatedProfile)
    learnProgressionProfileShape(updatedProfile)
    setSelectedProgressionProfileId(updatedProfile.id)
    setProgressionNotice("Profile updated. This novel's shared progression template learned the new profile shape.")
    closeProgressionEditModal()
  }

  const formatProgressionStage = (profile: CharacterProgressionProfile) => {
    const realm = profile.realm || profile.rank || "Unranked"
    const stage = profile.stage ? ` - ${profile.stage}` : ""
    const level = progressionSystem.showLevels ? `Lv ${profile.level}` : ""
    return [realm + stage, level].filter(Boolean).join(" | ")
  }

  const getLoreAliases = useCallback((entry: BibleEntry) => {
    const rawName = entry.name || ""
    const withoutMarkdown = rawName.replace(/[\[\]#*_`]/g, " ").replace(/\s+/g, " ").trim()
    const afterColon = withoutMarkdown.includes(":") ? withoutMarkdown.split(":").pop()?.trim() || "" : ""
    const withoutTitleTag = withoutMarkdown.replace(/\b(Name|Title|Character|Place|Item|Lore)\s*:\s*/gi, "").trim()

    return Array.from(new Set([rawName, withoutMarkdown, afterColon, withoutTitleTag]
      .map(alias => alias.trim())
      .filter(alias => alias.length > 1)))
  }, [])

  const doesCharacterAppearInChapter = useCallback((
    profile: CharacterProgressionProfile,
    chapterContent: string
  ) => {
    const entry = bibleEntries.find(e => e.id === profile.loreEntryId)
    const searchTerms = new Set<string>()
    
    if (profile.name) searchTerms.add(profile.name.trim())
    if (Array.isArray(profile.nicknames)) {
      profile.nicknames.forEach(n => {
        if (n) searchTerms.add(n.trim())
      })
    }
    if (entry) {
      if (entry.name) searchTerms.add(entry.name.trim())
      getLoreAliases(entry).forEach(alias => {
        if (alias) searchTerms.add(alias.trim())
      })
    }

    const terms = Array.from(searchTerms)
      .map(t => t.trim())
      .filter(t => t.length > 1)
      
    if (terms.length === 0) return false

    const escapedTerms = terms.map(term => term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    const regex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'i')
    return regex.test(chapterContent)
  }, [bibleEntries, getLoreAliases])

  const highlightBibleEntries = (text: string) => {
    if (!bibleEntries.length || !text) return text
    
    const aliasEntries = bibleEntries.flatMap(entry =>
      getLoreAliases(entry).map(alias => ({ entry, alias }))
    ).sort((a, b) => b.alias.length - a.alias.length)

    if (aliasEntries.length === 0) return text

    const escapedNames = aliasEntries.map(item => item.alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    const regex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi')

    const parts = text.split(regex)
    if (parts.length === 1) return text

    return parts.map((part, index) => {
      const match = aliasEntries.find(item => item.alias.toLowerCase() === part.toLowerCase())
      if (match) {
        return (
          <span 
            key={index} 
            className="lore-chip-preview"
            onMouseEnter={(e) => handleLoreMouseEnter(e, match.entry)}
            onMouseLeave={handleLoreMouseLeave}
            onClick={() => handleLoreClick(match.entry)}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  const injectLoreChips = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      return highlightBibleEntries(node)
    }
    
    if (React.isValidElement(node)) {
      if (node.type === 'code' || node.type === 'pre') {
        return node
      }
      
      const children = React.Children.map(node.props.children, child => injectLoreChips(child))
      return React.cloneElement(node, { ...node.props, children })
    }
    
    return node
  }


  const saveFolderHandleToProject = useCallback(async (handle: FileSystemDirectoryHandle) => {
    if (!projectId) return
    try {
      await saveDirectoryHandleForProject(projectId, handle)
    } catch (e) {
      console.error("Failed to save folder handle:", e)
    }
  }, [projectId])

  const verifyPermission = useCallback(async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      const opts = { mode: 'readwrite' as const }
      if ((await handle.queryPermission(opts)) === 'granted') {
        return true
      }
      if ((await handle.requestPermission(opts)) === 'granted') {
        return true
      }
    } catch (e) {
      console.error("Permission check failed:", e)
    }
    return false
  }, [])

  const disconnectFolder = async () => {
    setDirHandle(null)
    if (projectId) {
      try {
        await saveDirectoryHandleForProject(projectId, null)
      } catch (e) {
        console.error("Failed to clear directory handle:", e)
      }
    }
  }

  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState(22)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; noteId: string; noteTitle: string }>({ show: false, noteId: '', noteTitle: '' })
  const [savedChapters, setSavedChapters] = useState<Set<string>>(new Set())
  const [exportHistory, setExportHistory] = useState<Record<string, ExportHistoryRecord>>({})
  const [exportModal, setExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('folder')
  const [isTypewriterMode, setIsTypewriterMode] = useState(false)
  const [theme, setTheme] = useState('midnight')

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('penpad_theme', newTheme)
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('penpad_theme')
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])
  const [showChapterDrawer, setShowChapterDrawer] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveBibleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedFilenamesRef = useRef<Map<string, string>>(new Map())

  // Sound Engine Setup
  useEffect(() => {
    synthRef.current = new AudioFocusSynthesizer()
    return () => {
      if (synthRef.current) {
        synthRef.current.stopAll()
      }
    }
  }, [])

  const handleAmbientPlay = (type: string) => {
    setActiveSound(type)
    if (synthRef.current) {
      synthRef.current.play(type)
    }
  }

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol)
    if (synthRef.current) {
      synthRef.current.setVolume(vol)
    }
  }

  useEffect(() => {
    if (!projectId) return
    
    getDirectoryHandleForProject(projectId).then(handle => {
      if (handle) {
        setDirHandle(handle)
      }
    })
  }, [projectId])

  const centerActiveLine = useCallback(() => {
    if (!isTypewriterMode) return
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const textBeforeCursor = textarea.value.substring(0, start)
    const lines = textBeforeCursor.split('\n').length - 1
    
    const computedStyle = window.getComputedStyle(textarea)
    const lineHeight = parseInt(computedStyle.lineHeight) || 28
    const paddingTop = parseInt(computedStyle.paddingTop) || 0
    
    const activeLineTop = lines * lineHeight + paddingTop
    const textareaHeight = textarea.clientHeight
    const targetScrollTop = activeLineTop - (textareaHeight / 2) + (lineHeight / 2)
    
    textarea.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    })
  }, [isTypewriterMode])

  useEffect(() => {
    if (isTypewriterMode) {
      const timer = setTimeout(centerActiveLine, 50)
      return () => clearTimeout(timer)
    }
  }, [isTypewriterMode, centerActiveLine, activeNoteId])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isTimerRunning && activeNoteId) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning, activeNoteId])

  const formatSessionTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':')
  }

  const changeWordGoal = () => {
    if (!activeNote) return
    const currentGoal = activeNote.wordGoal || 1200
    const input = prompt("Set word count goal for this chapter:", currentGoal.toString())
    if (input === null) return
    const newGoal = parseInt(input, 10)
    if (!isNaN(newGoal) && newGoal > 0) {
      updateActiveNote({ wordGoal: newGoal })
    } else {
      alert("Please enter a valid positive number.")
    }
  }

  const fetchProjectName = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      if (stored) {
        const projects = JSON.parse(stored)
        const project = projects.find((p: { id: string, name: string }) => p.id === projectId)
        if (project) {
          setProjectName(project.name)
          return
        }
      }
      setProjectName("Untitled")
    } catch (e) {
      console.error("Failed to fetch project name:", e)
      setProjectName("Untitled")
    }
  }, [user, projectId])

  const getVolumesStorageKey = useCallback(() => {
    return projectId ? `penpad_volumes_${projectId}` : ""
  }, [projectId])

  const getCollapsedVolumesStorageKey = useCallback(() => {
    return projectId ? `penpad_collapsed_volumes_${projectId}` : ""
  }, [projectId])

  const getBibleGroupsStorageKey = useCallback(() => {
    return projectId ? `penpad_bible_groups_${projectId}` : ""
  }, [projectId])

  const getProgressionStorageKey = useCallback(() => {
    return projectId ? `penpad_progression_${projectId}` : ""
  }, [projectId])

  const getProgressionSystemStorageKey = useCallback(() => {
    return projectId ? `penpad_progression_system_${projectId}` : ""
  }, [projectId])

  const getExportHistoryStorageKey = useCallback(() => {
    return projectId ? `penpad_export_history_${projectId}` : ""
  }, [projectId])

  const persistVolumes = useCallback((nextVolumes: ManuscriptVolume[]) => {
    const key = getVolumesStorageKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(nextVolumes))
    setVolumes(nextVolumes)
  }, [getVolumesStorageKey])

  const fetchVolumes = useCallback(() => {
    if (!projectId) return
    try {
      const storedVolumes = localStorage.getItem(getVolumesStorageKey())
      const volumeList: ManuscriptVolume[] = storedVolumes
        ? JSON.parse(storedVolumes).map((volume: ManuscriptVolume) => ({ ...volume, isOpen: volume.isOpen !== false }))
        : []
      setVolumes(volumeList.sort((a, b) => a.sortOrder - b.sortOrder))

      const storedCollapsed = localStorage.getItem(getCollapsedVolumesStorageKey())
      const collapsedList: string[] = storedCollapsed ? JSON.parse(storedCollapsed) : []
      setCollapsedVolumeIds(new Set(collapsedList))

      const storedHistory = localStorage.getItem(getExportHistoryStorageKey())
      const history: Record<string, ExportHistoryRecord> = storedHistory ? JSON.parse(storedHistory) : {}
      setExportHistory(history)
      savedFilenamesRef.current = new Map(Object.entries(history).map(([chapterId, record]) => [chapterId, record.filename]))
      setSavedChapters(new Set(Object.keys(history)))
    } catch (e) {
      console.error("Failed to load volume or export history:", e)
      setVolumes([])
      setCollapsedVolumeIds(new Set())
      setExportHistory({})
    }
  }, [projectId, getVolumesStorageKey, getCollapsedVolumesStorageKey, getExportHistoryStorageKey])

  const persistProgressionProfiles = useCallback((nextProfiles: CharacterProgressionProfile[]) => {
    const key = getProgressionStorageKey()
    if (!key) return
    const sorted = [...nextProfiles].sort((a, b) => b.updatedAt - a.updatedAt)
    localStorage.setItem(key, JSON.stringify(sorted))
    setProgressionProfiles(sorted)
  }, [getProgressionStorageKey])

  const normalizeProgressionSystem = useCallback((settings?: Partial<ProgressionSystemSettings>): ProgressionSystemSettings => {
    const validStatKeys = new Set(Object.keys(DEFAULT_PROGRESSION_STATS))
    const rawTemplate = {
      ...DEFAULT_PROFILE_TEMPLATE,
      ...(settings?.profileTemplate || {}),
      cards: DEFAULT_PROFILE_TEMPLATE_CARDS
    }
    const simpleCustomFields = DEFAULT_PROGRESSION_SYSTEM.customFields
    const normalizedTemplate: ProgressionProfileTemplate = {
      ...DEFAULT_PROFILE_TEMPLATE,
      ...rawTemplate,
      defaultStats: {
        ...DEFAULT_PROGRESSION_STATS,
        ...(rawTemplate.defaultStats || {})
      },
      defaultTraits: Array.isArray(rawTemplate.defaultTraits) ? rawTemplate.defaultTraits.map(item => String(item).trim()).filter(Boolean) : [],
      defaultAbilities: Array.isArray(rawTemplate.defaultAbilities)
        ? rawTemplate.defaultAbilities.map((abilityItem, index) => {
          const ability = typeof abilityItem === "object" && abilityItem !== null
            ? abilityItem as unknown as Record<string, unknown>
            : { name: String(abilityItem) }
          return {
            id: String(ability.id || `${ability.name || "ability"}-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name: String(ability.name || `Ability ${index + 1}`),
            level: Number.isFinite(Number(ability.level)) ? Number(ability.level) : 1,
            rank: String(ability.rank || ""),
            description: String(ability.description || ""),
            evidence: String(ability.evidence || "")
          }
        })
        : [],
      defaultCustomFields: rawTemplate.defaultCustomFields && typeof rawTemplate.defaultCustomFields === "object" ? rawTemplate.defaultCustomFields : {},
      cards: normalizeProgressionTemplateCards(
        DEFAULT_PROFILE_TEMPLATE_CARDS,
        simpleCustomFields
      ),
      baseLevel: Number.isFinite(Number(rawTemplate.baseLevel)) ? Number(rawTemplate.baseLevel) : 1,
      baseExp: Number.isFinite(Number(rawTemplate.baseExp)) ? Number(rawTemplate.baseExp) : 0,
      nextLevelExp: Number.isFinite(Number(rawTemplate.nextLevelExp)) ? Number(rawTemplate.nextLevelExp) : 100,
      enabled: rawTemplate.enabled !== false
    }
    return {
      ...DEFAULT_PROGRESSION_SYSTEM,
      ...(settings || {}),
      realms: Array.isArray(settings?.realms) ? settings.realms.map(item => String(item).trim()).filter(Boolean) : DEFAULT_PROGRESSION_SYSTEM.realms,
      stageLabels: Array.isArray(settings?.stageLabels) && settings.stageLabels.length > 0
        ? settings.stageLabels.map(item => String(item).trim()).filter(Boolean)
        : DEFAULT_PROGRESSION_SYSTEM.stageLabels,
      statKeys: Array.isArray(settings?.statKeys) && settings.statKeys.length > 0
        ? settings.statKeys.filter(item => validStatKeys.has(item))
        : DEFAULT_PROGRESSION_SYSTEM.statKeys,
      customFields: simpleCustomFields,
      profileTemplate: normalizedTemplate,
      notes: settings?.notes || DEFAULT_PROGRESSION_SYSTEM.notes,
      useCustomJsonTemplate: false,
      customJsonTemplate: settings?.customJsonTemplate || DEFAULT_PROGRESSION_SYSTEM.customJsonTemplate,
      jsonCardOrder: settings?.jsonCardOrder || DEFAULT_PROGRESSION_SYSTEM.jsonCardOrder,
      showLevels: false,
      showExp: false,
      showStats: false
    }
  }, [normalizeProgressionTemplateCards])

  const persistProgressionSystem = useCallback((nextSettings: ProgressionSystemSettings) => {
    const key = getProgressionSystemStorageKey()
    if (!key) return
    const normalized = normalizeProgressionSystem({ ...nextSettings, updatedAt: Date.now() })
    localStorage.setItem(key, JSON.stringify(normalized))
    setProgressionSystem(normalized)
  }, [getProgressionSystemStorageKey, normalizeProgressionSystem])

  const moveJsonCard = useCallback((key: string, direction: 'up' | 'down') => {
    const currentOrder = progressionSystem.jsonCardOrder || []
    const nextOrder = [...currentOrder]
    
    let templateKeys: string[] = []
    if (progressionSystem.customJsonTemplate) {
      try {
        const parsed = JSON.parse(progressionSystem.customJsonTemplate)
        if (parsed && typeof parsed === "object") {
          templateKeys = Object.keys(parsed)
        }
      } catch {}
    }
    
    templateKeys.forEach(k => {
      if (!nextOrder.includes(k)) {
        nextOrder.push(k)
      }
    })
    
    const index = nextOrder.indexOf(key)
    if (index === -1) return
    
    if (direction === 'up' && index > 0) {
      const temp = nextOrder[index]
      nextOrder[index] = nextOrder[index - 1]
      nextOrder[index - 1] = temp
    } else if (direction === 'down' && index < nextOrder.length - 1) {
      const temp = nextOrder[index]
      nextOrder[index] = nextOrder[index + 1]
      nextOrder[index + 1] = temp
    }
    
    persistProgressionSystem({
      ...progressionSystem,
      jsonCardOrder: nextOrder
    })
  }, [progressionSystem, persistProgressionSystem])

  const fetchProgressionSystem = useCallback(() => {
    if (!projectId) return
    try {
      const stored = localStorage.getItem(getProgressionSystemStorageKey())
      setProgressionSystem(normalizeProgressionSystem(stored ? JSON.parse(stored) : undefined))
    } catch (e) {
      console.error("Failed to load progression system:", e)
      setProgressionSystem(DEFAULT_PROGRESSION_SYSTEM)
    }
  }, [projectId, getProgressionSystemStorageKey, normalizeProgressionSystem])

  const fetchProgressionProfiles = useCallback(() => {
    if (!projectId) return
    try {
      const stored = localStorage.getItem(getProgressionStorageKey())
      const profiles: CharacterProgressionProfile[] = stored ? JSON.parse(stored) : []
      const normalized = profiles.map(profile => {
        const jsonData = profile.customJsonData && typeof profile.customJsonData === "object" ? profile.customJsonData as Record<string, any> : {}
        const jsonCultivation = jsonData.cultivation && typeof jsonData.cultivation === "object" ? jsonData.cultivation as Record<string, any> : {}
        const customFields = profile.customFields && typeof profile.customFields === "object" ? { ...profile.customFields } : {}
        customFields.Bloodline = customFields.Bloodline || String(jsonData.bloodline || jsonData.Bloodline || customFields["Bloodline Name"] || "")
        customFields["Bloodline Rank"] = customFields["Bloodline Rank"] || String(jsonData.bloodlineRank || jsonData["Bloodline Rank"] || jsonData.bloodlineGrade || customFields["Bloodline Grade"] || "")
        const jsonSkills = Array.isArray(jsonData.skills) ? jsonData.skills : []
        const existingAbilities = Array.isArray(profile.abilities) ? profile.abilities : []
        const migratedAbilities = existingAbilities.length > 0
          ? existingAbilities
          : jsonSkills.map((item, index) => {
            const skill = typeof item === "object" && item !== null ? item as Record<string, any> : { name: String(item) }
            return {
              id: String(skill.id || skill.name || `skill-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              name: String(skill.name || skill.title || `Skill ${index + 1}`),
              level: Number.isFinite(Number(skill.level)) ? Number(skill.level) : 1,
              rank: String(skill.rank || skill.grade || ""),
              description: String(skill.description || skill.effect || ""),
              evidence: String(skill.evidence || "")
            }
          })
        return {
          ...profile,
          title: profile.title || String(jsonData.title || ""),
          className: profile.className || String(jsonData.class || jsonData.className || ""),
          realm: profile.realm || String(jsonCultivation.realm || jsonCultivation.stage || jsonData.realm || ""),
          stage: profile.stage || String(jsonCultivation.rank || jsonCultivation.subRank || jsonData.stage || jsonData.rank || ""),
          stats: { ...DEFAULT_PROGRESSION_STATS, ...(profile.stats || {}) },
          abilities: migratedAbilities,
          traits: Array.isArray(profile.traits) ? profile.traits : [],
          nicknames: Array.isArray(profile.nicknames) ? profile.nicknames : [],
          uniqueTrait: profile.uniqueTrait || "",
          customFields,
          notes: profile.notes || String(jsonData.lore || jsonData.notes || ""),
          processedChapterIds: Array.isArray(profile.processedChapterIds) ? profile.processedChapterIds : [],
          history: Array.isArray(profile.history) ? profile.history : []
        }
      }).sort((a, b) => b.updatedAt - a.updatedAt)
      setProgressionProfiles(normalized)
      if (normalized.length > 0 && !selectedProgressionProfileId) {
        setSelectedProgressionProfileId(normalized[0].id)
        setProgressionSelectedEntryId(normalized[0].loreEntryId)
      }
    } catch (e) {
      console.error("Failed to load progression profiles:", e)
      setProgressionProfiles([])
    }
  }, [projectId, getProgressionStorageKey, selectedProgressionProfileId])

  const fetchNotes = useCallback(async () => {
    if (!user || !projectId) return
    setIsLoadingNotes(true)
    try {
      let noteList: Note[] = (await getManuscriptLocal(projectId)) || []
      if (noteList.length === 0) {
        const stored = localStorage.getItem(`penpad_notes_${projectId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          noteList = parsed
          await saveManuscriptLocal(projectId, parsed)
          localStorage.removeItem(`penpad_notes_${projectId}`)
        }
      }
      noteList.sort((a: Note, b: Note) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
      setNotes(noteList)
      if (noteList.length > 0 && !activeNoteId) {
        setActiveNoteId(noteList[0].id)
      }
      
      const syncedNotes = await syncChaptersWithCloud(user.uid, projectId, noteList)
      const orderedSyncedNotes = syncedNotes.sort((a: Note, b: Note) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
      setNotes(orderedSyncedNotes)
      if (syncedNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(orderedSyncedNotes[0].id)
      }
    } catch (e) {
      console.error("Fetch/Sync notes failed:", e)
      setNotes([])
    } finally {
      setIsLoadingNotes(false)
    }
  }, [user, projectId, activeNoteId])

  // World Bible Logic
  const persistBibleGroups = useCallback((nextGroups: StoryBibleGroup[]) => {
    const key = getBibleGroupsStorageKey()
    if (!key) return
    const sorted = nextGroups.sort((a, b) => a.sortOrder - b.sortOrder)
    localStorage.setItem(key, JSON.stringify(sorted))
    setBibleGroups(sorted)
  }, [getBibleGroupsStorageKey])

  const fetchBible = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const storedGroups = localStorage.getItem(getBibleGroupsStorageKey())
      const groupList: StoryBibleGroup[] = storedGroups ? JSON.parse(storedGroups) : []
      setBibleGroups(groupList.sort((a, b) => a.sortOrder - b.sortOrder))

      let entryList: BibleEntry[] = (await getStoryBibleLocal(projectId)) || []
      if (entryList.length === 0) {
        const stored = localStorage.getItem(`penpad_bible_${projectId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          entryList = parsed
          await saveStoryBibleLocal(projectId, parsed)
          localStorage.removeItem(`penpad_bible_${projectId}`)
        }
      }
      setBibleEntries(entryList)

      const synced = await syncBibleWithCloud(user.uid, projectId, entryList)
      setBibleEntries(synced)
      const knownGroupIds = new Set(groupList.map(group => group.id))
      const missingGroupIds = Array.from(new Set(synced.flatMap(entry => entry.groupIds || [])))
        .filter(groupId => !knownGroupIds.has(groupId))
      if (missingGroupIds.length > 0) {
        const now = Date.now()
        const recoveredGroups = missingGroupIds.map((groupId, index) => ({
          id: groupId,
          name: `Recovered Group ${index + 1}`,
          createdAt: now,
          updatedAt: now,
          sortOrder: groupList.length + index + 1
        }))
        persistBibleGroups([...groupList, ...recoveredGroups])
      }
    } catch {
      console.error("Fetch/Sync bible entries failed")
    }
  }, [user, projectId, getBibleGroupsStorageKey, persistBibleGroups])

  const saveBibleEntry = useCallback(async (entry: BibleEntry) => {
    if (!user || !projectId) return
    try {
      let entryList = await getStoryBibleLocal(projectId)
      if (!entryList) entryList = []
      const existingIdx = entryList.findIndex(e => e.id === entry.id)
      const now = Date.now()
      const updatedEntry = { ...entry, updatedAt: now }

      if (existingIdx >= 0) {
        entryList[existingIdx] = updatedEntry
      } else {
        entryList.push(updatedEntry)
      }

      await saveStoryBibleLocal(projectId, entryList)
      setBibleEntries(entryList)

      await saveBibleEntryToCloud(user.uid, projectId, updatedEntry)
    } catch (e) {
      console.error("Save bible entry failed:", e)
    }
  }, [user, projectId])

  const createNewBibleEntry = async () => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newEntry: BibleEntry = {
        id: crypto.randomUUID(),
        name: "New Entry",
        category: "character",
        content: "",
        createdAt: now,
        updatedAt: now
      }
      const updated = [newEntry, ...bibleEntries]
      setBibleEntries(updated)
      await saveStoryBibleLocal(projectId, updated)
      setActiveBibleEntryId(newEntry.id)
      setIsBibleDrawerOpen(true)
      
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
    } catch (e) {
      console.error("Failed to create bible entry:", e)
    }
  }

  const deleteBibleEntry = async (entryId: string) => {
    if (!projectId || !user) return
    try {
      const filtered = bibleEntries.filter(e => e.id !== entryId)
      setBibleEntries(filtered)
      await saveStoryBibleLocal(projectId, filtered)

      await deleteBibleEntryFromCloud(user.uid, projectId, entryId)

      if (activeBibleEntryId === entryId) {
        setActiveBibleEntryId(null)
        setIsBibleDrawerOpen(false)
      }
    } catch (e) {
      console.error("Failed to delete bible entry:", e)
    }
  }

  const updateActiveBibleEntry = (updates: Partial<BibleEntry>) => {
    if (!activeBibleEntryId) return
    const updated = bibleEntries.map(e => 
      e.id === activeBibleEntryId ? { ...e, ...updates, updatedAt: Date.now() } : e
    )
    setBibleEntries(updated)
  }

  const createBibleGroup = () => {
    const defaultName = "New Group"
    const name = prompt("Name this Story Bible group:", defaultName)
    if (name === null) return null
    const trimmed = name.trim() || defaultName
    const existing = bibleGroups.find(group => group.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id
    const now = Date.now()
    const newGroup: StoryBibleGroup = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      sortOrder: bibleGroups.length > 0 ? Math.max(...bibleGroups.map(group => group.sortOrder)) + 1 : 1
    }
    persistBibleGroups([...bibleGroups, newGroup])
    return newGroup.id
  }

  const renameBibleGroup = (groupId: string) => {
    const group = bibleGroups.find(item => item.id === groupId)
    if (!group) return
    const name = prompt("Rename Story Bible group:", group.name)
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) return
    persistBibleGroups(bibleGroups.map(item =>
      item.id === groupId ? { ...item, name: trimmed, updatedAt: Date.now() } : item
    ))
  }

  const saveBibleEntriesList = async (nextEntries: BibleEntry[]) => {
    if (!projectId) return
    setBibleEntries(nextEntries)
    await saveStoryBibleLocal(projectId, nextEntries)
  }

  const addBibleEntriesToGroup = async (entryIds: string[], groupId: string) => {
    if (!projectId || entryIds.length === 0) return
    const now = Date.now()
    const nextEntries = bibleEntries.map(entry => {
      if (!entryIds.includes(entry.id)) return entry
      const groupIds = Array.from(new Set([...(entry.groupIds || []), groupId]))
      return { ...entry, groupIds, updatedAt: now }
    })
    await saveBibleEntriesList(nextEntries)
    if (user) {
      await Promise.all(nextEntries
        .filter(entry => entryIds.includes(entry.id))
        .map(entry => saveBibleEntryToCloud(user.uid, projectId, entry)))
    }
    setDraggedBibleEntryId(null)
  }

  const addSelectedBibleEntriesToGroup = async () => {
    if (selectedBibleIds.size === 0) return
    const groupId = createBibleGroup()
    if (!groupId) return
    await addBibleEntriesToGroup(Array.from(selectedBibleIds), groupId)
    setIsBibleGroupAddMenuOpen(false)
    setSelectedBibleIds(new Set())
    setIsBibleSelectionMode(false)
  }

  const addSelectedBibleEntriesToExistingGroup = async (groupId: string) => {
    if (selectedBibleIds.size === 0) return
    await addBibleEntriesToGroup(Array.from(selectedBibleIds), groupId)
    setIsBibleGroupAddMenuOpen(false)
    setSelectedBibleIds(new Set())
    setIsBibleSelectionMode(false)
    setActiveBibleGroupId(groupId)
  }

  // Brain Map Logic
  const fetchBrain = useCallback(async () => {
    if (!user || !projectId) return
    try {
      let entryList: BrainEntry[] = (await getStoryBrainLocal(projectId)) || []
      if (entryList.length === 0) {
        const stored = localStorage.getItem(`penpad_brain_${projectId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          entryList = parsed
          await saveStoryBrainLocal(projectId, parsed)
          localStorage.removeItem(`penpad_brain_${projectId}`)
        }
      }
      setBrainEntries(entryList)

      const synced = await syncBrainWithCloud(user.uid, projectId, entryList)
      setBrainEntries(synced)
    } catch {
      console.error("Fetch/Sync brain entries failed")
    }
  }, [user, projectId])

  const getChapterNumberFromTitle = (title?: string) => {
    const match = title?.match(/\bchapter\s*0*(\d+)\b/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  const getNoteSortValue = (note: Note) => {
    if (Number.isFinite(note.sortOrder)) return note.sortOrder as number
    return getChapterNumberFromTitle(note.title) ?? note.createdAt
  }

  const getOrderedNotesList = (noteList: Note[]) => {
    return [...noteList].sort((a, b) => {
      const aSort = getNoteSortValue(a)
      const bSort = getNoteSortValue(b)
      if (aSort !== bSort) return bSort - aSort
      return a.title.localeCompare(b.title, undefined, { numeric: true })
    })
  }

  const getManuscriptNotesList = (noteList: Note[]) => {
    return [...noteList].sort((a, b) => {
      const aSort = getNoteSortValue(a)
      const bSort = getNoteSortValue(b)
      if (aSort !== bSort) return aSort - bSort
      return a.title.localeCompare(b.title, undefined, { numeric: true })
    })
  }

  const getNoteChapterNumber = (note: Note) => {
    const titleNumber = getChapterNumberFromTitle(note.title)
    if (titleNumber) return titleNumber

    const chapterIndex = getManuscriptNotesList(notes).findIndex(n => n.id === note.id)
    return chapterIndex >= 0 ? chapterIndex + 1 : null
  }

  const handleAddToBrain = async () => {
    const text = aiSelectionText.trim()
    if (!text || !user || !projectId || !activeNote) return

    const now = Date.now()
    const chapterNumber = getNoteChapterNumber(activeNote)
    const newEntry: BrainEntry = {
      id: crypto.randomUUID(),
      highlightedText: text,
      aiSummary: "Analyzing...",
      chapterTitle: activeNote.title || "Untitled",
      chapterId: activeNote.id,
      ...(chapterNumber ? { chapterNumber } : {}),
      createdAt: now,
      updatedAt: now
    }

    // Immediately add with placeholder — zero lag
    const updated = [newEntry, ...brainEntries]
    setBrainEntries(updated)
    await saveStoryBrainLocal(projectId, updated)

    // Clear selection
    setAiSelectionText("")
    setAiSelectionStart(0)
    setAiSelectionEnd(0)

    // Fire-and-forget AI analysis in background
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "brain_analyze",
        highlightedText: text,
        chapterContent: activeNote.content,
        chapterTitle: activeNote.title,
        chapterNumber,
        existingBrainEntries: brainEntries
          .filter(entry => entry.aiSummary !== "Analyzing...")
          .slice(0, 50)
      })
    })
      .then(res => res.json())
      .then(async data => {
        const summary = data.text || data.error || "Could not analyze."
        const finalEntry: BrainEntry = {
          ...newEntry,
          aiSummary: summary,
          entityType: data.entityType || "unknown",
          entityName: data.entityName || text,
          importance: data.importance || "minor",
          connections: Array.isArray(data.connections) ? data.connections : [],
          updatedAt: Date.now()
        }

        setBrainEntries(prev => {
          const list = prev.map(e => e.id === newEntry.id ? finalEntry : e)
          saveStoryBrainLocal(projectId, list)
          return list
        })

        saveBrainEntryToCloud(user.uid, projectId, finalEntry)
      })
      .catch(() => {
        const errorEntry = { ...newEntry, aiSummary: "Analysis failed. Try again.", updatedAt: Date.now() }
        setBrainEntries(prev => {
          const list = prev.map(e => e.id === newEntry.id ? errorEntry : e)
          saveStoryBrainLocal(projectId, list)
          return list
        })
      })
  }

  const deleteBrainEntry = async (entryId: string) => {
    if (!projectId || !user) return
    try {
      const filtered = brainEntries.filter(e => e.id !== entryId)
      setBrainEntries(filtered)
      setSelectedBrainEntryId(current => current === entryId ? null : current)
      await saveStoryBrainLocal(projectId, filtered)
      await deleteBrainEntryFromCloud(user.uid, projectId, entryId)
    } catch (e) {
      console.error("Failed to delete brain entry:", e)
    }
  }

  const updateBrainEntry = async (entryId: string, updates: Partial<BrainEntry>) => {
    if (!projectId || !user) return

    const updatedEntry = brainEntries.find(entry => entry.id === entryId)
    if (!updatedEntry) return

    const finalEntry = { ...updatedEntry, ...updates, updatedAt: Date.now() }
    const updatedList = brainEntries.map(entry => entry.id === entryId ? finalEntry : entry)

    setBrainEntries(updatedList)
    await saveStoryBrainLocal(projectId, updatedList)
    saveBrainEntryToCloud(user.uid, projectId, finalEntry)
  }

  const askBrainMap = async () => {
    const question = brainAskQuestion.trim()
    if (!question || brainAskLoading) return

    setBrainAskLoading(true)
    setBrainAskError("")
    setBrainAskAnswer("")

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_ask",
          question,
          brainEntries: brainEntries.filter(entry => entry.aiSummary !== "Analyzing...")
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not ask Brain Map")
      setBrainAskAnswer(data.text || "No answer returned.")
    } catch (err) {
      setBrainAskError(err instanceof Error ? err.message : "Could not ask Brain Map")
    } finally {
      setBrainAskLoading(false)
    }
  }

  const getVersionKey = useCallback((noteId: string) => {
    return projectId ? `penpad_versions_${projectId}_${noteId}` : ""
  }, [projectId])

  const loadChapterVersions = useCallback(async (noteId: string) => {
    const key = getVersionKey(noteId)
    if (!key) return []
    try {
      let versions = await getChapterVersionsLocal(noteId)
      if (!versions) {
        const stored = localStorage.getItem(key)
        if (stored) {
          versions = JSON.parse(stored) as ChapterVersion[]
          await saveChapterVersionsLocal(noteId, versions)
          localStorage.removeItem(key)
        } else {
          versions = []
        }
      }
      return versions
    } catch {
      return []
    }
  }, [getVersionKey])

  const saveChapterVersion = useCallback(async (note: Note, timestamp: number) => {
    const key = getVersionKey(note.id)
    if (!key || !note.content.trim()) return

    const versions = await loadChapterVersions(note.id)
    const latest = versions[0]
    if (latest && latest.content === note.content) return
    if (latest && timestamp - latest.savedAt < 1000 * 60 * 5) return

    const nextVersions: ChapterVersion[] = [
      {
        id: crypto.randomUUID(),
        title: note.title || "Untitled",
        content: note.content,
        savedAt: timestamp,
        wordCount: countWords(note.content)
      },
      ...versions
    ].slice(0, 12)

    await saveChapterVersionsLocal(note.id, nextVersions)
    if (note.id === activeNoteId) setChapterVersions(nextVersions)
  }, [activeNoteId, getVersionKey, loadChapterVersions])

  const restoreChapterVersion = (version: ChapterVersion) => {
    if (!activeNote) return
    updateActiveNote({ title: version.title, content: version.content })
    setShowVersionsModal(false)
  }

  const saveNote = useCallback(async (note: Note) => {
    if (!user || !projectId) return
    setSyncStatus('saving')
    try {
      let noteList = await getManuscriptLocal(projectId)
      if (!noteList) noteList = []
      
      const existingIdx = noteList.findIndex(n => n.id === note.id)
      const now = Date.now()
      const updatedNote = { ...note, updatedAt: now }
      
      if (existingIdx >= 0) {
        noteList[existingIdx] = updatedNote
      } else {
        noteList.push(updatedNote)
      }
      
      await saveManuscriptLocal(projectId, noteList)
      
      const storedProjects = localStorage.getItem(`penpad_projects_${user.uid}`)
      if (storedProjects) {
        const projects = JSON.parse(storedProjects)
        const projIdx = projects.findIndex((p: { id: string }) => p.id === projectId)
        if (projIdx >= 0) {
          projects[projIdx].lastUpdated = now
          localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(projects))
        }
      }

      await saveChapterVersion(updatedNote, now)
      await saveChapterToCloud(user.uid, projectId, updatedNote)
      setLastSavedAt(now)
      setSyncStatus('saved')
    } catch (e) {
      console.error("Save note failed:", e)
      setSyncStatus('error')
    }
  }, [user, projectId, saveChapterVersion])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    } else if (!loading && user && !projectId) {
      router.push("/dashboard")
    }
  }, [user, loading, projectId, router])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectName()
      fetchVolumes()
      fetchNotes()
      fetchBible()
      fetchBrain()
      fetchProgressionSystem()
      fetchProgressionProfiles()
    }
  }, [user, projectId, fetchProjectName, fetchVolumes, fetchNotes, fetchBible, fetchBrain, fetchProgressionSystem, fetchProgressionProfiles])

  useEffect(() => {
    let active = true
    if (activeNoteId) {
      loadChapterVersions(activeNoteId).then(versions => {
        if (active) setChapterVersions(versions)
      })
    } else {
      setChapterVersions([])
    }
    return () => { active = false }
  }, [activeNoteId, loadChapterVersions])

  useEffect(() => {
    if (activeNote && syncStatus !== 'saving') {
      const timer = setTimeout(() => {
        saveNote(activeNote)
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content, activeNote?.title])

  // World Bible AutoSave
  useEffect(() => {
    if (activeBibleEntry) {
      if (autoSaveBibleTimerRef.current) {
        clearTimeout(autoSaveBibleTimerRef.current)
      }
      autoSaveBibleTimerRef.current = setTimeout(() => {
        saveBibleEntry(activeBibleEntry)
      }, 1500)
      return () => clearTimeout(autoSaveBibleTimerRef.current!)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBibleEntry?.name, activeBibleEntry?.content, activeBibleEntry?.category, activeBibleEntry?.groupIds])

  useEffect(() => {
    if (!isBibleSelectionMode || selectedBibleIds.size === 0) {
      setIsBibleGroupAddMenuOpen(false)
    }
  }, [isBibleSelectionMode, selectedBibleIds.size])

  const sanitizeFilename = (name: string): string => {
    return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'
  }

  const getChapterExportFingerprint = (note: Note) => {
    const raw = `${note.title || ""}\n${note.content || ""}\n${note.updatedAt || 0}`
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
    }
    return `${note.updatedAt || 0}:${raw.length}:${hash}`
  }

  const persistExportHistory = useCallback((nextHistory: Record<string, ExportHistoryRecord>) => {
    const key = getExportHistoryStorageKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(nextHistory))
    setExportHistory(nextHistory)
    savedFilenamesRef.current = new Map(Object.entries(nextHistory).map(([chapterId, record]) => [chapterId, record.filename]))
    setSavedChapters(new Set(Object.keys(nextHistory)))
  }, [getExportHistoryStorageKey])

  const saveSingleChapterToFolder = useCallback(async (note: Note, targetDir: FileSystemDirectoryHandle) => {
    try {
      const safeTitle = sanitizeFilename(note.title)
      const newFilename = `${safeTitle}.txt`
      
      const oldFilename = savedFilenamesRef.current.get(note.id)
      if (oldFilename && oldFilename !== newFilename) {
        try {
          await targetDir.removeEntry(oldFilename)
        } catch {
          // File may not exist, ignore
        }
      }
      
      const fileHandle = await targetDir.getFileHandle(newFilename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(note.content || "")
      await writable.close()
      savedFilenamesRef.current.set(note.id, newFilename)
      setSavedChapters(prev => new Set(prev).add(note.id))
      setExportHistory(prev => {
        const next = {
          ...prev,
          [note.id]: {
            filename: newFilename,
            fingerprint: getChapterExportFingerprint(note),
            exportedAt: Date.now()
          }
        }
        const key = getExportHistoryStorageKey()
        if (key) localStorage.setItem(key, JSON.stringify(next))
        savedFilenamesRef.current = new Map(Object.entries(next).map(([chapterId, record]) => [chapterId, record.filename]))
        return next
      })
    } catch (e) {
      console.error("Failed to save chapter:", e)
    }
  }, [getExportHistoryStorageKey])

  const saveCurrentChapterToFolder = useCallback(async () => {
    if (!activeNote) return
    
    if (!window.showDirectoryPicker) {
      alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.")
      return
    }
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      try {
        targetDir = await getDirectoryHandleForProject(projectId)
        if (targetDir) {
          setDirHandle(targetDir)
        }
      } catch (e) {
        console.error("Failed to restore directory handle:", e)
      }
    }
    
    if (targetDir) {
      const hasPermission = await verifyPermission(targetDir)
      if (!hasPermission) {
        try {
          targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
          setDirHandle(targetDir)
          await saveFolderHandleToProject(targetDir)
        } catch {
          return
        }
      }
    } else {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("Directory picker error:", e)
        return
      }
    }
    
    if (targetDir) {
      await saveSingleChapterToFolder(activeNote, targetDir)
    }
  }, [activeNote, dirHandle, saveSingleChapterToFolder, saveFolderHandleToProject, projectId, verifyPermission])

  const exportManuscriptToFolder = async () => {
    if (notes.length === 0) {
      alert("No chapters to export")
      return
    }
    
    if (!window.showDirectoryPicker) {
      alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.")
      return
    }
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      try {
        targetDir = await getDirectoryHandleForProject(projectId)
        if (targetDir) {
          setDirHandle(targetDir)
        }
      } catch (e) {
        console.error("Failed to restore directory handle:", e)
      }
    }
    
    if (targetDir) {
      const hasPermission = await verifyPermission(targetDir)
      if (!hasPermission) {
        try {
          targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
          setDirHandle(targetDir)
          await saveFolderHandleToProject(targetDir)
        } catch {
          return
        }
      }
    } else {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("Directory picker error:", e)
        return
      }
    }
    
    if (!targetDir) {
      alert("No folder selected")
      return
    }
    
    try {
      setIsExporting(true)
      setExportProgress(0)
      
      const sortedNotes = getManuscriptNotesList(notes)
      const chaptersToExport = sortedNotes.filter(note => {
        const record = exportHistory[note.id]
        return !record || record.fingerprint !== getChapterExportFingerprint(note)
      })

      if (chaptersToExport.length === 0) {
        setExportProgress(100)
        setIsExporting(false)
        setExportModal(false)
        alert("All chapters are already exported and unchanged.")
        return
      }
      
      for (let i = 0; i < chaptersToExport.length; i++) {
        await saveSingleChapterToFolder(chaptersToExport[i], targetDir)
        setExportProgress(Math.round(((i + 1) / chaptersToExport.length) * 100))
      }
      
      setIsExporting(false)
      setExportModal(false)
    } catch (e) {
      console.error("Export failed:", e)
      setIsExporting(false)
      alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const getExportChapters = () => {
    return getManuscriptNotesList(notes)
  }

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  const buildExportContent = (format: Exclude<ExportFormat, 'folder' | 'pdf' | 'epub'>) => {
    const chapters = getExportChapters()
    if (format === 'md') {
      return `# ${projectName}\n\n${chapters.map(note => `## ${note.title || "Untitled"}\n\n${note.content || ""}`).join("\n\n")}`
    }

    if (format === 'html' || format === 'doc') {
      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(projectName)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 760px; margin: 48px auto; line-height: 1.7; color: #111827; }
    h1 { text-align: center; page-break-after: always; }
    h2 { page-break-before: always; margin-top: 0; }
    p { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(projectName)}</h1>
  ${chapters.map(note => `<section><h2>${escapeHtml(note.title || "Untitled")}</h2><p>${escapeHtml(note.content || "")}</p></section>`).join("\n")}
</body>
</html>`
    }

    return chapters.map(note => `${note.title || "Untitled"}\n${"=".repeat((note.title || "Untitled").length)}\n\n${note.content || ""}`).join("\n\n\n")
  }

  const downloadExportFile = (content: string, extension: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName || "manuscript"}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportManuscript = async () => {
    if (exportFormat === 'folder') {
      await exportManuscriptToFolder()
      return
    }

    if (notes.length === 0) {
      alert("No chapters to export")
      return
    }

    if (exportFormat === 'pdf') {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        alert("Popup blocked. Allow popups to print or save as PDF.")
        return
      }
      printWindow.document.write(buildExportContent('html'))
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      setExportModal(false)
      return
    }

    if (exportFormat === 'epub') {
      try {
        const chapters = getExportChapters()
        const zip = new JSZip()
        
        // mimetype (must be STORED/uncompressed)
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
        
        // META-INF/container.xml
        zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

        // OEBPS/styles.css
        zip.file('OEBPS/styles.css', `body { font-family: sans-serif; padding: 1em; line-height: 1.5; }
h1 { text-align: center; }
h2 { margin-top: 1.5em; text-align: left; }
p { margin-bottom: 1em; text-indent: 1.5em; margin-top: 0; }`)

        let manifestItems = ''
        let spineItems = ''
        let navPoints = ''
        
        chapters.forEach((chapter, idx) => {
          const fileName = `chapter_${idx + 1}.html`
          const id = `chapter_${idx + 1}`
          const title = chapter.title || `Chapter ${idx + 1}`
          
          zip.file(`OEBPS/${fileName}`, `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="styles.css" type="text/css"/>
</head>
<body>
  <h2>${escapeHtml(title)}</h2>
  ${(chapter.content || '').split('\n').map(line => line.trim() ? `<p>${escapeHtml(line)}</p>` : '').join('\n')}
</body>
</html>`)

          manifestItems += `    <item id="${id}" href="${fileName}" media-type="application/xhtml+xml" />\n`
          spineItems += `    <itemref idref="${id}" />\n`
          navPoints += `    <navPoint id="${id}" playOrder="${idx + 1}">
      <navLabel><text>${escapeHtml(title)}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>\n`
        })

        // OEBPS/content.opf
        zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeHtml(projectName)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookID" opf:scheme="UUID">urn:uuid:${crypto.randomUUID()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="style" href="styles.css" media-type="text/css" />
${manifestItems}  </manifest>
  <spine toc="ncx">
${spineItems}  </spine>
</package>`)

        // OEBPS/toc.ncx
        zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD NCX//EN" "http://www.daisy.org/z3986/2005/ncx-1.0.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:12345"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeHtml(projectName)}</text>
  </docTitle>
  <navMap>
${navPoints}  </navMap>
</ncx>`)

        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${projectName || "manuscript"}.epub`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        
        setExportModal(false)
      } catch (err) {
        console.error("Failed to generate EPUB:", err)
        alert("Failed to generate EPUB file.")
      }
      return
    }

    const content = buildExportContent(exportFormat)
    const exportMeta = {
      txt: { extension: 'txt', type: 'text/plain;charset=utf-8' },
      md: { extension: 'md', type: 'text/markdown;charset=utf-8' },
      html: { extension: 'html', type: 'text/html;charset=utf-8' },
      doc: { extension: 'doc', type: 'application/msword;charset=utf-8' }
    }[exportFormat]

    downloadExportFile(content, exportMeta.extension, exportMeta.type)
    setExportModal(false)
  }

  // Formatting helper
  const applyFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selection = text.substring(start, end)
    const formatted = prefix + selection + suffix

    const newContent = text.substring(0, start) + formatted + text.substring(end)
    updateActiveNote({ content: newContent })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selection.length)
    }, 50)
  }

  // Slash commands list
  const slashCommands = [
    { name: "Heading 1", cmd: "/h1", desc: "Insert Large Heading", action: () => applyFormatting("# ") },
    { name: "Heading 2", cmd: "/h2", desc: "Insert Medium Heading", action: () => applyFormatting("## ") },
    { name: "Heading 3", cmd: "/h3", desc: "Insert Small Heading", action: () => applyFormatting("### ") },
    { name: "Blockquote", cmd: "/quote", desc: "Insert Quote Block", action: () => applyFormatting("> ") },
    { name: "Bullet List", cmd: "/list", desc: "Insert Bullet Point", action: () => applyFormatting("- ") },
    { name: "Code Block", cmd: "/code", desc: "Insert Code block", action: () => applyFormatting("```\n", "\n```") },
    { name: "Focus AI assistant", cmd: "/ai", desc: "Toggle Right AI Assistant Sidebar", action: () => setShowAISidebar(prev => !prev) },
    { name: "Toggle Zen Mode", cmd: "/zen", desc: "Fullscreen Zen mode", action: () => setIsZenMode(prev => !prev) },
    { name: "Open World Bible", cmd: "/bible", desc: "Toggle World Bible Panel", action: () => { setActiveSidebarTab('bible'); setIsLeftSidebarOpen(true) } },
    { name: "Appearance Lab", cmd: "/appearance", desc: "Open Appearance Prompt Lab", action: () => { setActiveSidebarTab('appearance'); setIsLeftSidebarOpen(true) } },
    { name: "Progression", cmd: "/progress", desc: "Open Character Progression Profiles", action: () => { setActiveSidebarTab('progression'); setIsLeftSidebarOpen(true) } },
    { name: "Ambient Sounds", cmd: "/sound", desc: "Toggle Ambient Audio Settings", action: () => { setActiveSidebarTab('sounds'); setIsLeftSidebarOpen(true) } }
  ]

  const filteredCommands = slashCommands.filter(c => 
    c.name.toLowerCase().includes(slashMenuQuery.toLowerCase()) ||
    c.cmd.toLowerCase().includes(slashMenuQuery.toLowerCase())
  )

  const handleSlashSelect = (action: () => void) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const cursor = textarea.selectionStart
    const text = textarea.value
    
    // Find the position of the slash command trigger
    const beforeSlash = text.substring(0, cursor)
    const slashIndex = beforeSlash.lastIndexOf("/")
    if (slashIndex >= 0) {
      const cleanContent = text.substring(0, slashIndex) + text.substring(cursor)
      updateActiveNote({ content: cleanContent })
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(slashIndex, slashIndex)
        action()
      }, 50)
    } else {
      action()
    }
    setShowSlashMenu(false)
    setSlashMenuQuery("")
    setSlashMenuIndex(0)
  }

  const handleAutocompleteSelect = (suggestion: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return
    
    const text = textarea.value
    const cursor = textarea.selectionStart
    
    // Replace the typed query with the full suggestion
    const before = text.substring(0, autocompleteTriggerPos)
    const after = text.substring(cursor)
    
    const newContent = before + suggestion + after
    updateActiveNote({ content: newContent })
    
    // Position cursor at the end of the completed name
    const newCursorPos = autocompleteTriggerPos + suggestion.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
    
    setShowAutocomplete(false)
    setAutocompleteSuggestions([])
  }

  const handleAddSelectionToBible = async (category: "character" | "world" | "beast" | "place" | "item" = "character") => {
    const name = aiSelectionText.trim()
    if (!name || !user || !projectId) return
    
    try {
      let entryList = await getStoryBibleLocal(projectId)
      if (!entryList) entryList = []
      
      const exists = entryList.some(e => e.name.toLowerCase() === name.toLowerCase())
      if (exists) {
        return
      }

      const newEntry: BibleEntry = {
        id: crypto.randomUUID(),
        name: name,
        category: category,
        content: `Manually added as a ${category}.`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      entryList.unshift(newEntry)
      await saveStoryBibleLocal(projectId, entryList)
      setBibleEntries(entryList)
      
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
      
      // Clear selection text
      setAiSelectionText("")
      setAiSelectionStart(0)
      setAiSelectionEnd(0)
    } catch (e) {
      console.error("Failed to add highlighted text to Story Bible:", e)
    }
  }

  // Handle textarea keyboard listener
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashMenuIndex(prev => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashMenuIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[slashMenuIndex]) {
          handleSlashSelect(filteredCommands[slashMenuIndex].action)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        setSlashMenuQuery("")
      }
    } else if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex(prev => (prev + 1) % Math.min(5, autocompleteSuggestions.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex(prev => (prev - 1 + Math.min(5, autocompleteSuggestions.length)) % Math.min(5, autocompleteSuggestions.length))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (autocompleteSuggestions[autocompleteIndex]) {
          handleAutocompleteSelect(autocompleteSuggestions[autocompleteIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowAutocomplete(false)
        setAutocompleteSuggestions([])
      }
    }
  }

  // Listen to typing slash
  const handleEditorInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget
    const cursor = target.selectionStart
    const text = target.value
    
    const textBeforeCursor = text.substring(0, cursor)
    const lastWordIdx = textBeforeCursor.lastIndexOf(" ")
    const lastWord = textBeforeCursor.substring(lastWordIdx + 1)

    if (lastWord.startsWith("/")) {
      setShowSlashMenu(true)
      setSlashMenuQuery(lastWord.substring(1))
      setSlashMenuIndex(0)
      setShowAutocomplete(false)
    } else {
      if (showSlashMenu) {
        setShowSlashMenu(false)
        setSlashMenuQuery("")
      }

      // Autocomplete check
      const lastLineIdx = textBeforeCursor.lastIndexOf("\n")
      const lastPunctuationIdx = Math.max(
        textBeforeCursor.lastIndexOf(","),
        textBeforeCursor.lastIndexOf("."),
        textBeforeCursor.lastIndexOf("!"),
        textBeforeCursor.lastIndexOf("?"),
        textBeforeCursor.lastIndexOf("\""),
        textBeforeCursor.lastIndexOf("“"),
        textBeforeCursor.lastIndexOf("("),
        textBeforeCursor.lastIndexOf("[")
      )
      const splitIdx = Math.max(lastWordIdx, lastLineIdx, lastPunctuationIdx)
      const currentWord = textBeforeCursor.substring(splitIdx + 1)
      
      const cleanWord = currentWord.replace(/[^A-Za-z]/g, "")
      if (cleanWord.length >= 2) {
        const matches = bibleEntries
          .map(entry => entry.name)
          .filter(name => {
            const words = name.split(/\s+/)
            return words.some(w => w.toLowerCase().startsWith(cleanWord.toLowerCase()))
          })

        if (matches.length > 0) {
          setAutocompleteSuggestions(matches)

          setAutocompleteTriggerPos(cursor - cleanWord.length)
          setShowAutocomplete(true)
          setAutocompleteIndex(0)
        } else {
          setShowAutocomplete(false)
          setAutocompleteSuggestions([])
        }
      } else {
        setShowAutocomplete(false)
        setAutocompleteSuggestions([])
      }
    }
  }

  const buildStoryMemoryContext = () => {
    const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
    const nearbyChapters = [...notes]
      .filter(note => note.id !== activeNote?.id)
      .sort((a, b) => Math.abs((getNoteChapterNumber(a) || 9999) - (activeChapterNumber || 9999)) - Math.abs((getNoteChapterNumber(b) || 9999) - (activeChapterNumber || 9999)))
      .slice(0, 3)
      .map(note => `${note.title}: ${(note.content || "").slice(0, 900)}`)

    return {
      projectName,
      activeChapter: activeNote ? {
        title: activeNote.title,
        chapterNumber: activeChapterNumber
      } : null,
      nearbyChapters,
      brainEntries: brainEntries
        .filter(entry => entry.aiSummary && entry.aiSummary !== "Analyzing...")
        .slice(0, 20)
        .map(entry => ({
          entityName: entry.entityName || entry.highlightedText,
          entityType: entry.entityType || "unknown",
          importance: entry.importance || "minor",
          chapterNumber: entry.chapterNumber,
          summary: entry.aiSummary,
          connections: entry.connections || []
        })),
      loreEntries: bibleEntries.slice(0, 16).map(entry => ({
        name: entry.name,
        category: entry.category,
        content: entry.content.slice(0, 900)
      }))
    }
  }

  const handleContinueWriting = async () => {
    if (!activeNote) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const textarea = textareaRef.current
      let contextText = ""
      if (textarea) {
        const cursorPosition = textarea.selectionStart
        const textBefore = textarea.value.substring(0, cursorPosition)
        contextText = textBefore.substring(Math.max(0, textBefore.length - 4000))
      } else {
        contextText = activeNote.content.substring(Math.max(0, activeNote.content.length - 4000))
      }

      if (!contextText.trim()) {
        setAiError("Please write something first so the AI has context to continue from.")
        setAiLoading(false)
        return
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", content: contextText, memory: buildStoryMemoryContext() })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const handleRewrite = async () => {
    if (!aiSelectionText) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rewrite", content: aiSelectionText, style: aiTone, memory: buildStoryMemoryContext() })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateOutline = async () => {
    if (!aiOutlinePrompt.trim()) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "outline", prompt: aiOutlinePrompt, memory: buildStoryMemoryContext() })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const content = textarea.value
    
    const newContent = content.substring(0, start) + textToInsert + content.substring(end)
    updateActiveNote({ content: newContent })
    
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + textToInsert.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }

  const replaceSelection = (newText: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = aiSelectionStart
    const end = aiSelectionEnd
    const content = textarea.value

    const newContent = content.substring(0, start) + newText + content.substring(end)
    updateActiveNote({ content: newContent })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start, start + newText.length)
      setAiSelectionText(newText)
      setAiSelectionStart(start)
      setAiSelectionEnd(start + newText.length)
    }, 50)
  }

  const createNewNoteWithContent = async (title: string, initialContent: string) => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: title,
        content: initialContent,
        createdAt: now,
        updatedAt: now,
        volumeId: activeNote?.volumeId || null,
        sortOrder: getNextChapterSortOrder(notes),
      }
      
      let noteList = await getManuscriptLocal(projectId)
      if (!noteList) noteList = []
      const updatedNotes = getOrderedNotesList([...noteList, newNote])
      
      await saveManuscriptLocal(projectId, updatedNotes)
      setNotes(updatedNotes)
      setActiveNoteId(newNote.id)
      setViewMode('edit')

      saveChapterToCloud(user.uid, projectId, newNote)
    } catch (e) {
      console.error("Failed to create note with content:", e)
    }
  }

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 2000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveCurrentChapterToFolder()
      }
      if (e.key === 'Escape') {
        setIsFocusMode(false)
        setIsZenMode(false)
        setShowSlashMenu(false)
        setSelectedBrainEntryId(null)
        setChapterMoveMenu(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveCurrentChapterToFolder])

  useEffect(() => {
    if (!activeNote || !dirHandle) return
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      if (activeNote && dirHandle && activeNote.content) {
        await saveSingleChapterToFolder(activeNote, dirHandle)
      }
    }, 2000)
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content, dirHandle, saveSingleChapterToFolder])



  const generateChapterTitle = (existingNotes: Note[]): string => {
    const chapterPattern = /^chapter\s*(\d+)/i
    let maxNumber = 0
    
    for (const note of existingNotes) {
      const match = note.title.match(chapterPattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    
    const nextNumber = maxNumber + 1
    return `Chapter ${nextNumber.toString().padStart(2, '0')}`
  }

  const getNextChapterSortOrder = (existingNotes: Note[]) => {
    if (existingNotes.length === 0) return 1
    return Math.max(...existingNotes.map(note => getNoteSortValue(note))) + 1
  }

  const createNewVolume = () => {
    setNewVolumeName(`Volume ${volumes.length + 1}`)
    setNewVolumeIsOpen(true)
    setShowVolumeCreateModal(true)
  }

  const confirmCreateNewVolume = () => {
    if (!projectId) return
    const defaultName = `Volume ${volumes.length + 1}`
    const trimmedTitle = newVolumeName.trim() || defaultName
    const now = Date.now()
    const newVolume: ManuscriptVolume = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      createdAt: now,
      updatedAt: now,
      sortOrder: volumes.length > 0 ? Math.max(...volumes.map(volume => volume.sortOrder)) + 1 : 1,
      isOpen: newVolumeIsOpen
    }
    persistVolumes([...volumes, newVolume].sort((a, b) => a.sortOrder - b.sortOrder))
    setShowVolumeCreateModal(false)
    setNewVolumeName("")
    setCollapsedVolumeIds(prev => {
      const next = new Set(prev)
      next.delete(newVolume.id)
      localStorage.setItem(getCollapsedVolumesStorageKey(), JSON.stringify(Array.from(next)))
      return next
    })
  }

  const toggleVolumeOpen = (volumeId: string) => {
    persistVolumes(volumes.map(volume =>
      volume.id === volumeId
        ? { ...volume, isOpen: !volume.isOpen, updatedAt: Date.now() }
        : volume
    ))
  }

  const toggleVolumeCollapsed = (volumeId: string) => {
    setCollapsedVolumeIds(prev => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      const key = getCollapsedVolumesStorageKey()
      if (key) localStorage.setItem(key, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const renameVolume = (volumeId: string) => {
    const volume = volumes.find(item => item.id === volumeId)
    if (!volume) return
    const title = prompt("Rename volume:", volume.title)
    if (title === null) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    persistVolumes(volumes.map(item =>
      item.id === volumeId ? { ...item, title: trimmedTitle, updatedAt: Date.now() } : item
    ))
  }

  const createNewNote = async (volumeId?: string | null) => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newTitle = generateChapterTitle(notes)
      const targetVolumeId = volumeId !== undefined
        ? (volumeId === UNASSIGNED_VOLUME_ID ? null : volumeId)
        : (volumes.find(volume => volume.isOpen !== false)?.id || volumes[0]?.id || null)
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: newTitle,
        content: "",
        createdAt: now,
        updatedAt: now,
        volumeId: targetVolumeId,
        sortOrder: getNextChapterSortOrder(notes),
      }
      
      let noteList = await getManuscriptLocal(projectId)
      if (!noteList) noteList = []
      const updatedNotes = getOrderedNotesList([...noteList, newNote])
      
      await saveManuscriptLocal(projectId, updatedNotes)
      setNotes(updatedNotes)
      setActiveNoteId(newNote.id)
      setViewMode('edit')

      saveChapterToCloud(user.uid, projectId, newNote)
    } catch (e) {
      console.error("Failed to create note:", e)
    }
  }

  const moveChapterToVolume = async (noteId: string, volumeId: string | null) => {
    if (!projectId) return
    const normalizedVolumeId = volumeId === UNASSIGNED_VOLUME_ID ? null : volumeId
    const movingNote = notes.find(note => note.id === noteId)
    if (!movingNote) return

    const targetVolumeNotes = notes.filter(note => (note.volumeId || null) === normalizedVolumeId && note.id !== noteId)
    const nextSortOrder = targetVolumeNotes.length > 0
      ? Math.max(...targetVolumeNotes.map(note => getNoteSortValue(note))) + 0.01
      : getNextChapterSortOrder(notes)
    const updatedNote: Note = {
      ...movingNote,
      volumeId: normalizedVolumeId,
      sortOrder: nextSortOrder,
      updatedAt: Date.now()
    }
    const updatedNotes = getOrderedNotesList(notes.map(note => note.id === noteId ? updatedNote : note))
    setNotes(updatedNotes)
    await saveManuscriptLocal(projectId, updatedNotes)
    setChapterMoveMenu(null)
    setDraggedChapterId(null)

    if (user) {
      await saveChapterToCloud(user.uid, projectId, updatedNote)
    }
  }

  const deleteNote = async () => {
    if (!projectId || !deleteModal.noteId) return
    try {
      let noteList = await getManuscriptLocal(projectId)
      if (!noteList) noteList = []
      const filtered = noteList.filter((n: Note) => n && n.id !== deleteModal.noteId)
      
      await saveManuscriptLocal(projectId, filtered)
      setNotes(filtered)
      
      if (user) {
        deleteChapterFromCloud(user.uid, projectId, deleteModal.noteId)
      }

      if (activeNoteId === deleteModal.noteId) {
        setActiveNoteId(filtered.length > 0 ? filtered[0].id : null)
      }
      setDeleteModal({ show: false, noteId: '', noteTitle: '' })
    } catch (e) {
      console.error("Failed to delete note:", e)
    }
  }

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const allFilteredIds = filteredNotes.map(n => n.id)
    const allSelected = allFilteredIds.every(id => selectedNoteIds.has(id))
    
    if (allSelected) {
      setSelectedNoteIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedNoteIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedNoteIds(new Set())
      }
      return !prev
    })
  }

  const deleteSelectedNotes = async () => {
    if (!projectId || selectedNoteIds.size === 0) return
    try {
      let noteList = await getManuscriptLocal(projectId)
      if (!noteList) noteList = []
      const filtered = noteList.filter((n: Note) => n && !selectedNoteIds.has(n.id))
      
      await saveManuscriptLocal(projectId, filtered)
      setNotes(filtered)
      
      if (user) {
        selectedNoteIds.forEach(noteId => {
          deleteChapterFromCloud(user.uid, projectId, noteId)
        })
      }

      if (activeNoteId && selectedNoteIds.has(activeNoteId)) {
        setActiveNoteId(filtered.length > 0 ? filtered[0].id : null)
      }
      
      setSelectedNoteIds(new Set())
      setIsSelectionMode(false)
      setShowMultiDeleteModal(false)
    } catch (e) {
      console.error("Failed to delete selected notes:", e)
    }
  }

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNoteId) return
    const updatedNotes = notes.map((n: Note) => 
      n && n.id === activeNoteId ? { ...n, ...updates, updatedAt: Date.now() } : n
    )
    setNotes(updatedNotes)
  }

  const filteredNotes = notes.filter((n: Note) => n &&
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const orderedNotes = getOrderedNotesList(notes)
  const orderedFilteredNotes = getOrderedNotesList(filteredNotes)
  const sortedVolumes = [...volumes].sort((a, b) => a.sortOrder - b.sortOrder)
  const knownVolumeIds = new Set(sortedVolumes.map(volume => volume.id))
  const orphanVolumeIds = Array.from(new Set(orderedFilteredNotes
    .map(note => note.volumeId)
    .filter((volumeId): volumeId is string => typeof volumeId === "string" && volumeId.length > 0 && !knownVolumeIds.has(volumeId))))
  const unassignedFilteredNotes = orderedFilteredNotes.filter(note => !note.volumeId)
  const manuscriptVolumeGroups = [
    ...sortedVolumes.map(volume => ({
      id: volume.id,
      title: volume.title,
      isSystem: false,
      isOpen: volume.isOpen !== false,
      chapters: orderedFilteredNotes.filter(note => note.volumeId === volume.id)
    })),
    ...orphanVolumeIds.map((volumeId, index) => ({
      id: volumeId,
      title: `Recovered Volume ${index + 1}`,
      isSystem: true,
      isOpen: false,
      chapters: orderedFilteredNotes.filter(note => note.volumeId === volumeId)
    })),
    ...(unassignedFilteredNotes.length > 0 || sortedVolumes.length === 0
      ? [{
          id: UNASSIGNED_VOLUME_ID,
          title: sortedVolumes.length === 0 ? "Chapters" : "Unassigned Chapters",
          isSystem: true,
          isOpen: false,
          chapters: unassignedFilteredNotes
        }]
      : [])
  ]

  const sortedTimelineNotes = [...orderedNotes].sort((a, b) => {
    const aNumber = getNoteChapterNumber(a)
    const bNumber = getNoteChapterNumber(b)
    if (aNumber && bNumber) return aNumber - bNumber
    return a.title.localeCompare(b.title, undefined, { numeric: true })
  })

  const manuscriptStats = {
    chapters: notes.length,
    words: notes.reduce((total, note) => total + countWords(note.content || ""), 0),
    brainEntries: brainEntries.length,
    loreEntries: bibleEntries.length,
    criticalBrainEntries: brainEntries.filter(entry => entry.importance === 'critical').length,
    averageChapterWords: notes.length > 0
      ? Math.round(notes.reduce((total, note) => total + countWords(note.content || ""), 0) / notes.length)
      : 0
  }

  const globalSearchResults: GlobalSearchResult[] = (() => {
    const query = globalSearchQuery.trim().toLowerCase()
    if (!query) return []

    const chapterResults = notes
      .filter(note => note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
      .slice(0, 8)
      .map(note => {
        const content = note.content || ""
        const index = content.toLowerCase().indexOf(query)
        const preview = index >= 0 ? content.slice(Math.max(0, index - 60), index + 140) : content.slice(0, 160)
        return {
          id: `chapter-${note.id}`,
          source: 'chapter' as SearchSource,
          title: note.title || "Untitled",
          subtitle: getNoteChapterNumber(note) ? `Chapter ${getNoteChapterNumber(note)}` : "Chapter",
          preview,
          chapterId: note.id
        }
      })

    const brainResults = brainEntries
      .filter(entry =>
        entry.highlightedText.toLowerCase().includes(query) ||
        entry.aiSummary.toLowerCase().includes(query) ||
        (entry.entityName || "").toLowerCase().includes(query) ||
        (entry.connections || []).some(connection => connection.toLowerCase().includes(query))
      )
      .slice(0, 8)
      .map(entry => ({
        id: `brain-${entry.id}`,
        source: 'brain' as SearchSource,
        title: entry.entityName || entry.highlightedText,
        subtitle: `${entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Brain Map"} - ${entry.entityType || "Brain Map"}`,
        preview: entry.aiSummary,
        chapterId: entry.chapterId
      }))

    const loreResults = bibleEntries
      .filter(entry => entry.name.toLowerCase().includes(query) || entry.content.toLowerCase().includes(query))
      .slice(0, 8)
      .map(entry => ({
        id: `lore-${entry.id}`,
        source: 'lore' as SearchSource,
        title: entry.name,
        subtitle: entry.category,
        preview: entry.content.slice(0, 180)
      }))

    return [...chapterResults, ...brainResults, ...loreResults].slice(0, 18)
  })()

  const openGlobalSearchResult = (result: GlobalSearchResult) => {
    if (result.source === 'chapter' && result.chapterId) {
      setActiveNoteId(result.chapterId)
      setShowGlobalSearch(false)
      setViewMode('edit')
    } else if (result.source === 'brain') {
      setActiveSidebarTab('brain')
      setIsLeftSidebarOpen(true)
      setBrainSearchQuery(result.title)
      setShowGlobalSearch(false)
    } else if (result.source === 'lore') {
      const entry = bibleEntries.find(item => item.name === result.title)
      if (entry) {
        setActiveSidebarTab('bible')
        setIsLeftSidebarOpen(true)
        setActiveBibleEntryId(entry.id)
        setIsBibleDrawerOpen(true)
      }
      setShowGlobalSearch(false)
    }
  }

  const brainTypeOptions: { value: BrainTypeFilter; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'character', label: 'Characters' },
    { value: 'place', label: 'Places' },
    { value: 'object', label: 'Objects' },
    { value: 'concept', label: 'Concepts' },
    { value: 'event', label: 'Events' },
    { value: 'foreshadowing', label: 'Foreshadowing' },
    { value: 'unknown', label: 'Unknown' }
  ]

  const getBrainEntryType = (entry: BrainEntry): BrainEntityType => entry.entityType || 'unknown'
  const getBrainEntryImportance = (entry: BrainEntry): BrainImportance => entry.importance || 'minor'
  const getBrainEntryEntityName = (entry: BrainEntry) => entry.entityName || entry.highlightedText

  const filteredBrainEntries = brainEntries.filter(e => {
    const query = brainSearchQuery.toLowerCase()
    const matchesSearch = !query ||
      e.highlightedText.toLowerCase().includes(query) ||
      e.aiSummary.toLowerCase().includes(query) ||
      e.chapterTitle.toLowerCase().includes(query) ||
      (e.entityName || "").toLowerCase().includes(query) ||
      (e.connections || []).some(connection => connection.toLowerCase().includes(query))
    const matchesType = brainTypeFilter === 'all' || getBrainEntryType(e) === brainTypeFilter
    return matchesSearch && matchesType
  })

  const selectedBrainEntry = selectedBrainEntryId 
    ? brainEntries.find(e => e.id === selectedBrainEntryId) || null
    : null

  const getBrainEntryChapterNumber = (entry: BrainEntry) => {
    if (entry.chapterNumber) return entry.chapterNumber

    const chapter = notes.find(note => note.id === entry.chapterId)
    const titleNumber = getChapterNumberFromTitle(chapter?.title || entry.chapterTitle)
    if (titleNumber) return titleNumber

    const chapterIndex = notes.findIndex(note => note.id === entry.chapterId)
    return chapterIndex >= 0 ? chapterIndex + 1 : null
  }

  const getBrainEntryChapterLabel = (entry: BrainEntry) => {
    const chapterNumber = getBrainEntryChapterNumber(entry)
    return chapterNumber ? `Chapter ${chapterNumber}` : "Chapter ?"
  }

  const getBrainEntryChapterTitle = (entry: BrainEntry) => {
    const chapter = notes.find(note => note.id === entry.chapterId)
    return chapter?.title || entry.chapterTitle || "Untitled"
  }

  const formatBrainEntryDate = (entry: BrainEntry) => {
    const timestamp = entry.updatedAt || entry.createdAt
    if (!timestamp) return ""
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const getBrainTypeLabel = (type: BrainEntityType) => {
    const option = brainTypeOptions.find(item => item.value === type)
    return option?.label.replace(/s$/, '') || 'Unknown'
  }

  const renderBrainTypeIcon = (type: BrainEntityType, size = 12) => {
    switch (type) {
      case 'character':
        return <User size={size} />
      case 'place':
        return <MapPin size={size} />
      case 'object':
        return <Package size={size} />
      case 'concept':
        return <Globe size={size} />
      case 'event':
        return <BookOpen size={size} />
      case 'foreshadowing':
        return <Sparkles size={size} />
      default:
        return <BrainCircuit size={size} />
    }
  }

  const getBrainEntityGroups = () => {
    const groups = new Map<string, { name: string; type: BrainEntityType; entries: BrainEntry[]; criticalCount: number }>()

    for (const entry of brainEntries) {
      const name = getBrainEntryEntityName(entry).trim()
      if (!name) continue
      const key = name.toLowerCase()
      const existing = groups.get(key)
      if (existing) {
        existing.entries.push(entry)
        if (getBrainEntryImportance(entry) === 'critical') existing.criticalCount += 1
      } else {
        groups.set(key, {
          name,
          type: getBrainEntryType(entry),
          entries: [entry],
          criticalCount: getBrainEntryImportance(entry) === 'critical' ? 1 : 0
        })
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.criticalCount - a.criticalCount || b.entries.length - a.entries.length || a.name.localeCompare(b.name))
  }

  const brainEntityGroups = getBrainEntityGroups()
  const selectedBrainEntity = selectedBrainEntityName
    ? brainEntityGroups.find(group => group.name.toLowerCase() === selectedBrainEntityName.toLowerCase()) || null
    : null

  const filteredBibleEntries = bibleEntries.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(bibleSearchQuery.toLowerCase()) ||
                          e.content.toLowerCase().includes(bibleSearchQuery.toLowerCase())
    const matchesFilter = bibleCategoryFilter === 'all' || e.category === bibleCategoryFilter
    const matchesGroup = activeBibleGroupId === 'all'
      || (activeBibleGroupId === 'ungrouped' ? !(e.groupIds || []).length : (e.groupIds || []).includes(activeBibleGroupId))
    return matchesSearch && matchesFilter && matchesGroup
  })

  const toggleBibleEntrySelection = (entryId: string) => {
    setSelectedBibleIds(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const toggleBibleSelectAll = () => {
    const allFilteredIds = filteredBibleEntries.map(e => e.id)
    const allSelected = allFilteredIds.every(id => selectedBibleIds.has(id))
    
    if (allSelected) {
      setSelectedBibleIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedBibleIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleBibleSelectionMode = () => {
    setIsBibleSelectionMode(prev => {
      if (prev) {
        setSelectedBibleIds(new Set())
        setIsBibleGroupAddMenuOpen(false)
      }
      return !prev
    })
  }

  const deleteSelectedBibleEntries = async () => {
    if (!projectId || selectedBibleIds.size === 0) return
    try {
      const filtered = bibleEntries.filter(e => !selectedBibleIds.has(e.id))
      setBibleEntries(filtered)
      await saveStoryBibleLocal(projectId, filtered)

      if (user) {
        await Promise.all(
          Array.from(selectedBibleIds).map(id =>
            deleteBibleEntryFromCloud(user.uid, projectId, id)
          )
        )
      }

      if (activeBibleEntryId && selectedBibleIds.has(activeBibleEntryId)) {
        setActiveBibleEntryId(null)
        setIsBibleDrawerOpen(false)
      }

      setSelectedBibleIds(new Set())
      setIsBibleSelectionMode(false)
      setShowMultiBibleDeleteModal(false)
    } catch (e) {
      console.error("Failed to delete selected bible entries:", e)
    }
  }

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'character':
        return <User size={16} className="text-primary" />
      case 'beast':
        return <PawPrint size={16} style={{ color: 'rgb(245, 158, 11)' }} />
      case 'place':
        return <MapPin size={16} style={{ color: 'rgb(16, 185, 129)' }} />
      case 'item':
        return <Package size={16} style={{ color: 'rgb(168, 85, 247)' }} />
      case 'world':
      default:
        return <Globe size={16} className="text-accent" />
    }
  }

  const wordCount = activeNote?.content ? activeNote.content.split(/\s+/).filter(Boolean).length : 0
  const wordGoal = activeNote?.wordGoal || 1200
  const progressPercent = Math.min(100, Math.round((wordCount / wordGoal) * 100))

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <Feather size={24} />
        </div>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <style jsx>{`
        .loading-screen {
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .loading-logo {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
      `}</style>
    </div>
  )

  return (
    <div className={`editor-container theme-${theme} ${isFocusMode || isZenMode ? 'focus-mode' : ''} ${isZenMode ? 'zen-mode' : ''}`}>
      <div className="bg-gradient-radial"></div>

      {/* Slash commands palette */}
      {showSlashMenu && (
        <div className="command-palette-overlay" onClick={() => { setShowSlashMenu(false); setSlashMenuQuery("") }}>
          <div className="command-palette glass" onClick={e => e.stopPropagation()}>
            <div className="palette-header">
              <Sparkles size={14} className="glow-icon" />
              <input 
                type="text" 
                placeholder="Type command name..." 
                value={slashMenuQuery} 
                onChange={(e) => setSlashMenuQuery(e.target.value)}
                autoFocus
              />
              <span className="esc-hint">ESC</span>
            </div>
            <div className="palette-results">
              {filteredCommands.map((command, idx) => (
                <div 
                  key={command.name} 
                  className={`palette-item ${idx === slashMenuIndex ? 'selected' : ''}`}
                  onClick={() => handleSlashSelect(command.action)}
                >
                  <div className="palette-left">
                    <span className="palette-cmd">{command.cmd}</span>
                    <span className="palette-name">{command.name}</span>
                  </div>
                  <span className="palette-desc">{command.desc}</span>
                </div>
              ))}
              {filteredCommands.length === 0 && (
                <div className="empty-palette">No matching commands found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGlobalSearch && (
        <div className="command-palette-overlay" onClick={() => setShowGlobalSearch(false)}>
          <div className="global-search-modal glass" onClick={e => e.stopPropagation()}>
            <div className="palette-header">
              <Search size={15} className="glow-icon" />
              <input
                type="text"
                placeholder="Search chapters, Brain Map, and lore..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowGlobalSearch(false)
                  if (e.key === 'Enter' && globalSearchResults[0]) openGlobalSearchResult(globalSearchResults[0])
                }}
                autoFocus
              />
              <span className="esc-hint">ESC</span>
            </div>
            <div className="global-search-results">
              {globalSearchQuery.trim() && globalSearchResults.length === 0 && (
                <div className="empty-palette">No matches in this manuscript</div>
              )}
              {!globalSearchQuery.trim() && (
                <div className="global-search-empty">
                  <Search size={22} />
                  <span>Search across chapters, Brain Map entries, and story bible lore.</span>
                </div>
              )}
              {globalSearchResults.map(result => (
                <button
                  key={result.id}
                  className={`global-search-result source-${result.source}`}
                  onClick={() => openGlobalSearchResult(result)}
                >
                  <span className="global-result-source">
                    {result.source === 'chapter' ? <FileText size={13} /> : result.source === 'brain' ? <BrainCircuit size={13} /> : <BookOpen size={13} />}
                    {result.source}
                  </span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <p>{result.preview || "No preview available"}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Redesigned Header: Fades out in Zen Mode */}
      <header className="editor-header glass">
        <div className="header-left">
          <button className="btn-icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div className="project-info">
            <span className="project-label">Manuscript</span>
            <span className="project-name">{projectName}</span>
          </div>
        </div>

        <div className="header-center">
          <div className="view-toggle glass-light">
            <button 
              className={`view-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              <Edit3 size={14} />
              Edit
            </button>
            <button 
              className={`view-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
          
          <div className="font-selector glass-light">
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="var(--font-inter)">Inter</option>
              <option value="var(--font-outfit)">Outfit</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Palatino, Palatino Linotype, Book Antiqua, serif">Palatino</option>
              <option value="Bookman, Book Antiqua, serif">Bookman</option>
              <option value="Garamond, serif">Garamond</option>
              <option value="Merriweather, Georgia, serif">Merriweather</option>
              <option value="Lora, Georgia, serif">Lora</option>
              <option value="Roboto Mono, monospace">Roboto Mono</option>
              <option value="Courier New, monospace">Courier</option>
              <option value="monospace">System Mono</option>
            </select>
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
              <option value={20}>20px</option>
              <option value={22}>22px</option>
              <option value={24}>24px</option>
              <option value={26}>26px</option>
              <option value={28}>28px</option>
              <option value={32}>32px</option>
              <option value={36}>36px</option>
              <option value={40}>40px</option>
            </select>
          </div>
          
          <div className="theme-selector glass-light">
            <select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
              <option value="midnight">Midnight Slate</option>
              <option value="sepia">Sepia Book</option>
              <option value="forest">Forest Moss</option>
              <option value="obsidian">Obsidian Dark</option>
              <option value="nordic">Nordic Frost</option>
              <option value="lavender">Plum Lavender</option>
              <option value="solarized-light">Solarized Light</option>
            </select>
          </div>
        </div>

        <div className="header-right">
          <button
            className="btn-icon"
            onClick={() => setShowGlobalSearch(true)}
            title="Search manuscript, Brain Map, and lore"
          >
            <Search size={18} />
          </button>
          <div className={`sync-badge glass-light ${syncStatus}`}>
            {syncStatus === 'saving' ? (
              <Loader2 size={12} className="spin" />
            ) : syncStatus === 'saved' ? (
              <Check size={12} />
            ) : (
              <AlertCircle size={12} />
            )}
            <span>{syncStatus === 'saving' ? 'Saving' : 'Saved'}</span>
          </div>
          {lastSavedAt && (
            <span className="last-saved-label">
              {new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn-icon"
            onClick={() => setShowVersionsModal(true)}
            title="Chapter version history"
            disabled={!activeNote}
          >
            <History size={18} />
          </button>
          <button 
            className={`btn-icon ${showAISidebar ? 'active' : ''}`}
            onClick={() => setShowAISidebar(!showAISidebar)}
            title={showAISidebar ? "Close AI Assistant" : "Open AI Assistant"}
          >
            <Sparkles size={18} />
          </button>

          <button 
            className={`btn-icon ${isTypewriterMode ? 'active' : ''}`}
            onClick={() => setIsTypewriterMode(!isTypewriterMode)}
            title={isTypewriterMode ? "Exit typewriter mode" : "Enter typewriter mode"}
          >
            <Type size={18} />
          </button>
          
          <button 
            className="btn-icon" 
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? "Exit Zen mode" : "Enter Zen mode"}
          >
            {isZenMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Floating Zen mode exit button */}
      {isZenMode && (
        <button className="exit-zen-btn glass" onClick={() => setIsZenMode(false)}>
          <Minimize2 size={14} />
          <span>Exit Zen Mode</span>
        </button>
      )}

      <div className="editor-body">
        
        {/* Activity Bar: Left narrow bar */}
        {!isFocusMode && !isZenMode && (
          <nav className="editor-activity-bar glass">
            <div className="activity-top">
              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'manuscript' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'manuscript' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('manuscript')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Manuscript Chapters"
              >
                <FileText size={20} />
              </button>

              <button
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'insights' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'insights' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('insights')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Manuscript Insights"
              >
                <Layers size={20} />
              </button>

              <button
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'appearance' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'appearance' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('appearance')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Appearance Lab"
              >
                <Eye size={20} />
              </button>

              <button
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'progression' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'progression' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('progression')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Character Progression"
              >
                <TrendingUp size={20} />
              </button>
              
              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'bible' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'bible' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('bible')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="World Bible"
              >
                <Book size={20} />
              </button>

              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'sounds' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'sounds' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('sounds')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Ambient Focus Sounds"
              >
                <Headphones size={20} />
              </button>

              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'brain' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'brain' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('brain')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Brain Map"
              >
                <BrainCircuit size={20} />
              </button>

              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'analytics' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('analytics')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Writing Goals & Analytics"
              >
                <BarChart3 size={20} />
              </button>
            </div>
            
            <div className="activity-bottom">
              <button 
                className="activity-btn toggle-sidebar"
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                title={isLeftSidebarOpen ? "Collapse Side Panel" : "Expand Side Panel"}
              >
                {isLeftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
          </nav>
        )}

        <div className="mobile-fab">
          <button className="fab-btn fab-new" onClick={() => createNewNote()} title="New Chapter">
            <Plus size={24} />
          </button>
          <button className="fab-btn fab-list" onClick={() => setShowChapterDrawer(true)} title="Chapters">
            <BookOpen size={24} />
          </button>
        </div>

        {showChapterDrawer && (
          <div className="chapter-drawer-overlay" onClick={() => setShowChapterDrawer(false)}>
            <div className="chapter-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-header">
                <h3>Chapters</h3>
                <button onClick={() => setShowChapterDrawer(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-search">
                <Search size={14} />
                <input 
                  type="text" 
                  placeholder="Find chapter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="drawer-chapters">
                {filteredNotes.map(note => (
                  <div 
                    key={note.id}
                    className={`chapter-item ${note.id === activeNoteId ? 'active' : ''}`}
                    onClick={() => {
                      setActiveNoteId(note.id)
                      setShowChapterDrawer(false)
                    }}
                  >
                    <FileText size={14} />
                    <span className="chapter-title">{note.title || 'Untitled'}</span>
                  </div>
                ))}
                {filteredNotes.length === 0 && (
                  <div className="empty-chapters">No chapters yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Left Sidebar Panel */}
        {!isFocusMode && !isZenMode && (
          <aside
            className={`editor-sidebar glass ${isLeftSidebarOpen ? 'open' : 'collapsed'}`}
            style={{ width: isLeftSidebarOpen ? leftSidebarWidth : 0 }}
          >
            
            {/* TAB 1: MANUSCRIPT CHAPTERS */}
            {activeSidebarTab === 'manuscript' && (
              <div className="sidebar-tab-content fade-in">
                <div className="sidebar-section">
                  <button className="btn-new" onClick={() => createNewNote()}>
                    <Plus size={16} />
                    New Chapter
                  </button>
                  <button className="btn-export btn-volume-add" onClick={createNewVolume}>
                    <Plus size={16} />
                    Add Volume
                  </button>
                  <button className="btn-export" onClick={() => setExportModal(true)}>
                    <Download size={16} />
                    Export Manuscript
                  </button>
                  {dirHandle && (
                    <div className="linked-folder-info">
                      <span className="folder-name" title={dirHandle.name}>📁 {dirHandle.name}</span>
                      <button className="btn-disconnect-folder" onClick={disconnectFolder} title="Unlink folder">
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="sidebar-search">
                  <Search size={14} />
                  <input 
                    type="text" 
                    placeholder="Find chapter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isLoadingNotes && <Loader2 size={12} className="spin" />}
                </div>

                <div className={`sidebar-chapters-header ${isSelectionMode ? 'selection-active' : ''}`}>
                  {isSelectionMode ? (
                    <>
                      <span className="selection-count">{selectedNoteIds.size} selected</span>
                      <div className="selection-actions">
                        <button className="btn-text-action" onClick={toggleSelectAll}>
                          {selectedNoteIds.size === filteredNotes.length ? 'None' : 'All'}
                        </button>
                        <button 
                          className="btn-text-action danger" 
                          disabled={selectedNoteIds.size === 0}
                          onClick={() => setShowMultiDeleteModal(true)}
                        >
                          Delete
                        </button>
                        <button className="btn-text-action" onClick={toggleSelectionMode}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="section-title">Chapters ({filteredNotes.length})</span>
                      <button className="btn-select-mode" onClick={toggleSelectionMode}>
                        Select
                      </button>
                    </>
                  )}
                </div>

                <div className="chapter-list">
                  {manuscriptVolumeGroups.map(group => {
                    const isCollapsed = collapsedVolumeIds.has(group.id)
                    return (
                      <div
                        key={group.id}
                        className={`volume-group ${draggedChapterId ? 'drag-ready' : ''}`}
                        onDragOver={(e) => {
                          if (draggedChapterId) e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedChapterId) {
                            moveChapterToVolume(draggedChapterId, group.id)
                          }
                        }}
                      >
                        <div className="volume-header">
                          <button
                            type="button"
                            className="volume-toggle"
                            onClick={() => toggleVolumeCollapsed(group.id)}
                            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.title}`}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            type="button"
                            className="volume-title"
                            onClick={() => !group.isSystem && renameVolume(group.id)}
                            title={group.isSystem ? group.title : "Rename volume"}
                          >
                            {group.title}
                          </button>
                          {!group.isSystem && (
                            <button
                              type="button"
                              className={`volume-open-toggle ${group.isOpen ? 'open' : ''}`}
                              onClick={() => toggleVolumeOpen(group.id)}
                              title={group.isOpen ? "Open for new chapters" : "Closed for new chapters"}
                            >
                              {group.isOpen ? "Open" : "Closed"}
                            </button>
                          )}
                          <span className="volume-count">{group.chapters.length}</span>
                          {!group.isSystem && (
                            <button
                              type="button"
                              className="volume-add-chapter"
                              onClick={() => renameVolume(group.id)}
                              title="Rename volume"
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="volume-add-chapter"
                            onClick={() => createNewNote(group.id)}
                            title={`Add chapter to ${group.title}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="volume-chapters">
                            {group.chapters.map(note => {
                              const isSelected = selectedNoteIds.has(note.id);
                              const exportRecord = exportHistory[note.id]
                              const needsExport = !exportRecord || exportRecord.fingerprint !== getChapterExportFingerprint(note)
                              return (
                                <div
                                  key={note.id}
                                  draggable={!isSelectionMode}
                                  onDragStart={() => setDraggedChapterId(note.id)}
                                  onDragEnd={() => setDraggedChapterId(null)}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    setChapterMoveMenu({ noteId: note.id, x: e.clientX, y: e.clientY })
                                  }}
                                  className={`chapter-item ${activeNoteId === note.id ? 'active' : ''} ${isSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
                                  onClick={() => {
                                    if (isSelectionMode) {
                                      toggleNoteSelection(note.id);
                                    } else {
                                      setActiveNoteId(note.id);
                                    }
                                  }}
                                >
                                  {isSelectionMode ? (
                                    <button
                                      type="button"
                                      className={`checkbox-custom ${isSelected ? 'checked' : ''}`}
                                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${note.title || 'Untitled'}`}
                                      aria-pressed={isSelected}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleNoteSelection(note.id)
                                      }}
                                    >
                                      {isSelected && <Check size={10} strokeWidth={3} />}
                                    </button>
                                  ) : (
                                    <FileText size={16} />
                                  )}
                                  <span className="chapter-title">{note.title || 'Untitled'}</span>
                                  {!needsExport && <span className="chapter-exported-badge">Exported</span>}
                                  
                                  {!isSelectionMode && (
                                    <div className="chapter-actions">
                                      <button 
                                        className={`btn-save-chapter ${savedChapters.has(note.id) && !needsExport ? 'saved' : ''}`}
                                        onClick={async (e) => { 
                                          e.stopPropagation(); 
                                          let targetDir = dirHandle
                                          
                                          if (!targetDir && projectId) {
                                            targetDir = await getDirectoryHandleForProject(projectId)
                                            if (targetDir) {
                                              setDirHandle(targetDir)
                                            }
                                          }
                                          
                                          if (targetDir) {
                                            const hasPermission = await verifyPermission(targetDir)
                                            if (hasPermission) {
                                              await saveSingleChapterToFolder(note, targetDir)
                                            } else {
                                              try {
                                                const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
                                                setDirHandle(dir)
                                                await saveFolderHandleToProject(dir)
                                                await saveSingleChapterToFolder(note, dir)
                                              } catch (err) { console.error(err) }
                                            }
                                          } else {
                                            try {
                                              const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
                                              setDirHandle(dir)
                                              await saveFolderHandleToProject(dir)
                                              await saveSingleChapterToFolder(note, dir)
                                            } catch (err) { console.error(err) }
                                          }
                                        }}
                                        title={needsExport ? "Save chapter" : "Chapter already exported"}
                                      >
                                        <Save size={12} />
                                      </button>
                                      <button 
                                        className="btn-delete-chapter"
                                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, noteId: note.id, noteTitle: note.title }) }}
                                        title="Delete chapter"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {group.chapters.length === 0 && (
                              <div className="volume-empty">Drop chapters here or add a new one.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: MANUSCRIPT INSIGHTS */}
            {activeSidebarTab === 'insights' && (
              <div className="sidebar-tab-content insights-panel fade-in">
                <span className="section-title">Manuscript Insights</span>
                <div className="manuscript-insights glass-light">
                  <div className="insights-grid">
                    <div>
                      <strong>{manuscriptStats.words.toLocaleString()}</strong>
                      <span>words</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.averageChapterWords.toLocaleString()}</strong>
                      <span>avg/ch</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.brainEntries}</strong>
                      <span>brain</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.loreEntries}</strong>
                      <span>lore</span>
                    </div>
                  </div>
                  <div className="insight-callout">
                    <Star size={14} />
                    <span>{manuscriptStats.criticalBrainEntries} critical Brain Map entr{manuscriptStats.criticalBrainEntries === 1 ? 'y' : 'ies'}</span>
                  </div>
                </div>

                <div className="insights-section-header">
                  <span>Chapter Timeline</span>
                  <button
                    className="btn-text-action"
                    onClick={() => setShowTimelinePanel(prev => !prev)}
                  >
                    {showTimelinePanel ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showTimelinePanel && (
                  <div className="chapter-timeline insights-timeline">
                    {sortedTimelineNotes.map(note => {
                      const chapterBrainEntries = brainEntries.filter(entry => entry.chapterId === note.id)
                      const chapterWords = countWords(note.content || "")
                      return (
                        <button
                          key={note.id}
                          className={`timeline-item ${note.id === activeNoteId ? 'active' : ''}`}
                          onClick={() => {
                            setActiveNoteId(note.id)
                            setActiveSidebarTab('manuscript')
                          }}
                        >
                          <span className="timeline-dot"></span>
                          <div className="timeline-content">
                            <strong>{getNoteChapterNumber(note) ? `Chapter ${getNoteChapterNumber(note)}` : note.title}</strong>
                            <small>{note.title || 'Untitled'} - {chapterWords.toLocaleString()} words</small>
                            <em>{chapterBrainEntries.length} Brain Map entr{chapterBrainEntries.length === 1 ? 'y' : 'ies'}</em>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Daily Progress Heatmap Section */}
                <div className="heatmap-section">
                  <div className="insights-section-header">
                    <span>Daily Progress Heatmap</span>
                  </div>
                  <div className="heatmap-grid">
                    {last28Days.map((day: { date: Date; dateStr: string; count: number }) => {
                      let colorClass = 'intensity-0';
                      if (day.count > 0 && day.count <= 200) colorClass = 'intensity-1';
                      else if (day.count > 200 && day.count <= 500) colorClass = 'intensity-2';
                      else if (day.count > 500 && day.count <= 1000) colorClass = 'intensity-3';
                      else if (day.count > 1000) colorClass = 'intensity-4';
                      
                      const dayLabel = day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      return (
                        <div 
                          key={day.dateStr} 
                          className={`heatmap-cell ${colorClass}`}
                          title={`${dayLabel}: ${day.count} words`}
                        />
                      );
                    })}
                  </div>
                  <div className="heatmap-legend">
                    <span>Less</span>
                    <div className="heatmap-cell intensity-0" style={{ width: '8px', height: '8px' }} />
                    <div className="heatmap-cell intensity-1" style={{ width: '8px', height: '8px' }} />
                    <div className="heatmap-cell intensity-2" style={{ width: '8px', height: '8px' }} />
                    <div className="heatmap-cell intensity-3" style={{ width: '8px', height: '8px' }} />
                    <div className="heatmap-cell intensity-4" style={{ width: '8px', height: '8px' }} />
                    <span>More</span>
                  </div>
                </div>

                {/* Cultivation Milestones Section */}
                <div className="milestones-section">
                  <div className="insights-section-header">
                    <span>Cultivation Milestones</span>
                    <span className="milestones-progress-text">
                      {unlockedMilestones.size} / {MILESTONES.length} Unlocked
                    </span>
                  </div>
                  
                  <div className="milestones-list">
                    {MILESTONES.map(m => {
                      const isUnlocked = unlockedMilestones.has(m.id);
                      const percent = Math.min(100, Math.round((currentTotalWords / m.reqWords) * 100));
                      return (
                        <div key={m.id} className={`milestone-card glass-light ${isUnlocked ? 'unlocked' : 'locked'}`}>
                          <div className="milestone-badge-container">
                            <span className="milestone-badge">{m.badge}</span>
                            {!isUnlocked && <span className="lock-icon">🔒</span>}
                          </div>
                          <div className="milestone-info">
                            <div className="milestone-title-row">
                              <span className="milestone-title">{m.title}</span>
                              <span className="milestone-req">{m.reqWords.toLocaleString()} words</span>
                            </div>
                            <p className="milestone-desc">{m.description}</p>
                            {!isUnlocked && (
                              <div className="milestone-progress-bar-container">
                                <div className="milestone-progress-bar" style={{ width: `${percent}%` }} />
                                <span className="milestone-progress-label">{percent}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: APPEARANCE PROMPT LAB */}
            {activeSidebarTab === 'appearance' && (
              <div className="sidebar-tab-content appearance-panel fade-in">
                <div className="appearance-header">
                  <span className="section-title">Appearance Lab</span>
                  {activeNote && (
                    <span className="appearance-chapter-chip">
                      {getNoteChapterNumber(activeNote) ? `Chapter ${getNoteChapterNumber(activeNote)}` : "Current chapter"}
                    </span>
                  )}
                </div>

                <div className="appearance-card glass-light">
                  <div className="ai-form-field">
                    <label>Story Bible Entry</label>
                    <select
                      className="ai-select"
                      value={appearanceSelectedEntryId || ""}
                      onChange={(e) => {
                        setAppearanceSelectedEntryId(e.target.value || null)
                        setAppearanceResult(null)
                        setAppearanceError("")
                      }}
                      disabled={appearanceLoading}
                    >
                      <option value="">Choose a person, beast, item, or lore entry...</option>
                      {bibleEntries.map(entry => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} - {entry.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ai-form-field">
                    <label>Visual Style</label>
                    <select
                      className="ai-select"
                      value={appearanceStyle}
                      onChange={(e) => setAppearanceStyle(e.target.value)}
                      disabled={appearanceLoading}
                    >
                      <option value="cinematic fantasy character concept art">Cinematic fantasy concept art</option>
                      <option value="anime key visual, high detail">Anime key visual</option>
                      <option value="dark xianxia character design sheet">Dark xianxia design sheet</option>
                      <option value="realistic film character design">Realistic film character design</option>
                      <option value="game-ready creature concept art">Game-ready creature concept art</option>
                    </select>
                  </div>

                  {aiSelectionText.trim() && (
                    <button
                      className="appearance-selection-btn"
                      onClick={() => {
                        const entry = findLoreEntryFromSelection(aiSelectionText)
                        if (entry) {
                          setAppearanceSelectedEntryId(entry.id)
                          setAppearanceError("")
                        } else {
                          setAppearanceError("The highlighted text does not match a Story Bible entry yet.")
                        }
                      }}
                      disabled={appearanceLoading}
                    >
                      <Sparkles size={13} />
                      Use highlighted name
                    </button>
                  )}

                  {selectedAppearanceEntry && (
                    <div className="appearance-source-card">
                      <strong>{selectedAppearanceEntry.name}</strong>
                      <span>{selectedAppearanceEntry.category}</span>
                      <p>{selectedAppearanceEntry.content ? selectedAppearanceEntry.content.slice(0, 220) : "No lore notes yet. The AI will lean more heavily on the current chapter context."}</p>
                    </div>
                  )}

                  {appearanceError && (
                    <div className="ai-error-box">
                      <AlertCircle size={16} />
                      <span>{appearanceError}</span>
                    </div>
                  )}

                  <button
                    className="btn-ai-action"
                    onClick={() => handleGenerateAppearancePrompts(appearanceSelectedEntryId, aiSelectionText)}
                    disabled={appearanceLoading || (!appearanceSelectedEntryId && !aiSelectionText.trim())}
                  >
                    {appearanceLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Generate Prompts
                      </>
                    )}
                  </button>
                </div>

                {appearanceResult && (
                  <div className="appearance-results">
                    {appearanceResult.overview && (
                      <div className="appearance-overview">
                        <span>Visual Core</span>
                        <p>{appearanceResult.overview}</p>
                      </div>
                    )}

                    {([
                      ["beastForm", "Beast Form"],
                      ["demiHumanForm", "Demi-human Form"],
                      ["humanForm", "Human Form"]
                    ] as Array<[AppearanceFormKey, string]>).map(([formKey, label]) => {
                      const promptText = appearanceResult.prompts?.[formKey]
                      if (!promptText) return null
                      return (
                        <div className="appearance-prompt-card" key={formKey}>
                          <div className="appearance-prompt-header">
                            <strong>{label}</strong>
                            <button
                              className="btn-ai-sub btn-ai-secondary"
                              onClick={() => copyAppearanceText(formKey, promptText)}
                            >
                              <Copy size={12} />
                              {appearanceCopiedKey === formKey ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p>{promptText}</p>
                        </div>
                      )
                    })}

                    {appearanceResult.negativePrompt && (
                      <div className="appearance-prompt-card muted">
                        <div className="appearance-prompt-header">
                          <strong>Negative Prompt</strong>
                          <button
                            className="btn-ai-sub btn-ai-secondary"
                            onClick={() => copyAppearanceText("negative", appearanceResult.negativePrompt || "")}
                          >
                            <Copy size={12} />
                            {appearanceCopiedKey === "negative" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p>{appearanceResult.negativePrompt}</p>
                      </div>
                    )}

                    {Array.isArray(appearanceResult.consistencyNotes) && appearanceResult.consistencyNotes.length > 0 && (
                      <div className="appearance-notes">
                        <span>Keep Consistent</span>
                        {appearanceResult.consistencyNotes.map(note => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                    )}

                    <div className="appearance-actions">
                      <button
                        className="btn-ai-sub btn-ai-primary"
                        onClick={saveAppearanceToLore}
                        disabled={!selectedAppearanceEntry}
                      >
                        <Save size={12} />
                        Append to Lore
                      </button>
                      <button
                        className="btn-ai-sub btn-ai-secondary"
                        onClick={() => copyAppearanceText("all", buildAppearanceLoreContent(appearanceResult))}
                      >
                        <Copy size={12} />
                        {appearanceCopiedKey === "all" ? "Copied" : "Copy All"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CHARACTER PROGRESSION */}
            {activeSidebarTab === 'progression' && (
              <div className="sidebar-tab-content progression-panel fade-in">
                <div className="progression-toolbar">
                  <div className="ai-form-field">
                    <label>Character Profile</label>
                    <select
                      className="ai-select progression-profile-select"
                      value={selectedProgressionProfile?.loreEntryId || progressionSelectedEntryId || ""}
                      onChange={(e) => {
                        const existing = progressionProfiles.find(profile => profile.loreEntryId === e.target.value)
                        setProgressionSelectedEntryId(e.target.value || null)
                        setSelectedProgressionProfileId(existing?.id || null)
                        setProgressionError("")
                        setProgressionNotice("")
                      }}
                      disabled={progressionLoading}
                    >
                      <option value="">Choose a Story Bible entry...</option>
                      {bibleEntries.map(entry => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} - {entry.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {progressionError && (
                    <div className="ai-error-box">
                      <AlertCircle size={16} />
                      <span>{progressionError}</span>
                    </div>
                  )}
                  {progressionNotice && (
                    <div className="progression-notice">
                      <Check size={14} />
                      <span>{progressionNotice}</span>
                    </div>
                  )}
                </div>

                <div className="progression-library-actions">
                  <button className="progression-library-card" onClick={() => setShowProgressionCharactersModal(true)}>
                    <div>
                      <User size={15} />
                      <span>Characters</span>
                    </div>
                    <strong>{progressionProfiles.length}</strong>
                    <p>{selectedProgressionProfile ? selectedProgressionProfile.name : "Open all progression profiles"}</p>
                  </button>
                  <button className="progression-library-card template" onClick={() => setShowProgressionTemplateModal(true)}>
                    <div>
                      <Layers size={15} />
                      <span>Template</span>
                    </div>
                    <strong>{normalizeProgressionTemplateCards(progressionSystem.profileTemplate.cards, progressionSystem.customFields).filter(card => card.enabled).length}</strong>
                    <p>Set the reusable status screen for this novel</p>
                  </button>
                </div>

                <button 
                  className={`progression-action-banner ${progressionBulkUpdating ? 'scanning' : ''}`}
                  onClick={handleProgressionBulkUpdate} 
                  disabled={progressionBulkUpdating || progressionLoading}
                  title="Scan 5 recent chapters and update character profiles"
                >
                  <div className="progression-banner-icon-container">
                    {progressionBulkUpdating ? (
                      <Loader2 className="progression-banner-icon spin" size={20} />
                    ) : (
                      <RefreshCw className="progression-banner-icon" size={20} />
                    )}
                  </div>
                  <div className="progression-banner-content">
                    <h4>Update Character Profiles</h4>
                    <p>{progressionBulkUpdating ? progressionBulkUpdateStatus : "Scan the 5 recent chapters to detect and apply character growth automatically."}</p>
                  </div>
                  {!progressionBulkUpdating && <span className="progression-banner-badge">Scan</span>}
                </button>
                <datalist id="progression-realms">
                  {progressionSystem.realms.map(realm => <option key={realm} value={realm} />)}
                </datalist>
                <datalist id="progression-stages">
                  {progressionSystem.stageLabels.map(stage => <option key={stage} value={stage} />)}
                </datalist>

                {selectedProgressionProfile ? (
                  <div className="progression-detail">
                    <div className="progression-profile-showcase">
                      <div className="progression-showcase-head">
                        <div>
                          <span>{selectedProgressionProfile.realm || selectedProgressionProfile.rank || "Progression Profile"}</span>
                          <h3>{selectedProgressionProfile.name}</h3>
                          <p>{selectedProgressionProfile.title || selectedProgressionProfile.className || selectedProgressionProfile.cultivationPath || "No class/title yet"}</p>
                        </div>
                        <strong>{selectedProgressionProfile.stage || (progressionSystem.showLevels ? `Level ${selectedProgressionProfile.level}` : selectedProgressionProfile.rank || "")}</strong>
                      </div>

                      {progressionSystem.useCustomJsonTemplate && (
                        <div className="json-subtabs" style={{ display: "flex", gap: "0.5rem", padding: "0.25rem 0.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "var(--radius-md)", marginBottom: "1rem" }}>
                          <button
                            type="button"
                            className={`json-subtab-btn ${characterProfileSubTab === 'cards' ? 'active' : ''}`}
                            onClick={() => setCharacterProfileSubTab('cards')}
                            style={{
                              flex: 1,
                              padding: "0.3rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: characterProfileSubTab === 'cards' ? 'var(--indigo-600)' : 'transparent',
                              color: characterProfileSubTab === 'cards' ? '#fff' : 'var(--text-dim)',
                              transition: "all 0.15s ease"
                            }}
                          >
                            Status Cards
                          </button>
                          <button
                            type="button"
                            className={`json-subtab-btn ${characterProfileSubTab === 'json' ? 'active' : ''}`}
                            onClick={() => {
                              setCharacterProfileSubTab('json')
                              setCharacterJsonText(JSON.stringify(selectedProgressionProfile.customJsonData || {}, null, 2))
                            }}
                            style={{
                              flex: 1,
                              padding: "0.3rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: characterProfileSubTab === 'json' ? 'var(--indigo-600)' : 'transparent',
                              color: characterProfileSubTab === 'json' ? '#fff' : 'var(--text-dim)',
                              transition: "all 0.15s ease"
                            }}
                          >
                            JSON Editor
                          </button>
                        </div>
                      )}

                      {progressionSystem.useCustomJsonTemplate && characterProfileSubTab === 'json' ? (
                        <div className="json-profile-raw-editor" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "1.2rem" }}>
                          <textarea
                            className="ai-textarea font-mono text-xs scrollbar"
                            value={characterJsonText}
                            onChange={(e) => setCharacterJsonText(e.target.value)}
                            placeholder="{}"
                            rows={15}
                            style={{ width: "100%", padding: "0.6rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--surface-border)", borderRadius: "var(--radius-sm)", color: "#fff" }}
                          />
                          <button
                            type="button"
                            className="btn-ai-sub btn-ai-primary"
                            onClick={saveCharacterJsonData}
                            style={{ alignSelf: "flex-end" }}
                          >
                            Save JSON Status
                          </button>
                        </div>
                      ) : (
                        <div className="progression-showcase-grid">
                          {progressionSystem.useCustomJsonTemplate ? (
                            (() => {
                              const customJsonData = selectedProgressionProfile.customJsonData || {}
                              const templateKeys = Object.keys(customJsonData)
                              const cardOrder = progressionSystem.jsonCardOrder || []
                              
                              const sortedKeys = [...templateKeys].sort((a, b) => {
                                const aIdx = cardOrder.indexOf(a)
                                const bIdx = cardOrder.indexOf(b)
                                if (aIdx === -1 && bIdx === -1) return 0
                                if (aIdx === -1) return 1
                                if (bIdx === -1) return -1
                                return aIdx - bIdx
                              })
                              
                              if (sortedKeys.length === 0) {
                                return (
                                  <div className="progression-growth-empty" style={{ gridColumn: "span 2" }}>
                                    <p>No JSON data defined yet.</p>
                                    <small>Switch to JSON Editor tab to define the status attributes or run Profile Update.</small>
                                  </div>
                                )
                              }
                              
                              return sortedKeys.map((key, index) => {
                                const value = customJsonData[key]
                                const colorClass = getProgressionCardColor(index, "compound")
                                
                                return (
                                  <div key={key} className={`progression-template-display-card color-${colorClass}`} style={{ position: "relative" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                      <span style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{key}</span>
                                      <div style={{ display: "flex", gap: "2px" }}>
                                        <button
                                          type="button"
                                          className="btn-icon-mini"
                                          onClick={() => moveJsonCard(key, 'up')}
                                          disabled={index === 0}
                                          style={{ background: "transparent", border: "none", color: "var(--text-dim)", padding: "1px", cursor: index === 0 ? "not-allowed" : "pointer" }}
                                          title="Move Up"
                                        >
                                          <ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-icon-mini"
                                          onClick={() => moveJsonCard(key, 'down')}
                                          disabled={index === sortedKeys.length - 1}
                                          style={{ background: "transparent", border: "none", color: "var(--text-dim)", padding: "1px", cursor: index === sortedKeys.length - 1 ? "not-allowed" : "pointer" }}
                                          title="Move Down"
                                        >
                                          <ChevronDown size={12} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="json-card-body">
                                      {renderCustomJsonValue(value)}
                                    </div>
                                  </div>
                                )
                              })
                            })()
                          ) : (
                            getProgressionTemplateCardsForProfile(selectedProgressionProfile).map((templateCard, cardIndex) => {
                              const cardValue = getProgressionTemplateCardValue(selectedProgressionProfile, templateCard)
                              const cardFields = getProgressionTemplateCardFields(selectedProgressionProfile, templateCard)
                              const ratio = templateCard.type === "progress" || templateCard.type === "resource"
                                ? parseProgressionRatio(cardValue)
                                : null
                              const progressPercent = ratio ? Math.max(0, Math.min(100, Math.round((ratio.current / ratio.max) * 100))) : 0

                              if (templateCard.type === "ability") {
                                return (
                                  <div key={templateCard.id} className={`progression-template-display-card wide color-${templateCard.color || getProgressionCardColor(cardIndex, templateCard.type)}`}>
                                    <span>{templateCard.label}</span>
                                    <div className="progression-template-ability-list">
                                      {selectedProgressionProfile.abilities.length === 0 ? (
                                        <p>No abilities tracked yet.</p>
                                      ) : selectedProgressionProfile.abilities.map(ability => (
                                        <div key={ability.id}>
                                          <strong>{ability.name}</strong>
                                          <em>{ability.rank || `Lv ${ability.level}`}</em>
                                          <p>{ability.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              }

                              const isAffinityCard = templateCard.label.toLowerCase() === "affinity" || templateCard.sourceKey.toLowerCase() === "affinity";
                              const namesField = cardFields.find(f => f.label === "Affinity Names");
                              const rankField = cardFields.find(f => f.label === "Rank");
                              const namesVal = (namesField && namesField.value) ? String(namesField.value) : "";
                              const rankVal = (rankField && rankField.value) ? String(rankField.value) : "";
                              const affinitiesList = isAffinityCard ? getAffinitiesList(namesVal, rankVal) : [];

                              if (isAffinityCard && affinitiesList.length > 0) {
                                return (
                                  <div key={templateCard.id} className={`progression-template-display-card color-${templateCard.color || getProgressionCardColor(cardIndex, templateCard.type)}`}>
                                    <span>{templateCard.label}</span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                      {affinitiesList.map((aff, affIdx) => (
                                        <div className="progression-template-field-list" key={affIdx}>
                                          <div>
                                            <small>Affinity</small>
                                            <strong>{aff.name}</strong>
                                          </div>
                                          <div>
                                            <small>Rank</small>
                                            <strong>{aff.rank}</strong>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {ratio && (
                                      <div className="progression-template-progress">
                                        <div><i style={{ width: `${progressPercent}%` }} /></div>
                                        <small>{progressPercent}%</small>
                                      </div>
                                    )}
                                  </div>
                                )
                              }

                              return (
                                <div key={templateCard.id} className={`progression-template-display-card color-${templateCard.color || getProgressionCardColor(cardIndex, templateCard.type)}`}>
                                  <span>{templateCard.label}</span>
                                  {templateCard.fields.length > 1 || templateCard.type === "compound" || templateCard.type === "stat" || templateCard.type === "rank" ? (
                                    <div className="progression-template-field-list">
                                      {cardFields.map(field => (
                                        <div key={field.label}>
                                          <small>{field.label}</small>
                                          <strong>{typeof field.value === "object" ? JSON.stringify(field.value) : (field.value || "Not set")}</strong>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <strong>{typeof cardValue === "object" ? JSON.stringify(cardValue) : (cardValue || "Not set")}</strong>
                                  )}
                                  {ratio && (
                                    <div className="progression-template-progress">
                                      <div><i style={{ width: `${progressPercent}%` }} /></div>
                                      <small>{progressPercent}%</small>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="progression-profile-footer-actions">
                      <button
                        className="btn-ai-sub btn-ai-primary"
                        onClick={() => {
                          const entryId = selectedProgressionProfile?.loreEntryId || progressionSelectedEntryId || null
                          handleProgressionUpdate(entryId, aiSelectionText)
                        }}
                        disabled={progressionLoading}
                      >
                        {progressionLoading ? <Loader2 size={13} className="spin" /> : <TrendingUp size={13} />}
                        Update Profile
                      </button>
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => openProgressionEditModal(selectedProgressionProfile)}>
                        <Edit3 size={13} />
                        Edit Profile
                      </button>
                      <button className="btn-ai-sub btn-ai-secondary progression-auto-btn" onClick={() => handleProgressionUpdate(null, "")} disabled={progressionLoading || progressionProfiles.length === 0}>
                        <BrainCircuit size={13} />
                        Auto Match
                      </button>
                      <button className="btn-ai-sub btn-ai-secondary danger-text" onClick={() => deleteProgressionProfile(selectedProgressionProfile.id)}>
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>

                    <div className="progression-growth-timeline">
                      <div className="progression-growth-header">
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <History size={14} />
                          <strong>Recent Growth</strong>
                        </div>
                        <div className="growth-toggle-buttons">
                          <button
                            className={`btn-toggle-growth ${!showStatsChart ? 'active' : ''}`}
                            onClick={() => setShowStatsChart(false)}
                          >
                            Timeline
                          </button>
                          <button
                            className={`btn-toggle-growth ${showStatsChart ? 'active' : ''}`}
                            onClick={() => setShowStatsChart(true)}
                          >
                            Chart
                          </button>
                        </div>
                      </div>

                      {showStatsChart ? (
                        <div className="growth-chart-container" style={{ position: "relative" }}>
                          <div className="growth-chart-selector" style={{ margin: "0.5rem 0 0.75rem 0", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Stat to plot:</span>
                            <select
                              className="ai-select"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", width: "auto", height: "auto" }}
                              value={selectedGraphStat}
                              onChange={(e) => {
                                setSelectedGraphStat(e.target.value)
                                setHoveredGraphPoint(null)
                              }}
                            >
                              {progressionSystem.useCustomJsonTemplate ? (
                                (() => {
                                  const numericKeys = getNumericKeysOfJson(selectedProgressionProfile?.customJsonData || {})
                                  if (numericKeys.length === 0) {
                                    return <option value="">No numeric attributes</option>
                                  }
                                  return numericKeys.map(key => (
                                    <option key={key} value={key}>{key.replace(/\./g, " > ")}</option>
                                  ))
                                })()
                              ) : (
                                <>
                                  <option value="level">Level</option>
                                  {progressionSystem.realms.length > 0 && <option value="cultivation">Cultivation Rank</option>}
                                  {progressionSystem.statKeys.map(key => (
                                    <option key={key} value={key}>{formatProgressionStatLabel(key)}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          </div>

                          {growthChartData.length < 2 ? (
                            <div className="progression-growth-empty" style={{ minHeight: "150px" }}>
                              <p>Not enough points to plot a chart.</p>
                              <small>You need at least 2 updates in character history to render a growth graph.</small>
                            </div>
                          ) : (
                            <div style={{ position: "relative", width: "100%" }}>
                              {/* SVG Chart */}
                              {(() => {
                                const width = 300
                                const height = 150
                                const paddingX = 35
                                const paddingY = 20
                                const values = growthChartData.map(d => d.value)
                                const minVal = Math.min(...values)
                                const maxVal = Math.max(...values)
                                const yMin = minVal === maxVal ? minVal - 1 : minVal
                                const yMax = minVal === maxVal ? maxVal + 1 : maxVal
                                const yRange = yMax - yMin

                                const points = growthChartData.map((d, idx) => {
                                  const x = paddingX + (idx / (growthChartData.length - 1)) * (width - 2 * paddingX)
                                  const y = (height - paddingY) - ((d.value - yMin) / yRange) * (height - 2 * paddingY)
                                  return { x, y, ...d }
                                })

                                const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                                const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`

                                return (
                                  <>
                                    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
                                      <defs>
                                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.3"/>
                                          <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0"/>
                                        </linearGradient>
                                      </defs>
                                      
                                      {/* Grid Lines */}
                                      <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--color-border, #313244)" strokeDasharray="3,3" />
                                      <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--color-border, #313244)" strokeDasharray="3,3" />
                                      <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--color-border, #313244)" strokeDasharray="3,3" />

                                      {/* Y-Axis Label Indicators */}
                                      <text x={paddingX - 5} y={paddingY + 3} textAnchor="end" fill="var(--color-text-muted, #a6adc8)" fontSize="8px">
                                        {selectedGraphStat === "cultivation" ? "Max" : yMax}
                                      </text>
                                      <text x={paddingX - 5} y={height - paddingY + 3} textAnchor="end" fill="var(--color-text-muted, #a6adc8)" fontSize="8px">
                                        {selectedGraphStat === "cultivation" ? "Min" : yMin}
                                      </text>

                                      {/* Area Fill */}
                                      <path d={areaD} fill="url(#chartGradient)" />

                                      {/* Line */}
                                      <path d={pathD} fill="none" stroke="var(--color-primary, #6366f1)" strokeWidth={2} />

                                      {/* Points */}
                                      {points.map((p, idx) => (
                                        <g key={idx}>
                                          <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r={hoveredGraphPoint?.index === idx ? 5 : 3}
                                            fill="var(--color-primary, #6366f1)"
                                            stroke="var(--color-bg, #1e1e2e)"
                                            strokeWidth={1.5}
                                            style={{ transition: "all 0.15s ease" }}
                                          />
                                          {/* Invisible larger hover circle */}
                                          <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r={12}
                                            fill="transparent"
                                            style={{ cursor: "pointer" }}
                                            onMouseEnter={() => setHoveredGraphPoint({ x: p.x, y: p.y, value: p.value, label: p.label, index: idx })}
                                            onMouseLeave={() => setHoveredGraphPoint(null)}
                                          />
                                        </g>
                                      ))}
                                    </svg>

                                    {/* Tooltip */}
                                    {hoveredGraphPoint && (
                                      <div
                                        className="growth-chart-tooltip"
                                        style={{
                                          position: "absolute",
                                          left: `${(hoveredGraphPoint.x / width) * 100}%`,
                                          top: `${hoveredGraphPoint.y - 12}px`,
                                          transform: "translate(-50%, -100%)",
                                          pointerEvents: "none",
                                          zIndex: 100
                                        }}
                                      >
                                        <div className="growth-tooltip-content">
                                          <strong>{hoveredGraphPoint.label}</strong>
                                          <span>Ch {growthChartData[hoveredGraphPoint.index]?.chapterNumber ?? "?"}: {growthChartData[hoveredGraphPoint.index]?.chapterTitle}</span>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {selectedProgressionProfile.history.length === 0 ? (
                            <div className="progression-growth-empty">
                              <p>No chapter updates recorded yet.</p>
                              <small>Run Update Profile from a chapter to build a canon-backed trail of changes.</small>
                            </div>
                          ) : (
                            <div className="progression-growth-list">
                              {[...selectedProgressionProfile.history]
                                .sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0))
                                .slice(0, 6)
                                .map(historyEntry => {
                                  const statEntries = Object.entries(historyEntry.statChanges || {})
                                    .filter(([, value]) => typeof value === "number" && value !== 0)
                                  const levelChanged = historyEntry.levelBefore !== historyEntry.levelAfter
                                  const realmChanged = Boolean(historyEntry.realmBefore || historyEntry.realmAfter)
                                    && (historyEntry.realmBefore || "") !== (historyEntry.realmAfter || "")
                                  const stageChanged = Boolean(historyEntry.stageBefore || historyEntry.stageAfter)
                                    && (historyEntry.stageBefore || "") !== (historyEntry.stageAfter || "")
                                  const abilityChanges = historyEntry.abilityChanges || []
                                  const rewards = historyEntry.rewards || []
                                  const evidence = historyEntry.evidence || []

                                  return (
                                    <details className="progression-growth-item" key={historyEntry.id}>
                                      <summary>
                                        <div className="progression-growth-summary-main">
                                          <span>Chapter {historyEntry.chapterNumber ?? "?"}</span>
                                          <strong>{historyEntry.chapterTitle || "Untitled chapter"}</strong>
                                          {formatProgressionDate(historyEntry.appliedAt) && (
                                            <small>{formatProgressionDate(historyEntry.appliedAt)}</small>
                                          )}
                                        </div>
                                        <div className="progression-growth-deltas">
                                          {levelChanged && <em>Lv {historyEntry.levelBefore} -&gt; {historyEntry.levelAfter}</em>}
                                          {realmChanged && <em>{historyEntry.realmBefore || "Unknown"} -&gt; {historyEntry.realmAfter || "Unknown"}</em>}
                                          {stageChanged && <em>{historyEntry.stageBefore || "Unknown"} -&gt; {historyEntry.stageAfter || "Unknown"}</em>}
                                          {!levelChanged && !realmChanged && !stageChanged && <em>Reviewed</em>}
                                        </div>
                                      </summary>

                                      <div className="progression-growth-body">
                                        <p>{historyEntry.summary || "Progression reviewed for this chapter."}</p>

                                        {statEntries.length > 0 && (
                                          <div className="progression-growth-detail-block">
                                            <span>Stat Changes</span>
                                            <div className="progression-growth-chip-list">
                                              {statEntries.map(([key, value]) => (
                                                <em key={key}>{formatProgressionStatLabel(key)} {Number(value) > 0 ? "+" : ""}{value}</em>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {abilityChanges.length > 0 && (
                                          <div className="progression-growth-detail-block">
                                            <span>Abilities</span>
                                            <ul>
                                              {abilityChanges.map((item, index) => {
                                                if (!item) return null
                                                if (typeof item === "object") {
                                                  const obj = item as { name?: string; level?: string | number; rank?: string; description?: string }
                                                  const levelStr = obj.rank || (obj.level ? `Lv ${obj.level}` : "")
                                                  return (
                                                    <li key={`${historyEntry.id}-ability-${index}`}>
                                                      <strong>{obj.name || "Ability"}</strong> {levelStr && `(${levelStr})`}
                                                      {obj.description && ` - ${obj.description}`}
                                                    </li>
                                                  )
                                                }
                                                return <li key={`${historyEntry.id}-ability-${index}`}>{String(item)}</li>
                                              })}
                                            </ul>
                                          </div>
                                        )}

                                        {rewards.length > 0 && (
                                          <div className="progression-growth-detail-block">
                                            <span>Rewards</span>
                                            <ul>
                                              {rewards.map((item, index) => (
                                                <li key={`${historyEntry.id}-reward-${index}`}>
                                                  {typeof item === "object" ? JSON.stringify(item) : String(item)}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {evidence.length > 0 && (
                                          <div className="progression-growth-detail-block evidence">
                                            <span>Canon Evidence</span>
                                            <ul>
                                              {evidence.map((item, index) => (
                                                <li key={`${historyEntry.id}-evidence-${index}`}>
                                                  {typeof item === "object" ? JSON.stringify(item) : String(item)}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                  )
                                })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : selectedProgressionBibleEntry ? (
                  <div className="progression-create-card">
                    <div>
                      <span>Selected Story Bible Entry</span>
                      <strong>{selectedProgressionBibleEntry.name}</strong>
                      <p>{selectedProgressionBibleEntry.category} - create a progression profile from this entry, then update it from the active chapter.</p>
                    </div>
                    <button
                      className="btn-ai-sub btn-ai-primary"
                      onClick={() => handleProgressionUpdate(selectedProgressionBibleEntry.id, aiSelectionText)}
                      disabled={progressionLoading}
                    >
                      {progressionLoading ? <Loader2 size={13} className="spin" /> : <TrendingUp size={13} />}
                      Create / Update Profile
                    </button>
                  </div>
                ) : (
                  <div className="empty-state-text">Highlight a character name and click Progress to create their profile.</div>
                )}
              </div>
            )}

            {/* TAB 5: CHARACTER & WORLD BIBLE */}
            {activeSidebarTab === 'bible' && (
              <div className="sidebar-tab-content fade-in flex flex-col h-full">
                <div className="sidebar-section bible-header-actions">
                  <button className="btn-new" onClick={createNewBibleEntry} style={{ flex: 1 }}>
                    <Plus size={14} />
                    New Lore
                  </button>
                  <button className="btn-export" onClick={() => setShowAILoreModal(true)} style={{ flex: 1, marginTop: 0, padding: '0.75rem' }}>
                    <Sparkles size={14} className="text-accent" style={{ marginRight: '4px' }} />
                    AI Generate
                  </button>
                </div>
                
                <div className="sidebar-search">
                  <Search size={14} />
                  <input 
                    type="text" 
                    placeholder="Find character or lore..."
                    value={bibleSearchQuery}
                    onChange={(e) => setBibleSearchQuery(e.target.value)}
                  />
                </div>

                <div className={`sidebar-chapters-header ${isBibleSelectionMode ? 'selection-active' : ''}`}>
                  {isBibleSelectionMode ? (
                    <>
                      <span className="selection-count">{selectedBibleIds.size} selected</span>
                      <div className="selection-actions">
                        <button className="btn-text-action" onClick={toggleBibleSelectAll}>
                          {selectedBibleIds.size === filteredBibleEntries.length ? 'None' : 'All'}
                        </button>
                        <div className="selection-dropdown">
                          <button
                            className="btn-text-action selection-add-btn"
                            disabled={selectedBibleIds.size === 0}
                            onClick={() => setIsBibleGroupAddMenuOpen(prev => !prev)}
                            aria-expanded={isBibleGroupAddMenuOpen}
                            aria-haspopup="menu"
                          >
                            Add
                            <ChevronDown size={12} />
                          </button>
                          {isBibleGroupAddMenuOpen && (
                            <div className="selection-group-menu" role="menu">
                              <div className="selection-menu-label">Add to group</div>
                              {bibleGroups.length === 0 ? (
                                <div className="selection-menu-empty">No groups yet</div>
                              ) : (
                                bibleGroups.map(group => (
                                  <button
                                    key={group.id}
                                    className="selection-menu-item"
                                    onClick={() => addSelectedBibleEntriesToExistingGroup(group.id)}
                                    role="menuitem"
                                  >
                                    <span>{group.name}</span>
                                    <strong>{bibleEntries.filter(entry => (entry.groupIds || []).includes(group.id)).length}</strong>
                                  </button>
                                ))
                              )}
                              <button
                                className="selection-menu-item create"
                                onClick={addSelectedBibleEntriesToGroup}
                                role="menuitem"
                              >
                                <Plus size={12} />
                                New Group
                              </button>
                            </div>
                          )}
                        </div>
                        <button 
                          className="btn-text-action danger" 
                          disabled={selectedBibleIds.size === 0}
                          onClick={() => setShowMultiBibleDeleteModal(true)}
                        >
                          Delete
                        </button>
                        <button className="btn-text-action" onClick={toggleBibleSelectionMode}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Story Bible</span>
                      <button className="btn-select-mode" onClick={toggleBibleSelectionMode}>
                        Select
                      </button>
                    </>
                  )}
                </div>

                <div className="bible-filters">
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'character' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('character')}
                  >
                    People
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'beast' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('beast')}
                  >
                    Beasts
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'place' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('place')}
                  >
                    Places
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'world' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('world')}
                  >
                    World
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'item' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('item')}
                  >
                    Items
                  </button>
                </div>

                <div className="bible-group-strip">
                  <button
                    className={`bible-group-chip ${activeBibleGroupId === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveBibleGroupId('all')}
                  >
                    All Groups
                  </button>
                  {bibleGroups.map(group => {
                    const count = bibleEntries.filter(entry => (entry.groupIds || []).includes(group.id)).length
                    return (
                      <button
                        key={group.id}
                        className={`bible-group-chip ${activeBibleGroupId === group.id ? 'active' : ''} ${draggedBibleEntryId ? 'drop-ready' : ''}`}
                        onClick={() => setActiveBibleGroupId(group.id)}
                        onDoubleClick={() => renameBibleGroup(group.id)}
                        onDragOver={(e) => {
                          if (draggedBibleEntryId) e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedBibleEntryId) addBibleEntriesToGroup([draggedBibleEntryId], group.id)
                        }}
                        title="Double-click to rename. Drop lore entries here to group them."
                      >
                        <span>{group.name}</span>
                        <strong>{count}</strong>
                      </button>
                    )
                  })}
                  <button
                    className={`bible-group-chip ${activeBibleGroupId === 'ungrouped' ? 'active' : ''}`}
                    onClick={() => setActiveBibleGroupId('ungrouped')}
                  >
                    Ungrouped
                  </button>
                  <button className="bible-group-chip add" onClick={createBibleGroup}>
                    <Plus size={12} />
                    Group
                  </button>
                </div>

                <div className="chapter-list bible-list">
                  {filteredBibleEntries.map(entry => {
                    const isSelected = selectedBibleIds.has(entry.id);
                    return (
                      <div 
                        key={entry.id} 
                        draggable={!isBibleSelectionMode}
                        onDragStart={() => setDraggedBibleEntryId(entry.id)}
                        onDragEnd={() => setDraggedBibleEntryId(null)}
                        className={`chapter-item ${activeBibleEntryId === entry.id ? 'active' : ''} ${isBibleSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isBibleSelectionMode) {
                            toggleBibleEntrySelection(entry.id)
                          } else {
                            setActiveBibleEntryId(entry.id)
                            setIsBibleDrawerOpen(true)
                          }
                        }}
                      >
                        {isBibleSelectionMode ? (
                          <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        ) : (
                          renderCategoryIcon(entry.category)
                        )}
                        <span className="chapter-title">{entry.name || 'Untitled'}</span>
                        {(entry.groupIds || []).length > 0 && (
                          <span className="bible-entry-groups">
                            {(entry.groupIds || [])
                              .map(groupId => bibleGroups.find(group => group.id === groupId)?.name)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}
                          </span>
                        )}
                        {!isBibleSelectionMode && (
                          <button 
                            className="btn-delete-chapter"
                            onClick={(e) => { e.stopPropagation(); deleteBibleEntry(entry.id) }}
                            title="Delete entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {filteredBibleEntries.length === 0 && (
                    <div className="empty-state-text">No lore entries found</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: AMBIENT FOCUS AUDIO */}
            {activeSidebarTab === 'sounds' && (
              <div className="sidebar-tab-content sound-panel fade-in">
                <span className="section-title">Focus Soundscape</span>
                <p className="ai-instructions">Play dynamic noise synthesis offline to block distractions.</p>
                
                <div className="sound-options">
                  <button 
                    className={`sound-card ${activeSound === 'none' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('none')}
                  >
                    <VolumeX size={20} />
                    <div className="sound-info">
                      <span className="sound-title">Silence</span>
                      <span className="sound-desc">Muted</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'brown' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('brown')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Brown Noise</span>
                      <span className="sound-desc">Deep focused rumble</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'rain' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('rain')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Rain shower</span>
                      <span className="sound-desc">Gentle raindrops</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'white' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('white')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">White Noise</span>
                      <span className="sound-desc">Steady high frequency mask</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'cafe' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('cafe')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Cozy Cafe</span>
                      <span className="sound-desc">Soft clinks & murmurs</span>
                    </div>
                  </button>
                </div>

                <div className="volume-control">
                  <div className="volume-label">
                    <span>Volume</span>
                    <span>{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="volume-slider"
                  />
                </div>

                <div className="zen-section">
                  <span className="section-title">Zen Mode</span>
                  <button className="btn-new" onClick={() => setIsZenMode(true)}>
                    <Maximize2 size={16} />
                    Enter Zen Mode
                  </button>
                </div>

                {/* Focus Sprint Timer Section */}
                <div className="focus-sprint-section glass-light">
                  <span className="section-title">Focus Sprint</span>
                  <p className="ai-instructions">Set a time-box to write. Completing plays a C Major chime.</p>
                  
                  <div className="sprint-timer-display">
                    {Math.floor(sprintTimeRemaining / 60)}:
                    {String(sprintTimeRemaining % 60).padStart(2, '0')}
                  </div>

                  {(sprintActive || sprintTimeRemaining < sprintDuration) && (
                    <div className="timer-progress-container" style={{ marginBottom: '8px' }}>
                      <div 
                        className="timer-progress-bar" 
                        style={{ width: `${(1 - sprintTimeRemaining / sprintDuration) * 100}%` }}
                      />
                      <div className="sprint-stats">
                        <span>Words: <strong>{sprintWordsWritten}</strong></span>
                        <span>Status: <strong>{sprintActive ? 'Active' : 'Paused'}</strong></span>
                      </div>
                    </div>
                  )}

                  <div className="timer-presets">
                    <button 
                      className={`preset-btn ${sprintDuration === 900 && !sprintActive ? 'active' : ''}`}
                      disabled={sprintActive}
                      onClick={() => startSprint(900)}
                    >
                      15m
                    </button>
                    <button 
                      className={`preset-btn ${sprintDuration === 1500 && !sprintActive ? 'active' : ''}`}
                      disabled={sprintActive}
                      onClick={() => startSprint(1500)}
                    >
                      25m
                    </button>
                    <button 
                      className={`preset-btn ${sprintDuration === 2700 && !sprintActive ? 'active' : ''}`}
                      disabled={sprintActive}
                      onClick={() => startSprint(2700)}
                    >
                      45m
                    </button>
                    <button 
                      className={`preset-btn ${sprintDuration === 3600 && !sprintActive ? 'active' : ''}`}
                      disabled={sprintActive}
                      onClick={() => startSprint(3600)}
                    >
                      60m
                    </button>
                  </div>

                  <div className="timer-controls">
                    {!sprintActive && sprintTimeRemaining === sprintDuration ? (
                      <button className="btn-new w-full justify-center" onClick={() => startSprint(sprintDuration)}>
                        <Play size={14} /> Start Sprint
                      </button>
                    ) : (
                      <div className="flex gap-2 w-full">
                        {sprintActive ? (
                          <button className="btn-secondary flex-1 justify-center" onClick={pauseSprint}>
                            <Pause size={14} /> Pause
                          </button>
                        ) : (
                          <button className="btn-new flex-1 justify-center" onClick={resumeSprint}>
                            <Play size={14} /> Resume
                          </button>
                        )}
                        <button className="btn-danger justify-center px-3" onClick={resetSprint}>
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BRAIN MAP */}
            {activeSidebarTab === 'brain' && (
              <div className="sidebar-tab-content brain-panel fade-in">
                <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Brain Map</span>
                {brainEntityGroups.length > 0 && (
                  <div className="brain-entity-strip">
                    {brainEntityGroups.slice(0, 6).map(group => (
                      <button
                        key={group.name}
                        className="brain-entity-chip"
                        onClick={() => setSelectedBrainEntityName(group.name)}
                        title={group.name}
                      >
                        {renderBrainTypeIcon(group.type, 11)}
                        <span>{group.name}</span>
                        <strong>{group.entries.length}</strong>
                      </button>
                    ))}
                  </div>
                )}

                <div className="brain-ask-panel glass-light">
                  <div className="brain-ask-header">
                    <MessageSquare size={13} />
                    <span>Ask Brain Map</span>
                  </div>
                  <textarea
                    value={brainAskQuestion}
                    onChange={(e) => setBrainAskQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault()
                        askBrainMap()
                      }
                    }}
                    placeholder="Where did I first mention the black door?"
                    className="brain-ask-input"
                  />
                  <button
                    className="brain-ask-button"
                    onClick={askBrainMap}
                    disabled={brainAskLoading || !brainAskQuestion.trim()}
                  >
                    {brainAskLoading ? <Loader2 size={13} className="spin" /> : <MessageSquare size={13} />}
                    Ask
                  </button>
                  {(brainAskAnswer || brainAskError) && (
                    <div className={`brain-ask-answer ${brainAskError ? 'error' : ''}`}>
                      {brainAskError ? brainAskError : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{brainAskAnswer}</ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
                <p className="ai-instructions">Highlight text and click Brain to save with AI context.</p>
                
                <div className="search-bar" style={{ marginBottom: '0.75rem' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search brain entries..."
                    value={brainSearchQuery}
                    onChange={(e) => setBrainSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <select
                  value={brainTypeFilter}
                  onChange={(e) => setBrainTypeFilter(e.target.value as BrainTypeFilter)}
                  className="brain-type-filter"
                >
                  {brainTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <div className="brain-entries-list">
                  {(() => {
                    const filtered = filteredBrainEntries
                    
                    if (filtered.length === 0) {
                      return <div className="empty-state-text">No brain entries yet. Highlight text and click Brain to add.</div>
                    }

                    let lastChapter = ""
                    return filtered.map((entry) => {
                      const showDivider = entry.chapterTitle !== lastChapter
                      lastChapter = entry.chapterTitle
                      return (
                        <div key={entry.id}>
                          {showDivider && (
                            <div className="brain-chapter-divider">
                              <span className="brain-chapter-label">— {entry.chapterTitle || "Untitled"} —</span>
                            </div>
                          )}
                          <div 
                            className="brain-entry-card glass-light"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedBrainEntryId(entry.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setSelectedBrainEntryId(entry.id)
                              }
                            }}
                            aria-label={`Open Brain Map entry for ${entry.highlightedText}`}
                          >
                            <div className="brain-entry-header">
                              <div className="brain-entry-card-main">
                                <div className="brain-entry-meta-row">
                                  <span className="brain-chapter-badge">{getBrainEntryChapterLabel(entry)}</span>
                                  <button
                                    className={`brain-type-badge type-${getBrainEntryType(entry)}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setBrainTypeFilter(getBrainEntryType(entry))
                                    }}
                                    title={getBrainTypeLabel(getBrainEntryType(entry))}
                                  >
                                    {renderBrainTypeIcon(getBrainEntryType(entry), 11)}
                                    {getBrainTypeLabel(getBrainEntryType(entry))}
                                  </button>
                                  <span className={`brain-importance-badge importance-${getBrainEntryImportance(entry)}`}>
                                    <Star size={10} />
                                    {getBrainEntryImportance(entry)}
                                  </span>
                                  {entry.aiSummary === "Analyzing..." && (
                                    <span className="brain-pending-badge">
                                      <Loader2 size={11} className="spin" />
                                      Analyzing
                                    </span>
                                  )}
                                </div>
                                <button
                                  className="brain-entity-name"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBrainEntityName(getBrainEntryEntityName(entry))
                                  }}
                                >
                                  {getBrainEntryEntityName(entry)}
                                </button>
                                <span className="brain-highlight-text">&ldquo;{entry.highlightedText}&rdquo;</span>
                                {(entry.connections || []).length > 0 && (
                                  <span className="brain-connection-count">
                                    <Link2 size={10} />
                                    {entry.connections?.length} link{entry.connections?.length === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                              <button 
                                className="btn-delete-chapter brain-card-delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteBrainEntry(entry.id)
                                }}
                                onKeyDown={(e) => e.stopPropagation()}
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="brain-entry-summary">
                              {entry.aiSummary === "Analyzing..." ? (
                                <span className="brain-loading"><Loader2 size={12} className="spin" /> Analyzing...</span>
                              ) : (
                                <p>{entry.aiSummary}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* TAB: WRITING GOALS & ANALYTICS */}
            {activeSidebarTab === 'analytics' && (
              <div className="sidebar-tab-content analytics-panel fade-in">
                <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Analytics</span>
                
                {/* Streak counters */}
                <div className="analytics-streak-cards">
                  <div className="streak-card current">
                    <span className="streak-badge">🔥</span>
                    <div>
                      <strong>{streaks.currentStreak} Days</strong>
                      <span>Current Streak</span>
                    </div>
                  </div>
                  <div className="streak-card longest">
                    <span className="streak-badge">🏆</span>
                    <div>
                      <strong>{streaks.longestStreak} Days</strong>
                      <span>Longest Streak</span>
                    </div>
                  </div>
                </div>

                {/* Daily Writing Goal Card */}
                <div className="analytics-goal-card glass-light">
                  <div className="goal-card-header">
                    <h4>Daily Writing Goal</h4>
                    <div className="goal-input-wrapper">
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={dailyWritingGoal}
                        onChange={(e) => handleDailyGoalChange(Math.max(100, Number(e.target.value)))}
                      />
                      <span>words</span>
                    </div>
                  </div>
                  {(() => {
                    const todayStr = new Date().toLocaleDateString('en-CA')
                    const writtenToday = dailyWordLog[todayStr] || 0
                    const percent = Math.min(100, Math.round((writtenToday / dailyWritingGoal) * 100))
                    return (
                      <div className="goal-progress-section">
                        <div className="goal-progress-bar">
                          <div className="goal-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="goal-progress-labels">
                          <span>{writtenToday.toLocaleString()} / {dailyWritingGoal.toLocaleString()} words</span>
                          <strong>{percent}%</strong>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Heatmap Grid */}
                <div className="analytics-section">
                  <h5>Activity Map</h5>
                  <div className="contribution-grid-container scrollbar">
                    <div className="contribution-grid">
                      {Array.from({ length: 16 }).map((_, colIdx) => (
                        <div key={colIdx} className="contribution-column">
                          {contributionGridDays.slice(colIdx * 7, (colIdx + 1) * 7).map(day => {
                            let level = 0
                            if (day.count > 0 && day.count < 100) level = 1
                            else if (day.count >= 100 && day.count < 500) level = 2
                            else if (day.count >= 500 && day.count < 1000) level = 3
                            else if (day.count >= 1000) level = 4

                            return (
                              <div
                                key={day.dateStr}
                                className={`contribution-square level-${level}`}
                                title={`${day.count.toLocaleString()} words on ${day.date.toLocaleDateString()}`}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="contribution-legend">
                    <span>Less</span>
                    <div className="legend-squares">
                      <div className="contribution-square level-0" />
                      <div className="contribution-square level-1" />
                      <div className="contribution-square level-2" />
                      <div className="contribution-square level-3" />
                      <div className="contribution-square level-4" />
                    </div>
                    <span>More</span>
                  </div>
                </div>

                {/* Focus Sprint records */}
                <div className="analytics-section">
                  <h5>Recent Sprints</h5>
                  {sprintHistory.length === 0 ? (
                    <div className="sprint-history-empty">
                      <p>No focus sprints logged yet.</p>
                      <small>Start a sprint in Focus Mode (timer button in top right) to log focused sessions.</small>
                    </div>
                  ) : (
                    <div className="sprint-history-list">
                      {sprintHistory.map(sprint => (
                        <div key={sprint.id} className="sprint-history-item">
                          <div>
                            <strong>{sprint.wordsWritten.toLocaleString()} words</strong>
                            <span>{Math.round(sprint.duration / 60)} min sprint</span>
                          </div>
                          <small>{new Date(sprint.completedAt).toLocaleDateString()} {new Date(sprint.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestones Checklist */}
                <div className="analytics-section">
                  <h5>Writing Milestones</h5>
                  <div className="milestones-analytics-list">
                    {MILESTONES.map(m => {
                      const isUnlocked = unlockedMilestones.has(m.id)
                      return (
                        <div key={m.id} className={`milestone-analytics-item ${isUnlocked ? 'unlocked' : ''}`}>
                          <span className="milestone-item-badge">{m.badge}</span>
                          <div className="milestone-item-details">
                            <strong>{m.title}</strong>
                            <p>{m.description}</p>
                          </div>
                          {isUnlocked ? (
                            <span className="milestone-status unlocked">Unlocked</span>
                          ) : (
                            <span className="milestone-status locked">Locked</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            <div
              className="sidebar-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuemin={MIN_LEFT_SIDEBAR_WIDTH}
              aria-valuemax={MAX_LEFT_SIDEBAR_WIDTH}
              aria-valuenow={leftSidebarWidth}
              tabIndex={0}
              onPointerDown={startLeftSidebarResize}
              onKeyDown={handleSidebarResizeKeyDown}
            />
          </aside>
        )}

        {/* Central Writing Workspace */}
        <main className="editor-main">
          {activeNote ? (
            <div className="editor-workspace fade-in">
              
              {/* Markdown Formatting Toolbar: Hide in Zen Mode */}
              {viewMode === 'edit' && !isZenMode && (
                <div className="editor-controls-row">
                  <div className="formatting-toolbar glass-light">
                    <button className="fmt-btn" onClick={() => applyFormatting("**", "**")} title="Bold (Ctrl+B)">
                      <Bold size={15} />
                    </button>
                    <button className="fmt-btn" onClick={() => applyFormatting("*", "*")} title="Italic (Ctrl+I)">
                      <Italic size={15} />
                    </button>
                    <button className="fmt-btn" onClick={() => applyFormatting("~~", "~~")} title="Strikethrough">
                      <Strikethrough size={15} />
                    </button>
                    <div className="fmt-divider"></div>
                    <button className="fmt-btn" onClick={() => applyFormatting("# ")} title="Heading 1">
                      <Heading1 size={15} />
                    </button>
                    <button className="fmt-btn" onClick={() => applyFormatting("## ")} title="Heading 2">
                      <Heading2 size={15} />
                    </button>
                    <div className="fmt-divider"></div>
                    <button className="fmt-btn" onClick={() => applyFormatting("> ")} title="Blockquote">
                      <Quote size={15} />
                    </button>
                    <button className="fmt-btn" onClick={() => applyFormatting("```\n", "\n```")} title="Code Block">
                      <Code size={15} />
                    </button>
                    <button className="fmt-btn" onClick={() => applyFormatting("- ")} title="Bullet List">
                      <List size={15} />
                    </button>
                    <div className="fmt-divider"></div>
                    <button className="fmt-btn font-mono" onClick={() => setShowSlashMenu(true)} title="Slash Commands">
                      <span>/</span>
                    </button>
                    <div className="fmt-divider"></div>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("character")} 
                      title="Select text, then click to save as a person"
                      disabled={!aiSelectionText.trim()}
                    >
                      <User size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Person</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("beast")} 
                      title="Select text, then click to save as a beast"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <PawPrint size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Beast</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("place")} 
                      title="Select text, then click to save as a place"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <MapPin size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Place</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("world")} 
                      title="Select text, then click to save as world lore"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <Globe size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>World</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("item")} 
                      title="Select text, then click to save as an item"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <Package size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Item</span>
                    </button>
                    <div className="fmt-divider"></div>
                    <button 
                      className={`fmt-btn-action fmt-btn-brain ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={handleAddToBrain} 
                      title="Select text, then click to save to Brain Map with AI analysis"
                      disabled={!aiSelectionText.trim()}
                    >
                      <BrainCircuit size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Brain</span>
                    </button>
                    <button
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => {
                        setActiveSidebarTab('appearance')
                        setIsLeftSidebarOpen(true)
                        handleGenerateAppearancePrompts(null, aiSelectionText)
                      }}
                      title="Highlight a Story Bible name, then generate an appearance prompt from lore and chapter context"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim() || appearanceLoading}
                    >
                      <Eye size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Appearance</span>
                    </button>
                    <button
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleProgressionUpdate(null, aiSelectionText)}
                      title="Highlight a Story Bible character name, then update their level, stats, and skills from this chapter"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim() || progressionLoading}
                    >
                      <TrendingUp size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Progress</span>
                    </button>
                  </div>


                </div>
              )}

              <div className="editor-title-row">
                <input 
                  className="editor-title-input"
                  value={activeNote.title}
                  onChange={(e) => updateActiveNote({ title: e.target.value })}
                  placeholder="Chapter Title..."
                  disabled={isZenMode}
                />
              </div>
              
              <div className="editor-content-area">
                {viewMode === 'edit' ? (
                  <div className={`textarea-wrapper ${isTypewriterMode ? 'typewriter' : ''}`}>
                    <textarea 
                      ref={textareaRef}
                      className="editor-textarea"
                      value={activeNote.content}
                      onChange={(e) => {
                        updateActiveNote({ content: e.target.value })
                        if (isTypewriterMode) centerActiveLine()
                      }}
                      onKeyUp={() => isTypewriterMode && centerActiveLine()}
                      onMouseUp={() => isTypewriterMode && centerActiveLine()}
                      onFocus={() => isTypewriterMode && centerActiveLine()}
                      onKeyDown={handleEditorKeyDown}
                      onInput={handleEditorInput}
                      onSelect={(e) => {
                        const target = e.currentTarget
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        if (start !== end) {
                          setAiSelectionText(target.value.substring(start, end))
                          setAiSelectionStart(start)
                          setAiSelectionEnd(end)
                        } else {
                          setAiSelectionText("")
                          setAiSelectionStart(0)
                          setAiSelectionEnd(0)
                        }
                      }}
                      placeholder="Begin writing (type '/' to insert elements)..."
                      spellCheck={false}
                      style={{ fontFamily, fontSize: `${fontSize}px` }}
                    />
                    
                    {/* Autocomplete suggestions dropdown */}
                    {showAutocomplete && autocompleteSuggestions.length > 0 && (
                      <div className="autocomplete-panel glass" onClick={e => e.stopPropagation()}>
                        <div className="autocomplete-header">
                          <Sparkles size={12} className="glow-icon" />
                          <span>Suggestions</span>
                          <button 
                            className="autocomplete-close-btn" 
                            onClick={(e) => { e.stopPropagation(); setShowAutocomplete(false); setAutocompleteSuggestions([]); }}
                            title="Dismiss suggestions"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="autocomplete-list">
                          {autocompleteSuggestions.slice(0, 5).map((suggestion, idx) => (
                            <div 
                              key={suggestion} 
                              className={`autocomplete-item ${idx === autocompleteIndex ? 'selected' : ''}`}
                              onClick={() => handleAutocompleteSelect(suggestion)}
                            >
                              <span className="suggestion-text">{suggestion}</span>
                              {idx === autocompleteIndex && <span className="tab-hint">Enter/Tab</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="markdown-preview" style={{ fontFamily, fontSize: `${fontSize}px` }}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p>{React.Children.map(children, child => injectLoreChips(child))}</p>,
                        li: ({ children }) => <li>{React.Children.map(children, child => injectLoreChips(child))}</li>,
                        h1: ({ children }) => <h1>{React.Children.map(children, child => injectLoreChips(child))}</h1>,
                        h2: ({ children }) => <h2>{React.Children.map(children, child => injectLoreChips(child))}</h2>,
                        h3: ({ children }) => <h3>{React.Children.map(children, child => injectLoreChips(child))}</h3>,
                        h4: ({ children }) => <h4>{React.Children.map(children, child => injectLoreChips(child))}</h4>,
                        h5: ({ children }) => <h5>{React.Children.map(children, child => injectLoreChips(child))}</h5>,
                        h6: ({ children }) => <h6>{React.Children.map(children, child => injectLoreChips(child))}</h6>,
                        blockquote: ({ children }) => <blockquote>{React.Children.map(children, child => injectLoreChips(child))}</blockquote>,
                      }}
                    >
                      {activeNote.content || "_Start writing to see preview..."}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              {/* Status Bar: Hide in Zen Mode */}
              {!isZenMode && (
                <div className="editor-status-bar">
                  <div className="status-left">
                    <span className="word-count">
                      <FileText size={14} />
                      {wordCount}/{wordGoal} words
                    </span>
                    <div className="word-progress">
                      <div className="word-progress-bar">
                        <div 
                          className="word-progress-fill" 
                          style={{ width: `${progressPercent}%`, backgroundColor: progressPercent >= 100 ? 'var(--success)' : 'var(--primary)' }}
                        ></div>
                      </div>
                      <span className="word-progress-text">{progressPercent}%</span>
                    </div>
                  </div>

                  <div className="status-right">
                    <button className="status-goal-btn" onClick={changeWordGoal} title="Change Word Goal">
                      🎯 Goal: {wordGoal} words
                    </button>
                    <div className="status-timer-container">
                      <span className="timer-display">⏱️ {formatSessionTime(sessionTime)}</span>
                      <div className="timer-controls">
                        <button 
                          className="timer-btn" 
                          onClick={() => setIsTimerRunning(!isTimerRunning)} 
                          title={isTimerRunning ? "Pause Timer" : "Start Timer"}
                        >
                          {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button 
                          className="timer-btn" 
                          onClick={() => setSessionTime(0)} 
                          title="Reset Timer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-editor-state">
              <div className="empty-icon">
                <Feather size={48} />
              </div>
              <p>Select or create a chapter to start writing</p>
            </div>
          )}
        </main>

        {/* Right Collapsible AI Assistant Sidebar */}
        {showAISidebar && !isFocusMode && !isZenMode && (
          <aside className="editor-ai-sidebar">
            <div className="ai-sidebar-header">
              <div className="ai-header-title">
                <Sparkles size={16} className="sparkles-icon" />
                <span>AI Assistant</span>
              </div>
              <button className="btn-close-ai" onClick={() => setShowAISidebar(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="ai-tabs">
              <button 
                className={`ai-tab-btn ${aiTab === 'continue' ? 'active' : ''}`}
                onClick={() => { setAiTab('continue'); setAiResponse(""); setAiError(""); }}
              >
                Continue
              </button>
              <button 
                className={`ai-tab-btn ${aiTab === 'rewrite' ? 'active' : ''}`}
                onClick={() => { setAiTab('rewrite'); setAiResponse(""); setAiError(""); }}
              >
                Rewrite
              </button>
              <button 
                className={`ai-tab-btn ${aiTab === 'outline' ? 'active' : ''}`}
                onClick={() => { setAiTab('outline'); setAiResponse(""); setAiError(""); }}
              >
                Outline
              </button>
            </div>

            <div className="ai-sidebar-content">
              {aiTab === 'continue' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Generate a seamless continuation of your story matching your tone and voice.
                  </p>
                  <button 
                    className="btn-ai-action" 
                    onClick={handleContinueWriting}
                    disabled={aiLoading || !activeNote}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Continue Writing
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiTab === 'rewrite' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Highlight a passage in the editor, select a tone/style, and rewrite.
                  </p>
                  
                  {aiSelectionText ? (
                    <div className="ai-selection-preview">
                      <span className="preview-label">Selected Text:</span>
                      <div className="selection-quote-box">
                        &ldquo;{aiSelectionText.length > 150 ? aiSelectionText.substring(0, 150) + '...' : aiSelectionText}&rdquo;
                      </div>
                    </div>
                  ) : (
                    <div className="ai-no-selection">
                      <AlertCircle size={16} />
                      <span>No text selected. Highlight a passage in the editor to use this tool.</span>
                    </div>
                  )}

                  <div className="ai-form-field">
                    <label>Prose Style / Tone</label>
                    <select 
                      value={aiTone} 
                      onChange={(e) => setAiTone(e.target.value)}
                      className="ai-select"
                      disabled={!aiSelectionText}
                    >
                      <option value="descriptive">✨ Descriptive (Show, Don&apos;t Tell)</option>
                      <option value="dramatic">🎭 Dramatic (Emotional Stakes)</option>
                      <option value="suspenseful">⏳ Suspenseful (Build Tension)</option>
                      <option value="poetic">🌿 Poetic (Lyrical Flow)</option>
                      <option value="professional">💼 Professional (Elegant & Clear)</option>
                      <option value="shorten">✂️ Shorten (Punchy & Concise)</option>
                      <option value="expand">🔍 Expand (Elaborate Details)</option>
                    </select>
                  </div>

                  <button 
                    className="btn-ai-action" 
                    onClick={handleRewrite}
                    disabled={aiLoading || !aiSelectionText}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Rewriting...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Rewrite Selection
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiTab === 'outline' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Brainstorm a structured outline for your next scene or chapter.
                  </p>
                  
                  <div className="ai-form-field">
                    <label>Concept or story beat</label>
                    <textarea
                      value={aiOutlinePrompt}
                      onChange={(e) => setAiOutlinePrompt(e.target.value)}
                      placeholder="Describe the scene... e.g. Clara confronts Arthur in the rain about the missing necklace."
                      className="ai-textarea"
                      disabled={aiLoading}
                    />
                  </div>

                  <button 
                    className="btn-ai-action" 
                    onClick={handleGenerateOutline}
                    disabled={aiLoading || !aiOutlinePrompt.trim()}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Planning...
                      </>
                    ) : (
                      <>
                        <BookOpen size={16} />
                        Generate Outline
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiError && (
                <div className="ai-error-box fade-in">
                  <AlertCircle size={16} />
                  <span>{aiError}</span>
                </div>
              )}

              {aiResponse && (
                <div className="ai-response-box fade-in">
                  <div className="response-header">
                    <span>AI Suggestion:</span>
                    {aiCopied && <span className="copied-label">Copied!</span>}
                  </div>
                  <div className="response-content">
                    {aiTab === 'outline' ? (
                      <div className="markdown-preview-ai">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiResponse}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{aiResponse}</p>
                    )}
                  </div>
                  <div className="response-actions">
                    {aiTab === 'continue' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => insertAtCursor(aiResponse)}>
                        Insert
                      </button>
                    )}
                    {aiTab === 'rewrite' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => replaceSelection(aiResponse)}>
                        Replace
                      </button>
                    )}
                    {aiTab === 'outline' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => createNewNoteWithContent("AI Outline", aiResponse)}>
                        Insert Chapter
                      </button>
                    )}
                    <button className="btn-ai-sub btn-ai-secondary" onClick={() => handleCopyToClipboard(aiResponse)}>
                      <Copy size={12} />
                      Copy
                    </button>
                    <button 
                      className="btn-ai-sub btn-ai-secondary" 
                      onClick={
                        aiTab === 'continue' 
                          ? handleContinueWriting 
                          : aiTab === 'rewrite' 
                            ? handleRewrite 
                            : handleGenerateOutline
                      }
                    >
                      Regen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Character & World Bible Slide-out Drawer Panel */}
        {isBibleDrawerOpen && activeBibleEntry && (
          <aside className="editor-ai-sidebar bible-drawer fade-in">
            <div className="ai-sidebar-header">
              <div className="ai-header-title">
                <BookOpen size={16} className="glow-icon text-primary" />
                <span>Edit Lore Entry</span>
              </div>
              <button className="btn-close-ai" onClick={() => setIsBibleDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="ai-sidebar-content">
              <div className="ai-form-field">
                <label>Entry Name</label>
                <input 
                  type="text" 
                  value={activeBibleEntry.name}
                  onChange={(e) => updateActiveBibleEntry({ name: e.target.value })}
                  placeholder="e.g. Clara, Excalibur, London"
                  className="ai-select px-3"
                />
              </div>

              <div className="ai-form-field">
                <label>Category</label>
                <select 
                  value={activeBibleEntry.category}
                  onChange={(e) => updateActiveBibleEntry({ category: e.target.value as 'character' | 'world' | 'beast' | 'place' | 'item' })}
                  className="ai-select"
                >
                  <option value="character">👤 Person (Cast, Protagonist, NPC)</option>
                  <option value="beast">🐾 Beast (Creature, Monster, Companion)</option>
                  <option value="place">📍 Place (Location, Region, Sect, Building)</option>
                  <option value="world">🗺️ World (Magic, Lore, Concept)</option>
                  <option value="item">📦 Item (Weapon, Artifact, Object)</option>
                </select>
              </div>

              <div className="ai-form-field">
                <label>Story Groups</label>
                <div className="bible-group-editor">
                  {bibleGroups.length === 0 && (
                    <span className="empty-state-text compact">No custom groups yet.</span>
                  )}
                  {bibleGroups.map(group => {
                    const checked = (activeBibleEntry.groupIds || []).includes(group.id)
                    return (
                      <label key={group.id} className="bible-group-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = activeBibleEntry.groupIds || []
                            updateActiveBibleEntry({
                              groupIds: e.target.checked
                                ? Array.from(new Set([...current, group.id]))
                                : current.filter(id => id !== group.id)
                            })
                          }}
                        />
                        <span>{group.name}</span>
                      </label>
                    )
                  })}
                  <button className="btn-ai-sub btn-ai-secondary" onClick={createBibleGroup}>
                    <Plus size={12} />
                    New Group
                  </button>
                </div>
              </div>

              <div className="ai-form-field flex-1 flex flex-col min-h-[300px]">
                <label>Notes & Descriptions</label>
                <textarea 
                  value={activeBibleEntry.content}
                  onChange={(e) => updateActiveBibleEntry({ content: e.target.value })}
                  placeholder="Write biography, characteristics, locations details, and lore notes..."
                  className="ai-textarea flex-1 min-h-[280px]"
                />
              </div>

              <div className="drawer-save-badge flex items-center justify-end text-xs text-dim gap-1">
                <Check size={12} className="text-success" />
                <span>Auto-saved in real-time</span>
              </div>
            </div>
          </aside>
        )}

        {selectedBrainEntry && (
          <div className="modal-overlay" onClick={() => setSelectedBrainEntryId(null)}>
            <div className="modal brain-detail-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header brain-detail-header">
                <div>
                  <h2 className="modal-title">Brain Map Entry</h2>
                  <p className="modal-description">
                    {getBrainEntryChapterLabel(selectedBrainEntry)} - {getBrainEntryChapterTitle(selectedBrainEntry)}
                  </p>
                </div>
                <button 
                  className="btn-close-ai" 
                  onClick={() => setSelectedBrainEntryId(null)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="brain-detail-meta">
                <span className="brain-chapter-badge">{getBrainEntryChapterLabel(selectedBrainEntry)}</span>
                <span className={`brain-type-badge type-${getBrainEntryType(selectedBrainEntry)}`}>
                  {renderBrainTypeIcon(getBrainEntryType(selectedBrainEntry), 11)}
                  {getBrainTypeLabel(getBrainEntryType(selectedBrainEntry))}
                </span>
                <span className={`brain-importance-badge importance-${getBrainEntryImportance(selectedBrainEntry)}`}>
                  <Star size={10} />
                  {getBrainEntryImportance(selectedBrainEntry)}
                </span>
                {formatBrainEntryDate(selectedBrainEntry) && (
                  <span className="brain-detail-date">{formatBrainEntryDate(selectedBrainEntry)}</span>
                )}
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">Entity</span>
                <button
                  className="brain-detail-entity-link"
                  onClick={() => {
                    setSelectedBrainEntryId(null)
                    setSelectedBrainEntityName(getBrainEntryEntityName(selectedBrainEntry))
                  }}
                >
                  {renderBrainTypeIcon(getBrainEntryType(selectedBrainEntry), 14)}
                  {getBrainEntryEntityName(selectedBrainEntry)}
                </button>
              </div>

              <div className="brain-detail-controls">
                <label>
                  <span className="brain-detail-label">Type</span>
                  <select
                    value={getBrainEntryType(selectedBrainEntry)}
                    onChange={(e) => updateBrainEntry(selectedBrainEntry.id, { entityType: e.target.value as BrainEntityType })}
                    className="brain-detail-select"
                  >
                    {brainTypeOptions.filter(option => option.value !== 'all').map(option => (
                      <option key={option.value} value={option.value}>{option.label.replace(/s$/, '')}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="brain-detail-label">Importance</span>
                  <select
                    value={getBrainEntryImportance(selectedBrainEntry)}
                    onChange={(e) => updateBrainEntry(selectedBrainEntry.id, { importance: e.target.value as BrainImportance })}
                    className="brain-detail-select"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">Keyword / Highlight</span>
                <div className="brain-detail-keyword">
                  &ldquo;{selectedBrainEntry.highlightedText}&rdquo;
                </div>
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">AI Analysis</span>
                <div className="brain-detail-summary">
                  {selectedBrainEntry.aiSummary === "Analyzing..." ? (
                    <span className="brain-loading">
                      <Loader2 size={14} className="spin" />
                      Analyzing...
                    </span>
                  ) : (
                    <p>{selectedBrainEntry.aiSummary}</p>
                  )}
                </div>
              </div>

              {(selectedBrainEntry.connections || []).length > 0 && (
                <div className="brain-detail-section">
                  <span className="brain-detail-label">Connections</span>
                  <div className="brain-connection-list">
                    {selectedBrainEntry.connections?.map(connection => (
                      <div key={connection} className="brain-connection-item">
                        <Link2 size={12} />
                        <span>{connection}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="brain-detail-actions">
                <button
                  className="btn-ai-sub btn-ai-secondary danger-text"
                  onClick={() => {
                    const confirmed = window.confirm("Delete this Brain Map entry? This cannot be undone.")
                    if (confirmed) deleteBrainEntry(selectedBrainEntry.id)
                  }}
                >
                  <Trash2 size={13} />
                  Delete Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedBrainEntity && (
          <div className="modal-overlay" onClick={() => setSelectedBrainEntityName(null)}>
            <div className="modal brain-detail-modal brain-entity-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header brain-detail-header">
                <div>
                  <h2 className="modal-title">{selectedBrainEntity.name}</h2>
                  <p className="modal-description">
                    {getBrainTypeLabel(selectedBrainEntity.type)} dossier - {selectedBrainEntity.entries.length} entr{selectedBrainEntity.entries.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <button
                  className="btn-close-ai"
                  onClick={() => setSelectedBrainEntityName(null)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="brain-detail-meta">
                <span className={`brain-type-badge type-${selectedBrainEntity.type}`}>
                  {renderBrainTypeIcon(selectedBrainEntity.type, 11)}
                  {getBrainTypeLabel(selectedBrainEntity.type)}
                </span>
                {selectedBrainEntity.criticalCount > 0 && (
                  <span className="brain-importance-badge importance-critical">
                    <Star size={10} />
                    critical
                  </span>
                )}
              </div>

              <div className="brain-entity-entry-list">
                {selectedBrainEntity.entries
                  .slice()
                  .sort((a, b) => (getBrainEntryChapterNumber(a) || 9999) - (getBrainEntryChapterNumber(b) || 9999))
                  .map(entry => (
                    <button
                      key={entry.id}
                      className="brain-entity-entry"
                      onClick={() => {
                        setSelectedBrainEntityName(null)
                        setSelectedBrainEntryId(entry.id)
                      }}
                    >
                      <div className="brain-entity-entry-top">
                        <span className="brain-chapter-badge">{getBrainEntryChapterLabel(entry)}</span>
                        <span className={`brain-importance-badge importance-${getBrainEntryImportance(entry)}`}>
                          <Star size={10} />
                          {getBrainEntryImportance(entry)}
                        </span>
                      </div>
                      <strong>{entry.highlightedText}</strong>
                      <p>{entry.aiSummary}</p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {chapterMoveMenu && (
          <div className="chapter-move-menu-backdrop" onClick={() => setChapterMoveMenu(null)}>
            <div
              className="chapter-move-menu glass"
              style={{
                top: chapterMoveMenu.y,
                left: chapterMoveMenu.x
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="chapter-move-title">Move to volume</span>
              {sortedVolumes.map(volume => (
                <button
                  key={volume.id}
                  onClick={() => moveChapterToVolume(chapterMoveMenu.noteId, volume.id)}
                >
                  {volume.title}
                </button>
              ))}
              <button onClick={() => moveChapterToVolume(chapterMoveMenu.noteId, UNASSIGNED_VOLUME_ID)}>
                Unassigned Chapters
              </button>
            </div>
          </div>
        )}

        {showVolumeCreateModal && (
          <div className="modal-overlay" onClick={() => setShowVolumeCreateModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Volume</h2>
                <p className="modal-description">
                  Open volumes receive new chapters when you use the main New Chapter button.
                </p>
              </div>
              <div className="ai-form-field">
                <label>Volume Name</label>
                <input
                  className="input"
                  value={newVolumeName}
                  onChange={(e) => setNewVolumeName(e.target.value)}
                  placeholder="Volume 1"
                  autoFocus
                />
              </div>
              <label className="volume-open-field">
                <input
                  type="checkbox"
                  checked={newVolumeIsOpen}
                  onChange={(e) => setNewVolumeIsOpen(e.target.checked)}
                />
                <span>Open this volume for new chapters</span>
              </label>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowVolumeCreateModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmCreateNewVolume}>
                  <Plus size={16} />
                  Create Volume
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteModal.show && (
          <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, noteId: '', noteTitle: '' })}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Chapter</h2>
                <p className="modal-description">Are you sure you want to delete &ldquo;{deleteModal.noteTitle || 'Untitled'}&rdquo;? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, noteId: '', noteTitle: '' })}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteNote}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {showMultiDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowMultiDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Multiple Chapters</h2>
                <p className="modal-description">Are you sure you want to delete the {selectedNoteIds.size} selected chapters? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowMultiDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteSelectedNotes}>Delete All</button>
              </div>
            </div>
          </div>
        )}

        {showMultiBibleDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowMultiBibleDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Multiple Story Bible Entries</h2>
                <p className="modal-description">Are you sure you want to delete the {selectedBibleIds.size} selected entries? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowMultiBibleDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteSelectedBibleEntries}>Delete All</button>
              </div>
            </div>
          </div>
        )}

        {isProgressionEditMode && progressionEditProfileDraft && (
          <div className="modal-overlay" onClick={closeProgressionEditModal}>
            <div className="modal progression-edit-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Edit Progression Profile</h2>
                <p className="modal-description">Change anything here. New fields are learned by this novel and can appear on other character profiles too.</p>
              </div>

              <div className="progression-edit-modal-body">
                <div className="progression-card-editor-section">
                  <div className="progression-editor-section-title">
                    <strong>Profile Cards</strong>
                    <span>Only active profile details are shown. Add anything else as a custom card.</span>
                  </div>
                  <div className="progression-edit-card-grid">
                    <div className="progression-profile-edit-card">
                      <span>Name</span>
                      <input className="ai-input" value={progressionEditProfileDraft.name} onChange={(e) => setProgressionDraftField("name", e.target.value)} />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Title</span>
                      <input className="ai-input" value={progressionEditProfileDraft.title || ""} onChange={(e) => setProgressionDraftField("title", e.target.value)} placeholder="Dao Lord, Saintess, Tyrant..." />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Cultivation Stage</span>
                      <input className="ai-input" list="progression-realms" value={progressionEditProfileDraft.realm || ""} onChange={(e) => setProgressionDraftField("realm", e.target.value)} placeholder="Immortal, Demigod, God..." />
                      <input className="ai-input" list="progression-stages" value={progressionEditProfileDraft.stage || ""} onChange={(e) => setProgressionDraftField("stage", e.target.value)} placeholder="Low / Medium / High / Peak" />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Bloodline</span>
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {}).Bloodline || ""} onChange={(e) => setProgressionDraftCustomField("Bloodline", e.target.value)} placeholder="Ancient Phoenix Bloodline" />
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {})["Bloodline Rank"] || ""} onChange={(e) => setProgressionDraftCustomField("Bloodline Rank", e.target.value)} placeholder="Supreme / Celestial" />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Class</span>
                      <input className="ai-input" value={progressionEditProfileDraft.className || ""} onChange={(e) => setProgressionDraftField("className", e.target.value)} placeholder="Sword Saint, Alchemist..." />
                    </div>
                    {(progressionEditProfileDraft.customFields || {}).Affiliation && (
                      <div className="progression-profile-edit-card">
                        <button className="btn-icon-mini danger" onClick={() => removeProgressionDraftCustomField("Affiliation")} title="Remove card"><Trash2 size={12} /></button>
                        <span>Affiliation</span>
                        <input className="ai-input" value={(progressionEditProfileDraft.customFields || {}).Affiliation || ""} onChange={(e) => setProgressionDraftCustomField("Affiliation", e.target.value)} />
                      </div>
                    )}
                    {(progressionEditProfileDraft.nicknames || []).length > 0 && (
                      <div className="progression-profile-edit-card">
                        <button className="btn-icon-mini danger" onClick={() => setProgressionDraftField("nicknames", [])} title="Remove card"><Trash2 size={12} /></button>
                        <span>Nicknames</span>
                        <input className="ai-input" value={(progressionEditProfileDraft.nicknames || []).join(", ")} onChange={(e) => setProgressionDraftField("nicknames", e.target.value.split(",").map(item => item.trim()).filter(Boolean))} />
                      </div>
                    )}
                    {(progressionEditProfileDraft.customFields || {}).Race && (
                      <div className="progression-profile-edit-card">
                        <button className="btn-icon-mini danger" onClick={() => removeProgressionDraftCustomField("Race")} title="Remove card"><Trash2 size={12} /></button>
                        <span>Race</span>
                        <input className="ai-input" value={(progressionEditProfileDraft.customFields || {}).Race || ""} onChange={(e) => setProgressionDraftCustomField("Race", e.target.value)} />
                      </div>
                    )}
                    {progressionEditProfileDraft.cultivationPath && (
                      <div className="progression-profile-edit-card">
                        <button className="btn-icon-mini danger" onClick={() => setProgressionDraftField("cultivationPath", "")} title="Remove card"><Trash2 size={12} /></button>
                        <span>Path</span>
                        <input className="ai-input" value={progressionEditProfileDraft.cultivationPath || ""} onChange={(e) => setProgressionDraftField("cultivationPath", e.target.value)} />
                      </div>
                    )}
                    {progressionEditProfileDraft.uniqueTrait && (
                      <div className="progression-profile-edit-card wide">
                        <button className="btn-icon-mini danger" onClick={() => setProgressionDraftField("uniqueTrait", "")} title="Remove card"><Trash2 size={12} /></button>
                        <span>Unique Trait</span>
                        <textarea
                          className="ai-textarea compact"
                          value={progressionEditProfileDraft.uniqueTrait || ""}
                          onChange={(e) => setProgressionDraftField("uniqueTrait", e.target.value)}
                          placeholder="Summoned beasts, rare physique, contracted legion, forbidden art..."
                        />
                      </div>
                    )}
                    {progressionSystem.showExp && (progressionEditProfileDraft.exp > 0 || progressionEditProfileDraft.nextLevelExp > 0) && (
                      <div className="progression-profile-edit-card">
                        <button className="btn-icon-mini danger" onClick={() => { setProgressionDraftField("exp", 0); setProgressionDraftField("nextLevelExp", 0) }} title="Remove card"><Trash2 size={12} /></button>
                        <span>EXP</span>
                        <input className="ai-input" type="number" value={progressionEditProfileDraft.exp} onChange={(e) => setProgressionDraftField("exp", Number(e.target.value))} />
                        <input className="ai-input" type="number" value={progressionEditProfileDraft.nextLevelExp} onChange={(e) => setProgressionDraftField("nextLevelExp", Number(e.target.value))} placeholder="Next EXP" />
                      </div>
                    )}
                    {Array.from(new Set([...progressionSystem.customFields, ...Object.keys(progressionEditProfileDraft.customFields || {})]))
                      .filter(fieldName => !["Affiliation", "Bloodline", "Bloodline Rank", "Bloodline Grade", "Race"].includes(fieldName) && (progressionEditProfileDraft.customFields || {})[fieldName])
                      .map(fieldName => (
                        <div className="progression-profile-edit-card" key={fieldName}>
                          <button className="btn-icon-mini danger" onClick={() => removeProgressionDraftCustomField(fieldName)} title="Remove card"><Trash2 size={12} /></button>
                          <span>{fieldName}</span>
                          <input
                            className="ai-input"
                            value={(progressionEditProfileDraft.customFields || {})[fieldName] || ""}
                            onChange={(e) => setProgressionDraftCustomField(fieldName, e.target.value)}
                          />
                        </div>
                      ))}
                  </div>
                  <div className="progression-add-field-row">
                    <input className="ai-input" value={progressionNewFieldName} onChange={(e) => setProgressionNewFieldName(e.target.value)} placeholder="Card name, e.g. EXP, Sect, Weapon" />
                    <select className="ai-select" value={progressionNewFieldType} onChange={(e) => setProgressionNewFieldType(e.target.value as ProgressionTemplateCardType)}>
                      <option value="text">Text</option>
                      <option value="rank">Realm / Rank</option>
                      <option value="compound">Multi-field Card</option>
                      <option value="progress">EXP / Progress</option>
                      <option value="resource">HP / Mana / Qi</option>
                      <option value="counter">Counter</option>
                      <option value="stat">Stat</option>
                      <option value="ability">Ability</option>
                    </select>
                    <input
                      className="ai-input"
                      value={progressionNewFieldValue}
                      onChange={(e) => setProgressionNewFieldValue(e.target.value)}
                      placeholder={progressionNewFieldType === "progress" || progressionNewFieldType === "resource" ? "100/1000" : progressionNewFieldType === "counter" ? "0" : "Value"}
                    />
                    <button className="btn-ai-sub btn-ai-primary" onClick={addProgressionDraftCustomField}>
                      <Plus size={12} />
                      Add Card
                    </button>
                  </div>
                </div>

                <div className="progression-card-editor-section">
                  <div className="progression-editor-section-title">
                    <strong>Template Values</strong>
                    <span>Assign values for the cards in this novel&apos;s profile template. EXP and resource cards accept values like 100/1000.</span>
                  </div>
                  <div className="progression-template-value-grid">
                    {normalizeProgressionTemplateCards(progressionSystem.profileTemplate.cards, progressionSystem.customFields)
                      .filter(templateCard => templateCard.enabled && templateCard.type !== "ability")
                      .map(templateCard => {
                        const fields = templateCard.fields.length > 0 ? templateCard.fields : [templateCard.label]
                        return (
                          <div className={`progression-profile-edit-card wide color-${templateCard.color}`} key={templateCard.id}>
                            <button className="btn-icon-mini danger" onClick={() => removeProgressionTemplateCard(templateCard.id)} title="Remove card from template"><Trash2 size={12} /></button>
                            <span>{templateCard.label}</span>
                            <div className="progression-template-value-fields">
                              {fields.map(fieldName => (
                                <label key={fieldName}>
                                  <small>{fieldName}</small>
                                  <input
                                    className="ai-input"
                                    type={templateCard.type === "counter" ? "number" : "text"}
                                    value={getProgressionTemplateFieldValue(progressionEditProfileDraft, templateCard, fieldName) || ""}
                                    onChange={(e) => setProgressionDraftTemplateField(templateCard, fieldName, e.target.value)}
                                    placeholder={templateCard.type === "progress" || templateCard.type === "resource" ? "100/1000" : templateCard.type === "counter" ? "0" : "Saint, Sage, 100+"}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                <div className="progression-card-editor-section">
                  <div className="progression-editor-section-title">
                    <strong>Ability Cards</strong>
                    <span>Add techniques, powers, summons, and skills individually.</span>
                  </div>
                  <div className="progression-ability-card-editor-list">
                    {progressionEditProfileDraft.abilities.map(ability => (
                      <div className="progression-ability-edit-card" key={ability.id}>
                        <button className="btn-icon-mini danger" onClick={() => removeProgressionDraftAbility(ability.id)} title="Remove ability"><Trash2 size={12} /></button>
                        <input className="ai-input" value={ability.name} onChange={(e) => setProgressionDraftAbility(ability.id, { name: e.target.value })} placeholder="Ability name" />
                        <input className="ai-input" value={ability.rank || `Level ${ability.level}`} onChange={(e) => setProgressionDraftAbility(ability.id, { rank: e.target.value, level: Number(e.target.value.replace(/\D/g, "")) || ability.level || 1 })} placeholder="Rank or level" />
                        <textarea className="ai-textarea compact" value={ability.description} onChange={(e) => setProgressionDraftAbility(ability.id, { description: e.target.value })} placeholder="Short description" />
                      </div>
                    ))}
                  </div>
                  <button className="btn-ai-sub btn-ai-secondary progression-auto-btn" onClick={addProgressionDraftAbility}>
                    <Plus size={12} />
                    Add Ability Card
                  </button>
                </div>

                {progressionEditProfileDraft.notes && (
                  <div className="ai-form-field">
                    <label>Lore</label>
                    <textarea className="ai-textarea compact" value={progressionEditProfileDraft.notes} onChange={(e) => setProgressionDraftField("notes", e.target.value)} />
                  </div>
                )}
                {!progressionEditProfileDraft.notes && (
                  <div className="ai-form-field">
                    <label>Lore</label>
                    <textarea className="ai-textarea compact" value={progressionEditProfileDraft.notes || ""} onChange={(e) => setProgressionDraftField("notes", e.target.value)} placeholder="A memorable detail, rumor, reputation, prophecy, weakness, or relationship to reference later." />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={closeProgressionEditModal}>Cancel</button>
                <button className="btn btn-primary" onClick={saveProgressionProfileDraft}>Update Profile</button>
              </div>
            </div>
          </div>
        )}

        {showProgressionCharactersModal && (
          <div className="modal-overlay" onClick={() => setShowProgressionCharactersModal(false)}>
            <div className="modal progression-characters-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Characters</h2>
                <p className="modal-description">Open a progression profile without filling the sidebar with every character.</p>
              </div>
              <div className="progression-character-modal-list">
                {progressionProfiles.length === 0 ? (
                  <div className="empty-state-text">No progression profiles yet.</div>
                ) : progressionProfiles.map(profile => (
                  <button
                    key={profile.id}
                    className={`progression-character-row ${selectedProgressionProfileId === profile.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedProgressionProfileId(profile.id)
                      setProgressionSelectedEntryId(profile.loreEntryId)
                      setShowProgressionCharactersModal(false)
                    }}
                  >
                    <div>
                      <strong>{profile.name}</strong>
                      <span>{profile.title || profile.className || profile.cultivationPath || "No title yet"}</span>
                    </div>
                    <em>{formatProgressionStage(profile)}</em>
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowProgressionCharactersModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showProgressionTemplateModal && (
          <div className="modal-overlay" onClick={() => setShowProgressionTemplateModal(false)}>
            <div className="modal progression-template-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Profile Template</h2>
                <p className="modal-description">Design the reusable status card for this novel. New and updated characters follow this shape.</p>
              </div>
              <div className="progression-template-modal-body">
                <div className="json-template-mode-toggle" style={{ display: "none" }}>
                  <input
                    type="checkbox"
                    id="useCustomJsonTemplate"
                    checked={progressionSystem.useCustomJsonTemplate || false}
                    onChange={(e) => {
                      persistProgressionSystem({
                        ...progressionSystem,
                        useCustomJsonTemplate: e.target.checked
                      })
                    }}
                  />
                  <label htmlFor="useCustomJsonTemplate" style={{ fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "var(--text-primary)" }}>
                    Enable Custom JSON Template Mode (AI-optimized dynamic status cards)
                  </label>
                </div>

                {progressionSystem.useCustomJsonTemplate ? (
                  <div className="json-template-editor-section">
                    <div className="progression-template-header" style={{ marginBottom: "0.5rem" }}>
                      <div>
                        <strong>Custom JSON Status Template</strong>
                        <span>Define the JSON structure you want the AI to extract and update for characters. Must be valid JSON.</span>
                      </div>
                    </div>
                    <textarea
                      className="ai-textarea progression-json-template-textarea font-mono text-sm scrollbar"
                      value={progressionSystem.customJsonTemplate || ""}
                      onChange={(e) => {
                        const nextVal = e.target.value
                        let parsedKeys: string[] = []
                        try {
                          const parsed = JSON.parse(nextVal)
                          if (parsed && typeof parsed === "object") {
                            parsedKeys = Object.keys(parsed)
                          }
                        } catch {}
                        persistProgressionSystem({
                          ...progressionSystem,
                          customJsonTemplate: nextVal,
                          jsonCardOrder: parsedKeys.length > 0 ? parsedKeys : progressionSystem.jsonCardOrder
                        })
                      }}
                      placeholder={`{\n  "class": "Warrior",\n  "cultivation": {\n    "realm": "Body Tempering"\n  }\n}`}
                      rows={12}
                      style={{ width: "100%", padding: "0.75rem", background: "rgba(0, 0, 0, 0.25)", border: "1px solid var(--surface-border)", borderRadius: "var(--radius-md)", color: "#fff" }}
                    />
                    {(() => {
                      try {
                        if (progressionSystem.customJsonTemplate) {
                          const parsed = JSON.parse(progressionSystem.customJsonTemplate)
                          const keys = Object.keys(parsed)
                          return (
                            <div className="json-validation-success" style={{ color: "#4ade80", fontSize: "0.75rem", marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Check size={12} />
                              Valid JSON! Top-level keys: {keys.join(", ")} (these will render as status cards)
                            </div>
                          )
                        }
                      } catch (err) {
                        return (
                          <div className="json-validation-error" style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "4px" }}>
                            <AlertCircle size={12} />
                            Invalid JSON format: {(err as Error).message}
                          </div>
                        )
                      }
                      return null
                    })()}

                    <div className="progression-theme-library" style={{ marginTop: "1.5rem" }}>
                      <div className="progression-template-header">
                        <div>
                          <strong>Import / Export Template settings</strong>
                          <span>Share your JSON layout settings across different novels.</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn-ai-sub btn-ai-secondary"
                          onClick={copyProgressionTemplateToClipboard}
                        >
                          <Copy size={12} />
                          Copy Template settings
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub btn-ai-secondary"
                          onClick={pasteProgressionTemplateFromClipboard}
                        >
                          <Clipboard size={12} />
                          Paste & Import Template
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="progression-template-tool-row">
                      {normalizeProgressionTemplateCards(progressionSystem.profileTemplate.cards, progressionSystem.customFields)
                        .filter(card => card.enabled)
                        .map(card => (
                          <span key={card.id}>{card.label}</span>
                        ))}
                      <button
                        className="btn-ai-sub btn-ai-secondary"
                        onClick={() => setProgressionTemplateCards(() => DEFAULT_PROFILE_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        type="button"
                      >
                        <RotateCcw size={12} />
                        Load Simple Template
                      </button>
                      <button
                        className="btn-ai-sub btn-ai-secondary danger-text"
                        onClick={() => {
                          const confirmed = window.confirm("Are you sure you want to clear all template cards? This will reset your status screen layout.");
                          if (confirmed) {
                            setProgressionTemplateCards(() => []);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={12} />
                        Clear Template
                      </button>
                      <button
                        className="btn-ai-sub btn-ai-secondary danger-text"
                        onClick={() => {
                          const confirmed = window.confirm("Are you sure you want to delete the entire template? This will completely clear all realms, stats, custom fields, and reset the template to a blank slate.");
                          if (confirmed) {
                            deleteEntireTemplate();
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={12} />
                        Delete Entire Template
                      </button>
                    </div>
                    <div className="progression-theme-library">
                      <div className="progression-template-header">
                        <div>
                          <strong>Novel Status Themes</strong>
                          <span>Instantly load a specialized status card preset for your genre.</span>
                        </div>
                      </div>
                      <div className="progression-theme-grid">
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => LITRPG_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          🛡️ LitRPG / System
                        </button>
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => XIANXIA_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          ☯️ Xianxia / Cultivation
                        </button>
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => SHADOW_SLAVE_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          🖤 Shadow Slave Style
                        </button>
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => TALENT_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          ✨ Supreme Talent
                        </button>
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => SOLO_LEVELING_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          ⚡ Solo Leveling Style
                        </button>
                        <button
                          type="button"
                          className="theme-btn-premium"
                          onClick={() => setProgressionTemplateCards(() => DEFAULT_PROFILE_TEMPLATE_CARDS.map(card => ({ ...card, id: `${card.id}-${crypto.randomUUID()}` })))}
                        >
                          📄 Simple Baseline
                        </button>
                      </div>
                    </div>
                    <div className="progression-theme-library" style={{ marginTop: "1rem" }}>
                      <div className="progression-template-header">
                        <div>
                          <strong>Import / Export Template</strong>
                          <span>Share your progression status card layout across novels.</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn-ai-sub btn-ai-secondary"
                          onClick={copyProgressionTemplateToClipboard}
                        >
                          <Copy size={12} />
                          Copy Template settings
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub btn-ai-secondary"
                          onClick={pasteProgressionTemplateFromClipboard}
                        >
                          <Clipboard size={12} />
                          Paste & Import Template
                        </button>
                      </div>
                    </div>
                    <div className="progression-preset-library">
                      <div className="progression-template-header">
                        <div>
                          <strong>Preset Cards</strong>
                          <span>Add optional status cards, then drag them into the order you want.</span>
                        </div>
                      </div>
                      <div className="progression-preset-grid">
                        {PROGRESSION_PRESET_TEMPLATE_CARDS.map(preset => (
                          <button
                            key={preset.id}
                            className={`progression-preset-card color-${preset.color}`}
                            onClick={() => addProgressionPresetCard(preset)}
                            type="button"
                          >
                            <strong>{preset.label}</strong>
                            <span>{preset.fields.join(" / ")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="progression-cultivation-import-box" style={{ marginBottom: "1rem" }}>
                      <div className="progression-template-header">
                        <div>
                          <strong>AI Prompt Designer</strong>
                          <span>Describe the status screen structure to design a custom template.</span>
                        </div>
                        <button type="button" className="btn-ai-sub btn-ai-secondary" onClick={() => setIsProgressionPromptDesignerOpen(prev => !prev)}>
                          <ChevronDown size={12} className={isProgressionPromptDesignerOpen ? "rotate" : ""} />
                          {isProgressionPromptDesignerOpen ? "Hide" : "Design"}
                        </button>
                      </div>
                      {isProgressionPromptDesignerOpen && (
                        <div className="progression-cultivation-import-body" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
                          <textarea
                            className="ai-textarea compact"
                            value={progressionTemplatePrompt}
                            onChange={(e) => setProgressionTemplatePrompt(e.target.value)}
                            placeholder="Describe what cards, stats, affinities, or ranks you want. Example: I want a profile template with name, Cultivation (stage and rank), levels, attributes (Strength, Agility, Endurance), and Affinity (Fire, Ice, Void)..."
                            rows={3}
                            disabled={progressionTemplatePromptLoading}
                          />
                          {progressionTemplatePromptError && (
                            <div style={{ color: "var(--error)", fontSize: "0.8rem" }}>
                              {progressionTemplatePromptError}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn-ai-sub btn-ai-primary"
                              onClick={handleDesignTemplateWithAi}
                              disabled={!progressionTemplatePrompt.trim() || progressionTemplatePromptLoading}
                            >
                              {progressionTemplatePromptLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                              Generate Template
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="progression-cultivation-import-box">
                      <div className="progression-template-header">
                        <div>
                          <strong>Cultivation System</strong>
                          <span>Upload or paste this novel&apos;s realm ladder so AI updates can place characters in the correct order.</span>
                        </div>
                        <button type="button" className="btn-ai-sub btn-ai-secondary" onClick={() => setIsProgressionCultivationImportOpen(prev => !prev)}>
                          <ChevronDown size={12} className={isProgressionCultivationImportOpen ? "rotate" : ""} />
                          {isProgressionCultivationImportOpen ? "Hide" : "Manage"}
                        </button>
                      </div>
                      <div className="progression-system-summary">
                        <span>{progressionSystem.realms.length} realms</span>
                        <span>{progressionSystem.stageLabels.join(" / ") || "No stages"}</span>
                      </div>
                      {isProgressionCultivationImportOpen && (
                        <div className="progression-cultivation-import-body">
                          <div className="progression-cultivation-actions">
                            <label className="btn-ai-sub btn-ai-secondary progression-file-btn">
                              <FileText size={12} />
                              Upload TXT
                              <input
                                type="file"
                                accept=".txt,text/plain"
                                onChange={(e) => handleCultivationRealmFileUpload(e.target.files?.[0])}
                              />
                            </label>
                          </div>
                          <textarea
                            className="ai-textarea compact progression-realm-import-textarea"
                            value={progressionRealmImportText}
                            onChange={(e) => setProgressionRealmImportText(e.target.value)}
                            placeholder="Paste realms here, weakest to strongest. Example: Mortal Realm, Spirit Realm, Saint Realm, God Realm..."
                          />
                          <div className="progression-cultivation-import-footer">
                            <button
                              type="button"
                              className="btn-ai-sub btn-ai-primary"
                              onClick={() => handleCultivationRealmImport()}
                              disabled={!progressionRealmImportText.trim() || progressionRealmImportLoading}
                            >
                              {progressionRealmImportLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                              Arrange Stages
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="progression-template-builder-list">
                      {normalizeProgressionTemplateCards(progressionSystem.profileTemplate.cards, progressionSystem.customFields).map(templateCard => (
                        <div
                          className={`progression-template-builder-card color-${templateCard.color} ${draggedProgressionTemplateCardId === templateCard.id ? "dragging" : ""} ${!templateCard.enabled ? "disabled-card" : ""}`}
                          key={templateCard.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (draggedProgressionTemplateCardId) {
                              reorderProgressionTemplateCard(draggedProgressionTemplateCardId, templateCard.id)
                            }
                            setDraggedProgressionTemplateCardId(null)
                          }}
                        >
                        <div
                          className="progression-template-drag-handle"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move"
                            setDraggedProgressionTemplateCardId(templateCard.id)
                          }}
                          onDragEnd={() => setDraggedProgressionTemplateCardId(null)}
                          title="Drag to reorder card"
                        >
                          <GripVertical size={15} />
                          <span>Drag to reorder</span>
                        </div>
                        <label>
                          <span>Card Name</span>
                          <input
                            className="ai-input"
                            value={templateCard.label}
                            onChange={(e) => setProgressionTemplateCards(cards => cards.map(card => card.id === templateCard.id ? {
                              ...card,
                              label: e.target.value,
                              sourceKey: card.sourceKey === card.label ? e.target.value : card.sourceKey
                            } : card))}
                          />
                        </label>
                        <label>
                          <span>Type</span>
                          <select
                            className="ai-select"
                            value={templateCard.type}
                            onChange={(e) => setProgressionTemplateCards(cards => cards.map(card => card.id === templateCard.id ? { ...card, type: e.target.value as ProgressionTemplateCardType } : card))}
                          >
                            <option value="text">Text</option>
                            <option value="rank">Realm / Rank</option>
                            <option value="compound">Multi-field Card</option>
                            <option value="progress">EXP / Progress</option>
                            <option value="resource">HP / Mana / Qi</option>
                            <option value="counter">Counter</option>
                            <option value="stat">Stat</option>
                            <option value="ability">Abilities</option>
                          </select>
                        </label>
                        <label>
                          <span>Source Field</span>
                          <input
                            className="ai-input"
                            value={templateCard.sourceKey}
                            onChange={(e) => setProgressionTemplateCards(cards => cards.map(card => card.id === templateCard.id ? { ...card, sourceKey: e.target.value } : card))}
                            placeholder="EXP, Race, Bloodline, strength..."
                          />
                        </label>
                        <label>
                          <span>Color</span>
                          <select
                            className="ai-select"
                            value={templateCard.color}
                            onChange={(e) => setProgressionTemplateCards(cards => cards.map(card => card.id === templateCard.id ? { ...card, color: e.target.value } : card))}
                          >
                            {PROGRESSION_CARD_COLORS.map(color => <option key={color} value={color}>{color}</option>)}
                          </select>
                        </label>
                        <label className="progression-template-fields-editor">
                          <span>Fields</span>
                          <div className="progression-template-field-editor-list">
                            {templateCard.fields.length === 0 ? (
                              <div className="empty-state-text compact">No fields yet.</div>
                            ) : templateCard.fields.map((fieldName, fieldIndex) => (
                              <div className="progression-template-field-editor-row" key={`${templateCard.id}-${fieldIndex}`}>
                                <input
                                  className="ai-input"
                                  value={fieldName}
                                  onChange={(e) => updateProgressionTemplateField(templateCard.id, fieldIndex, e.target.value)}
                                  placeholder="Field name"
                                />
                                <button
                                  className="btn-icon-mini danger"
                                  onClick={() => removeProgressionTemplateField(templateCard.id, fieldIndex)}
                                  title="Remove field"
                                  type="button"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button type="button" className="btn-ai-sub btn-ai-secondary progression-add-field-inline" onClick={() => addProgressionTemplateField(templateCard.id)}>
                            <Plus size={12} />
                            Add Field
                          </button>
                        </label>
                        <div className="progression-template-card-actions">
                          <label>
                            <input
                              type="checkbox"
                              checked={templateCard.enabled}
                              onChange={(e) => setProgressionTemplateCards(cards => cards.map(card => card.id === templateCard.id ? { ...card, enabled: e.target.checked } : card))}
                            />
                            Show
                          </label>
                          <button
                            className="btn-ai-sub btn-ai-secondary danger-text"
                            onClick={() => removeProgressionTemplateCard(templateCard.id)}
                            type="button"
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        </div>
                        </div>
                      ))}
                    </div>
                    <div className="progression-template-add-row">
                      <button
                        className="btn-ai-sub btn-ai-primary"
                        onClick={() => setProgressionTemplateCards(cards => [
                          ...cards,
                          {
                            id: `template-${crypto.randomUUID()}`,
                            label: "Unnamed Card",
                            type: "compound",
                            sourceKey: "custom",
                            fields: ["Field"],
                            color: getProgressionCardColor(cards.length, "compound"),
                            enabled: true
                          }
                        ])}
                        type="button"
                      >
                        <Plus size={12} />
                        Add Template Card
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => setShowProgressionTemplateModal(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {showVersionsModal && activeNote && (
          <div className="modal-overlay" onClick={() => { setShowVersionsModal(false); setSelectedVersionForDiff(null); }}>
            <div className={`modal versions-modal ${selectedVersionForDiff ? 'diff-mode' : ''}`} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Chapter History</h2>
                <p className="modal-description">
                  {selectedVersionForDiff 
                    ? `Comparing Snapshot (${new Date(selectedVersionForDiff.savedAt).toLocaleString()}) with Live Draft` 
                    : `Recent autosaved versions of "${activeNote.title || 'Untitled'}"`}
                </p>
              </div>
              
              {selectedVersionForDiff ? (
                <div className="diff-view-container">
                  <div className="diff-split-pane">
                    <div className="diff-pane-column">
                      <h4>Historic Snapshot ({selectedVersionForDiff.wordCount.toLocaleString()} words)</h4>
                      <div className="diff-pane-scroll scrollbar">
                        {diffLines.oldLines.map((line, idx) => (
                          <div key={idx} className={`diff-line-row line-${line.type}`}>
                            <span className="diff-line-number">{line.type !== 'empty' ? idx + 1 : ''}</span>
                            <pre className="diff-line-content">{line.text || ' '}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="diff-pane-column">
                      <h4>Live Draft ({countWords(activeNote.content).toLocaleString()} words)</h4>
                      <div className="diff-pane-scroll scrollbar">
                        {diffLines.newLines.map((line, idx) => (
                          <div key={idx} className={`diff-line-row line-${line.type}`}>
                            <span className="diff-line-number">{line.type !== 'empty' ? idx + 1 : ''}</span>
                            <pre className="diff-line-content">{line.text || ' '}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="modal-actions diff-actions" style={{ marginTop: "1rem" }}>
                    <button className="btn btn-ghost" onClick={() => setSelectedVersionForDiff(null)}>
                      &larr; Back to History
                    </button>
                    <button className="btn btn-primary" onClick={() => { restoreChapterVersion(selectedVersionForDiff); setSelectedVersionForDiff(null); }}>
                      Restore This Version
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setShowVersionsModal(false); setSelectedVersionForDiff(null); }}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="version-list">
                    {chapterVersions.length === 0 ? (
                      <div className="empty-state-text">No history yet. Versions appear after autosaves.</div>
                    ) : chapterVersions.map(version => (
                      <div key={version.id} className="version-item" style={{ cursor: "pointer" }} onClick={() => setSelectedVersionForDiff(version)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{new Date(version.savedAt).toLocaleString()}</strong>
                          <span>{version.wordCount.toLocaleString()} words</span>
                          <p>{version.content.slice(0, 180) || "Empty chapter"}</p>
                        </div>
                        <div style={{ display: "flex", gap: "0.45rem", marginLeft: "1rem", flexShrink: 0 }}>
                          <button className="btn-ai-sub btn-ai-secondary" onClick={(e) => { e.stopPropagation(); setSelectedVersionForDiff(version); }}>
                            Compare
                          </button>
                          <button className="btn-ai-sub btn-ai-primary" onClick={(e) => { e.stopPropagation(); restoreChapterVersion(version); }}>
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => { setShowVersionsModal(false); setSelectedVersionForDiff(null); }}>Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {exportModal && (
          <div className="modal-overlay" onClick={() => !isExporting && setExportModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Export Manuscript</h2>
                <p className="modal-description">
                  {isExporting 
                    ? `Exporting chapters... ${exportProgress}%` 
                    : exportFormat === 'folder'
                      ? `${getOrderedNotesList(notes).filter(note => !exportHistory[note.id] || exportHistory[note.id].fingerprint !== getChapterExportFingerprint(note)).length} of ${notes.length} chapters need folder export. Unchanged exported chapters will be skipped.`
                      : `Export ${notes.length} chapter${notes.length === 1 ? '' : 's'} in the format you need.`}
                </p>
              </div>
              {!isExporting && (
                <div className="export-format-grid">
                  {[
                    { value: 'folder', label: 'Folder', hint: 'Separate .txt files' },
                    { value: 'txt', label: 'TXT', hint: 'Plain manuscript' },
                    { value: 'md', label: 'Markdown', hint: 'Headings preserved' },
                    { value: 'epub', label: 'EPUB', hint: 'eBook format' },
                    { value: 'html', label: 'HTML', hint: 'Styled web file' },
                    { value: 'doc', label: 'Word', hint: 'Opens in Word' },
                    { value: 'pdf', label: 'PDF', hint: 'Print/save dialog' }
                  ].map(option => (
                    <button
                      key={option.value}
                      className={`export-format ${exportFormat === option.value ? 'active' : ''}`}
                      onClick={() => setExportFormat(option.value as ExportFormat)}
                    >
                      <FileDown size={15} />
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </button>
                  ))}
                </div>
              )}
              {isExporting && (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${exportProgress}%` }}></div>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                {!isExporting && exportFormat === 'folder' && Object.keys(exportHistory).length > 0 && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => persistExportHistory({})}
                  >
                    Reset History
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setExportModal(false)} disabled={isExporting}>Cancel</button>
                <button className="btn btn-primary" onClick={exportManuscript} disabled={isExporting}>
                  {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  {isExporting ? 'Exporting...' : 'Export Manuscript'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAILoreModal && (
          <div className="modal-overlay" onClick={() => !aiLoreLoading && setShowAILoreModal(false)}>
            <div className="modal glass" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} className="text-accent" />
                  Generate Lore with AI
                </h2>
                <p className="modal-description">
                  Enter a name and short prompt to automatically draft a detailed World Bible entry.
                </p>
              </div>
              <form onSubmit={handleGenerateAILore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="ai-form-field">
                  <label>Name / Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Aurelius, Elderwood Forest"
                    value={aiLoreName}
                    onChange={e => setAiLoreName(e.target.value)}
                    required
                    disabled={aiLoreLoading}
                  />
                </div>
                <div className="ai-form-field">
                  <label>Category</label>
                  <select
                    className="ai-select"
                    value={aiLoreCategory}
                    onChange={e => setAiLoreCategory(e.target.value as "character" | "world")}
                    disabled={aiLoreLoading}
                  >
                    <option value="character">👤 Character</option>
                    <option value="world">🗺️ World Item / Location</option>
                  </select>
                </div>
                <div className="ai-form-field">
                  <label>Context / Concept (Optional)</label>
                  <textarea
                    className="ai-textarea"
                    placeholder="e.g. A weary time-traveler seeking a lost artifact, or an ancient woods where stars fall."
                    value={aiLoreContext}
                    onChange={e => setAiLoreContext(e.target.value)}
                    disabled={aiLoreLoading}
                  />
                </div>
                {aiLoreError && (
                  <div className="ai-error-box">
                    <AlertCircle size={16} />
                    <span>{aiLoreError}</span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowAILoreModal(false)}
                    disabled={aiLoreLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={aiLoreLoading || !aiLoreName.trim()}
                  >
                    {aiLoreLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {hoveredLore && hoveredLorePosition && (
          <div 
            className="lore-hover-card glass"
            style={{
              position: 'absolute',
              top: hoveredLorePosition.top,
              left: hoveredLorePosition.left,
              transform: 'translate(-50%, -100%)',
              zIndex: 400,
              pointerEvents: 'none'
            }}
          >
            <div className="hover-card-header">
              <span className={`category-badge ${hoveredLore.category}`}>
                {hoveredLore.category === 'character' ? '👤 Person' : 
                 hoveredLore.category === 'beast' ? '🐾 Beast' : 
                 hoveredLore.category === 'place' ? '📍 Place' : '🗺️ World'}
              </span>
              <h4 className="hover-card-title">{hoveredLore.name}</h4>
            </div>
            <div className="hover-card-body">
              {hoveredLore.content ? (
                <p className="line-clamp-3">{hoveredLore.content.replace(/[#*`>_\-]/g, '').substring(0, 150)}...</p>
              ) : (
                <p className="no-info">No biography or notes entered yet.</p>
              )}
            </div>
            <div className="hover-card-footer">
              <span>Click to view details</span>
            </div>
          </div>
        )}

        {/* Focus Sprint Complete Modal */}
        {showSprintCompleteModal && (
          <div className="sprint-modal-overlay">
            <div className="sprint-modal-content glass">
              <div className="sprint-modal-header">
                <span className="sprint-modal-icon">🎉</span>
                <h3>Sprint Complete!</h3>
              </div>
              <div className="sprint-modal-body">
                <p>Congratulations! You have completed your focus writing sprint.</p>
                <div className="sprint-stats-summary">
                  <div className="stat-box">
                    <span className="stat-val">{sprintCompleteWords.toLocaleString()}</span>
                    <span className="stat-lbl">Words Written</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-val">{Math.round(sprintDuration / 60)}m</span>
                    <span className="stat-lbl">Time Focused</span>
                  </div>
                </div>
                <p className="sprint-modal-quote">&ldquo;A journey of a thousand miles begins with a single step.&rdquo;</p>
              </div>
              <div className="sprint-modal-actions">
                <button className="btn-new" onClick={() => setShowSprintCompleteModal(false)}>
                  Keep Writing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Milestone Achievement Alert Modal */}
        {showMilestoneAlert && (
          <div className="sprint-modal-overlay milestone-overlay">
            <div className="sprint-modal-content milestone-content glass-light pulse-glow">
              <div className="sprint-modal-header">
                <span className="sprint-modal-icon animate-bounce">{showMilestoneAlert.badge}</span>
                <h3 className="milestone-achieved-title">Cultivation Rank Unlocked!</h3>
              </div>
              <div className="sprint-modal-body">
                <p className="milestone-unlock-subtitle">You have ascended to the realm of:</p>
                <h2 className="milestone-unlocked-rank">{showMilestoneAlert.title}</h2>
                <p className="milestone-unlock-desc">&ldquo;{showMilestoneAlert.description}&rdquo;</p>
                <div className="milestone-unlocked-details text-left">
                  <div className="flex justify-between">
                    <span>Requirement:</span>
                    <strong>{showMilestoneAlert.reqWords.toLocaleString()} words</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Current total:</span>
                    <strong>{currentTotalWords.toLocaleString()} words</strong>
                  </div>
                </div>
              </div>
              <div className="sprint-modal-actions">
                <button className="btn-new milestone-btn w-full justify-center" onClick={() => setShowMilestoneAlert(null)}>
                  Claim Realm Rank
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .editor-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--background);
          color: var(--text-primary);
          position: relative;
          transition: background 0.5s ease;
        }

        /* World Bible Integration Styles */
        .bible-header-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 0.75rem;
        }

        .editor-controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .mentioned-lore-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          max-width: 50%;
          overflow: hidden;
        }

        .mentioned-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-dim);
          white-space: nowrap;
        }

        .mentioned-chips-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .mentioned-chips-row::-webkit-scrollbar {
          display: none;
        }

        .mentioned-lore-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          transition: var(--transition);
          white-space: nowrap;
        }

        .mentioned-lore-chip:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .mentioned-lore-chip.character {
          border-color: rgba(99, 102, 241, 0.2);
        }

        .mentioned-lore-chip.character:hover {
          background: var(--primary-light);
          color: var(--primary-hover);
          border-color: var(--primary);
        }

        .mentioned-lore-chip.world {
          border-color: rgba(167, 139, 250, 0.2);
        }

        .mentioned-lore-chip.world:hover {
          background: var(--accent-light);
          color: var(--accent);
          border-color: var(--accent);
        }

        .mentioned-lore-chip.beast {
          border-color: rgba(245, 158, 11, 0.2);
        }

        .mentioned-lore-chip.beast:hover {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(245, 158, 11);
          border-color: rgb(245, 158, 11);
        }

        .mentioned-lore-chip.place {
          border-color: rgba(16, 185, 129, 0.2);
        }

        .mentioned-lore-chip.place:hover {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(16, 185, 129);
          border-color: rgb(16, 185, 129);
        }

        .mentioned-lore-chip.item {
          border-color: rgba(168, 85, 247, 0.2);
        }

        .mentioned-lore-chip.item:hover {
          background: rgba(168, 85, 247, 0.1);
          color: rgb(168, 85, 247);
          border-color: rgb(168, 85, 247);
        }

        .chip-name {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lore-chip-preview {
          color: var(--accent);
          font-weight: 600;
          border-bottom: 1px dashed var(--accent);
          cursor: pointer;
          transition: var(--transition);
          padding: 0 2px;
        }

        .lore-chip-preview:hover {
          color: var(--accent-light);
          background: rgba(167, 139, 250, 0.15);
          border-bottom-style: solid;
        }

        .lore-hover-card {
          width: 260px;
          padding: 1rem;
          border-radius: var(--radius-md);
          background: rgba(15, 17, 23, 0.95);
          border: 1px solid var(--surface-border);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px -3px var(--primary-glow);
          color: var(--text-primary);
          animation: fadeInCard 0.2s ease-out forwards;
        }

        @keyframes fadeInCard {
          from { opacity: 0; transform: translate(-50%, -95%); }
          to { opacity: 1; transform: translate(-50%, -100%); }
        }

        .hover-card-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 0.5rem;
          border-bottom: 1px solid var(--surface-border);
          padding-bottom: 0.5rem;
        }

        .category-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .category-badge.character {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .category-badge.beast {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(245, 158, 11);
        }

        .category-badge.place {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(16, 185, 129);
        }

        .category-badge.world {
          background: var(--accent-light);
          color: var(--accent);
        }

        .hover-card-title {
          font-family: var(--font-outfit);
          font-size: 1rem;
          font-weight: 700;
        }

        .hover-card-body {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .hover-card-body .no-info {
          font-style: italic;
          color: var(--text-dim);
        }

        .hover-card-footer {
          font-size: 0.65rem;
          color: var(--text-dim);
          text-align: right;
          border-top: 1px dashed var(--surface-border);
          padding-top: 0.25rem;
        }

        .loading-screen {
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .loading-logo {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .editor-header {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1rem;
          border-bottom: 1px solid var(--surface-border);
          position: relative;
          z-index: 50;
          flex-shrink: 0;
          background: rgba(10, 10, 15, 0.85);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        /* Zen mode transitions */
        .zen-mode .editor-header {
          opacity: 0;
          pointer-events: none;
          transform: translateY(-100%);
        }

        .exit-zen-btn {
          position: fixed;
          top: 1.5rem;
          right: 2rem;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          background: rgba(10, 10, 15, 0.6);
          cursor: pointer;
          transition: var(--transition);
        }
        .exit-zen-btn:hover {
          color: var(--text-primary);
          border-color: var(--primary);
        }

        .editor-activity-bar {
          width: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 0;
          border-right: 1px solid var(--surface-border);
          background: rgba(8, 8, 12, 0.95);
          flex-shrink: 0;
          z-index: 40;
        }

        .activity-top, .activity-bottom {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: center;
          width: 100%;
        }

        .activity-btn {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition);
        }

        .activity-btn:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .activity-btn.active {
          color: var(--primary-hover);
          background: var(--primary-light);
          box-shadow: 0 0 10px -2px var(--primary-glow);
        }

        .activity-btn.toggle-sidebar {
          color: var(--text-muted);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .project-info {
          display: flex;
          flex-direction: column;
        }

        .project-label {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
        }

        .project-name {
          font-family: var(--font-outfit);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .header-center {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .view-toggle {
          display: flex;
          padding: 3px;
          border-radius: var(--radius-sm);
        }

        .view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }

        .view-btn:hover {
          color: var(--text-primary);
        }

        .view-btn.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .font-selector,
        .theme-selector {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: var(--radius-md);
        }

        .font-selector select,
        .theme-selector select {
          padding: 0.4rem 0.6rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
        }

        .font-selector select option,
        .theme-selector select option {
          background: var(--background);
          color: var(--text-primary);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .sync-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-dim);
        }

        .sync-badge.saved {
          color: var(--success);
        }

        .sync-badge.saving {
          color: var(--primary);
        }

        .sync-badge.error {
          color: var(--error);
        }

        .last-saved-label {
          color: var(--text-dim);
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .mobile-fab {
          display: none;
        }

        .editor-sidebar {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          border-right: 1px solid var(--surface-border);
          background: var(--surface-raised);
          flex-shrink: 0;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
          position: relative;
        }

        .editor-sidebar.collapsed {
          width: 0px;
          padding: 0px;
          border-right: none;
          opacity: 0;
          pointer-events: none;
        }

        .resizing-sidebar,
        .resizing-sidebar * {
          cursor: col-resize !important;
          user-select: none !important;
        }

        .resizing-sidebar .editor-sidebar {
          transition: none;
        }

        .sidebar-resize-handle {
          position: absolute;
          top: 0;
          right: -4px;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          z-index: 5;
          touch-action: none;
        }

        .sidebar-resize-handle::after {
          content: "";
          position: absolute;
          top: 0.75rem;
          right: 3px;
          bottom: 0.75rem;
          width: 2px;
          border-radius: var(--radius-full);
          background: transparent;
          transition: var(--transition);
        }

        .sidebar-resize-handle:hover::after,
        .sidebar-resize-handle:focus-visible::after,
        .resizing-sidebar .sidebar-resize-handle::after {
          background: var(--primary);
        }

        .sidebar-tab-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
        }

        .sidebar-section {
          margin-bottom: 0.75rem;
        }

        .manuscript-insights {
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
        }

        .insights-panel {
          gap: 0.75rem;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          margin-bottom: 0.65rem;
        }

        .insights-grid div {
          padding: 0.55rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.035);
        }

        .insights-grid strong {
          display: block;
          color: var(--text-primary);
          font-size: 0.94rem;
          line-height: 1.1;
        }

        .insights-grid span {
          display: block;
          color: var(--text-dim);
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 0.2rem;
        }

        .btn-timeline-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          width: 100%;
          height: 30px;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-timeline-toggle:hover {
          color: var(--primary);
          border-color: var(--primary);
        }

        .insight-callout {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.62rem;
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-sm);
          background: rgba(245, 158, 11, 0.08);
          color: rgb(252, 211, 77);
          font-size: 0.76rem;
          font-weight: 800;
        }

        .insights-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--text-dim);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .chapter-timeline {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          max-height: 260px;
          overflow-y: auto;
          padding-right: 0.2rem;
          margin-bottom: 0.75rem;
        }

        .insights-timeline {
          max-height: none;
          flex: 1;
          margin-bottom: 0;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          width: 100%;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          padding: 0.62rem;
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .timeline-item:hover,
        .timeline-item.active {
          border-color: rgba(99, 102, 241, 0.35);
          background: var(--primary-light);
        }

        .timeline-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--primary);
          margin-top: 0.28rem;
          flex-shrink: 0;
        }

        .timeline-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
        }

        .timeline-content strong,
        .timeline-content small,
        .timeline-content em {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .timeline-content strong {
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .timeline-content small,
        .timeline-content em {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-style: normal;
        }

        .btn-new {
          width: 100%;
          padding: 0.75rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: 0 4px 10px -2px var(--primary-glow);
        }

        .btn-new:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.5rem 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-dim);
          margin-bottom: 0.75rem;
        }

        .sidebar-search input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
        }

        .sidebar-search input::placeholder {
          color: var(--text-dim);
        }

        .chapter-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .sidebar-chapters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.5rem;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-dim);
        }

        .btn-select-mode {
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .btn-select-mode:hover {
          background: var(--primary-light);
        }

        .selection-count {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .selection-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .btn-text-action {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .btn-text-action:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .btn-text-action.danger {
          color: var(--error);
        }

        .btn-text-action.danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-hover);
        }

        .btn-text-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .selection-dropdown {
          position: relative;
          display: inline-flex;
        }

        .selection-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .selection-group-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: min(230px, 78vw);
          max-height: 260px;
          overflow-y: auto;
          padding: 0.4rem;
          border: 1px solid rgba(244, 63, 94, 0.32);
          border-radius: var(--radius-md);
          background: rgb(18, 18, 23);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04);
          z-index: 80;
        }

        .selection-menu-label {
          padding: 0.35rem 0.45rem 0.45rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .selection-menu-empty {
          padding: 0.55rem 0.45rem;
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .selection-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.55rem 0.6rem;
          border: none;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.045);
          color: rgb(226, 232, 240);
          font-size: 0.82rem;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .selection-menu-item span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selection-menu-item strong {
          color: var(--text-dim);
          font-size: 0.72rem;
          font-weight: 800;
        }

        .selection-menu-item:hover {
          background: rgba(244, 63, 94, 0.18);
          color: rgb(255, 255, 255);
        }

        .selection-menu-item.create {
          justify-content: flex-start;
          color: var(--primary);
          border-top: 1px solid var(--surface-border);
          border-radius: 0 0 var(--radius-sm) var(--radius-sm);
          margin-top: 0.25rem;
          padding-top: 0.65rem;
        }

        .checkbox-custom {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          background: transparent;
          border: 1.5px solid var(--text-dim);
          border-radius: 4px;
          transition: var(--transition);
          flex-shrink: 0;
          cursor: pointer;
        }

        .checkbox-custom.checked {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .checkbox-custom:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .volume-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          padding: 0.2rem;
          transition: var(--transition);
        }

        .volume-group.drag-ready {
          border-color: rgba(99, 102, 241, 0.18);
          background: rgba(99, 102, 241, 0.04);
        }

        .volume-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 34px;
          padding: 0.35rem 0.5rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--surface-border);
        }

        .volume-toggle,
        .volume-title,
        .volume-add-chapter,
        .volume-open-toggle {
          border: 0;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .volume-toggle,
        .volume-add-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .volume-toggle:hover,
        .volume-add-chapter:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .volume-title {
          flex: 1;
          min-width: 0;
          padding: 0;
          color: var(--text-primary);
          font-size: 0.78rem;
          font-weight: 800;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .volume-count {
          flex-shrink: 0;
          min-width: 22px;
          padding: 0.12rem 0.38rem;
          border-radius: var(--radius-full);
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          text-align: center;
        }

        .volume-open-toggle {
          flex-shrink: 0;
          padding: 0.18rem 0.42rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(148, 163, 184, 0.08);
          color: var(--text-dim);
          font-size: 0.62rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .volume-open-toggle.open {
          border-color: rgba(16, 185, 129, 0.25);
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
        }

        .volume-open-field {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
        }

        .volume-open-field input {
          accent-color: var(--primary);
        }

        .volume-chapters {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 0.35rem;
        }

        .volume-empty {
          padding: 0.55rem 0.75rem;
          color: var(--text-dim);
          font-size: 0.75rem;
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-sm);
        }

        .chapter-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
        }

        .chapter-item[draggable="true"] {
          cursor: grab;
        }

        .chapter-item[draggable="true"]:active {
          cursor: grabbing;
        }

        .chapter-item.selection-mode {
          border-left: 3px solid transparent;
          user-select: none;
        }

        .chapter-item.selection-mode.selected {
          background: var(--primary-light);
          border-left-color: var(--primary);
          color: var(--text-primary);
        }

        .chapter-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .chapter-item.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .chapter-title {
          flex: 1;
          font-size: 0.9rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chapter-exported-badge {
          flex-shrink: 0;
          padding: 0.14rem 0.38rem;
          border-radius: var(--radius-full);
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
          border: 1px solid rgba(16, 185, 129, 0.18);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .btn-delete-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          opacity: 0;
          transition: var(--transition);
        }

        .chapter-item:hover .btn-delete-chapter,
        .chapter-item:hover .btn-save-chapter {
          opacity: 1;
        }

        .chapter-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: var(--transition);
        }

        .chapter-item:hover .chapter-actions {
          opacity: 1;
        }

        .btn-save-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-save-chapter:hover {
          background: var(--success-light);
          color: var(--success);
        }

        .btn-save-chapter.saved {
          color: var(--success);
        }

        .btn-export {
          width: 100%;
          padding: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
          margin-top: 0.5rem;
        }

        .btn-export:hover {
          border-color: var(--primary);
          color: var(--primary-hover);
        }

        .btn-volume-add {
          margin-top: 0.5rem;
        }

        .chapter-move-menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 450;
        }

        .chapter-move-menu {
          position: fixed;
          display: flex;
          flex-direction: column;
          min-width: 190px;
          max-width: min(260px, calc(100vw - 1rem));
          padding: 0.4rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          box-shadow: 0 18px 35px rgba(0, 0, 0, 0.35);
        }

        .chapter-move-title {
          padding: 0.35rem 0.45rem 0.45rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .chapter-move-menu button {
          width: 100%;
          padding: 0.5rem 0.55rem;
          border: 0;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          text-align: left;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .chapter-move-menu button:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .linked-folder-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.4rem 0.6rem;
          background: var(--surface-hover);
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-sm);
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          gap: 6px;
        }

        .folder-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .btn-disconnect-folder {
          background: transparent;
          border: none;
          color: var(--error);
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 4px;
          border-radius: var(--radius-sm);
          transition: var(--transition);
        }

        .btn-disconnect-folder:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-hover);
        }

        /* World Bible Styles */
        .bible-filters {
          display: flex;
          gap: 4px;
          padding: 0 0.5rem 0.75rem 0.5rem;
          border-bottom: 1px solid var(--surface-border);
          margin-bottom: 0.75rem;
        }

        .bible-group-strip {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding: 0 0.5rem 0.75rem;
          margin-bottom: 0.4rem;
          border-bottom: 1px solid var(--surface-border);
        }

        .bible-group-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          max-width: 155px;
          min-height: 28px;
          padding: 0.32rem 0.5rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--surface-border);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }

        .bible-group-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bible-group-chip strong {
          color: var(--primary);
          font-size: 0.68rem;
        }

        .bible-group-chip:hover,
        .bible-group-chip.active,
        .bible-group-chip.drop-ready {
          border-color: rgba(99, 102, 241, 0.32);
          background: var(--primary-light);
          color: var(--text-primary);
        }

        .bible-group-chip.add {
          color: rgb(94, 234, 212);
          border-color: rgba(20, 184, 166, 0.2);
        }

        .bible-entry-groups {
          flex-shrink: 0;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-dim);
          font-size: 0.66rem;
          font-weight: 800;
        }

        .bible-group-editor {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 0.55rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.12);
        }

        .bible-group-check {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .bible-group-check input {
          accent-color: var(--primary);
        }

        .filter-chip {
          padding: 3px 8px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--surface-border);
          background: transparent;
          color: var(--text-dim);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: var(--transition);
        }

        .filter-chip:hover {
          color: var(--text-primary);
          border-color: var(--text-dim);
        }

        .filter-chip.active {
          background: var(--primary-light);
          color: var(--primary-hover);
          border-color: var(--primary);
        }

        .empty-state-text {
          font-size: 0.8rem;
          color: var(--text-dim);
          text-align: center;
          margin-top: 2rem;
        }

        .empty-state-text.compact {
          margin-top: 0;
          text-align: left;
          font-size: 0.75rem;
        }

        /* Appearance Prompt Lab */
        .appearance-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
        }

        .appearance-header,
        .appearance-prompt-header,
        .appearance-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .appearance-chapter-chip {
          flex-shrink: 0;
          padding: 0.25rem 0.45rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(99, 102, 241, 0.24);
          background: rgba(99, 102, 241, 0.1);
          color: rgb(165, 180, 252);
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .appearance-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
        }

        .appearance-textarea {
          min-height: 86px;
          max-height: 160px;
        }

        .appearance-selection-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 32px;
          border: 1px solid rgba(20, 184, 166, 0.24);
          border-radius: var(--radius-sm);
          background: rgba(20, 184, 166, 0.1);
          color: rgb(94, 234, 212);
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .appearance-selection-btn:hover:not(:disabled) {
          border-color: rgba(20, 184, 166, 0.42);
          background: rgba(20, 184, 166, 0.16);
        }

        .appearance-selection-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .appearance-source-card {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.7rem;
          border: 1px solid rgba(99, 102, 241, 0.18);
          border-radius: var(--radius-md);
          background: rgba(99, 102, 241, 0.08);
        }

        .appearance-source-card strong {
          color: var(--text-primary);
          font-size: 0.86rem;
        }

        .appearance-source-card span {
          width: fit-content;
          padding: 0.16rem 0.42rem;
          border-radius: var(--radius-full);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-dim);
          font-size: 0.66rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .appearance-source-card p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.76rem;
          line-height: 1.45;
        }

        .appearance-results {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding-bottom: 1rem;
        }

        .appearance-overview,
        .appearance-prompt-card,
        .appearance-notes {
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.16);
          padding: 0.75rem;
        }

        .appearance-overview span,
        .appearance-notes span,
        .appearance-prompt-header strong {
          color: var(--text-primary);
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .appearance-overview p,
        .appearance-prompt-card p,
        .appearance-notes p {
          margin: 0.45rem 0 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.55;
          word-break: break-word;
        }

        .appearance-prompt-card {
          border-color: rgba(99, 102, 241, 0.18);
        }

        .appearance-prompt-card.muted {
          border-color: rgba(148, 163, 184, 0.18);
        }

        .appearance-prompt-header .btn-ai-sub {
          flex-shrink: 0;
          min-height: 26px;
          padding: 0.25rem 0.45rem;
        }

        /* Character Progression */
        .progression-panel {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          overflow-y: auto;
          padding-bottom: 1rem;
        }

        .progression-card,
        .progression-detail {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
        }

        .progression-toolbar {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .progression-profile-select {
          min-height: 42px;
          font-weight: 800;
        }

        .progression-notice {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          padding: 0.6rem;
          border-radius: var(--radius-sm);
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
          font-size: 0.76rem;
          line-height: 1.4;
        }

        .progression-profile-list {
          display: flex;
          gap: 0.45rem;
          overflow-x: auto;
          flex-shrink: 0;
          padding-bottom: 0.15rem;
        }

        .progression-profile-chip {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.2rem;
          width: 150px;
          min-height: 58px;
          padding: 0.65rem 0.7rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }

        .progression-profile-chip:hover,
        .progression-profile-chip.active {
          border-color: rgba(244, 63, 94, 0.45);
          background: linear-gradient(145deg, rgba(244, 63, 94, 0.18), rgba(99, 102, 241, 0.1));
          color: var(--text-primary);
          box-shadow: 0 14px 32px rgba(244, 63, 94, 0.12);
        }

        .progression-profile-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.76rem;
          font-weight: 900;
          max-width: 100%;
        }

        .progression-profile-chip strong {
          color: rgb(251, 113, 133);
          font-size: 0.68rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .progression-library-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          margin-bottom: 0.55rem;
        }

        .progression-library-card {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0.35rem;
          min-height: 96px;
          padding: 0.75rem;
          border: 1px solid rgba(244, 63, 94, 0.22);
          border-radius: var(--radius-md);
          background: radial-gradient(circle at top left, rgba(244, 63, 94, 0.2), transparent 52%), rgba(255, 255, 255, 0.045);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition);
          text-align: left;
        }

        .progression-library-card.template {
          border-color: rgba(20, 184, 166, 0.24);
          background: radial-gradient(circle at top left, rgba(20, 184, 166, 0.2), transparent 52%), rgba(255, 255, 255, 0.045);
        }

        .progression-library-card:hover {
          transform: translateY(-1px);
          border-color: rgba(244, 63, 94, 0.46);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.24);
        }

        .progression-library-card.template:hover {
          border-color: rgba(20, 184, 166, 0.46);
        }

        .progression-action-banner {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.85rem;
          border: 1px solid rgba(139, 92, 246, 0.28);
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.05)), rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          position: relative;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .progression-action-banner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.15));
          opacity: 0;
          transition: opacity 0.25s ease;
          z-index: 0;
        }

        .progression-action-banner:hover::before {
          opacity: 1;
        }

        .progression-action-banner:hover {
          transform: translateY(-1px);
          border-color: rgba(139, 92, 246, 0.48);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.12);
        }

        .progression-action-banner.scanning {
          border-color: rgba(139, 92, 246, 0.48);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.1)), rgba(255, 255, 255, 0.05);
          cursor: not-allowed;
        }

        .progression-action-banner.scanning::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.15), transparent);
          animation: progression-scan-shine 2s infinite;
          z-index: 1;
        }

        @keyframes progression-scan-shine {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        .progression-banner-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(139, 92, 246, 0.15);
          color: rgb(167, 139, 250);
          flex-shrink: 0;
          z-index: 2;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .progression-action-banner:hover .progression-banner-icon-container {
          background: rgba(139, 92, 246, 0.25);
          color: white;
          transform: scale(1.05);
          transition: all 0.2s ease;
        }

        .progression-banner-icon {
          z-index: 2;
        }

        .progression-banner-content {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          flex-grow: 1;
          z-index: 2;
        }

        .progression-banner-content h4 {
          margin: 0;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .progression-banner-content p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .progression-banner-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          background: rgba(139, 92, 246, 0.2);
          color: rgb(196, 181, 253);
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid rgba(139, 92, 246, 0.25);
          z-index: 2;
          flex-shrink: 0;
        }

        .progression-library-card div {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-library-card strong {
          color: white;
          font-size: 1.35rem;
          line-height: 1;
        }

        .progression-library-card p {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.72rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .progression-create-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid rgba(20, 184, 166, 0.24);
          border-radius: var(--radius-md);
          background: radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 48%), rgba(255, 255, 255, 0.04);
        }

        .progression-create-card div {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .progression-create-card span {
          color: rgb(94, 234, 212);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-create-card strong {
          color: var(--text-primary);
          font-size: 1rem;
        }

        .progression-create-card p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.76rem;
          line-height: 1.45;
        }

        .progression-system-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.82rem;
          font-weight: 900;
          cursor: pointer;
        }

        .progression-system-toggle svg {
          transition: var(--transition);
        }

        .progression-system-toggle svg.rotate {
          transform: rotate(180deg);
        }

        .progression-system-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .progression-system-summary span,
        .progression-mini-toggle {
          padding: 0.24rem 0.45rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
        }

        .progression-system-editor {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding-top: 0.65rem;
          border-top: 1px solid var(--surface-border);
        }

        .progression-template-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.06);
        }

        .progression-template-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .progression-template-header div {
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
          min-width: 0;
        }

        .progression-template-header strong {
          color: var(--text-primary);
          font-size: 0.82rem;
        }

        .progression-template-header span {
          color: var(--text-dim);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .progression-template-header label {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 900;
        }

        .progression-template-header input {
          accent-color: var(--primary);
        }

        .progression-toggle-row,
        .progression-stat-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .progression-toggle-row label {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .progression-toggle-row input {
          accent-color: var(--primary);
        }

        .progression-mini-toggle {
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: var(--transition);
        }

        .progression-mini-toggle.active {
          border-color: rgba(99, 102, 241, 0.35);
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .progression-auto-btn {
          justify-content: center;
        }

        .progression-detail {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.18));
          border-color: rgba(148, 163, 184, 0.16);
        }

        .progression-profile-showcase {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid rgba(99, 102, 241, 0.24);
          border-radius: var(--radius-md);
          background:
            radial-gradient(circle at 8% 0%, rgba(244, 63, 94, 0.18), transparent 34%),
            radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.15), transparent 32%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(13, 13, 17, 0.92));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .progression-showcase-head {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .progression-showcase-head h3,
        .progression-showcase-head p {
          margin: 0;
        }

        .progression-showcase-head span {
          color: rgb(196, 181, 253);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .progression-showcase-head h3 {
          color: white;
          font-size: 1.25rem;
          line-height: 1.12;
        }

        .progression-showcase-head p {
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .progression-showcase-head > strong {
          flex-shrink: 0;
          padding: 0.3rem 0.55rem;
          border: 1px solid rgba(252, 211, 77, 0.32);
          border-radius: var(--radius-full);
          background: rgba(252, 211, 77, 0.12);
          color: rgb(253, 224, 71);
          font-size: 0.75rem;
          font-weight: 900;
          text-align: center;
        }

        .progression-showcase-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.55rem;
        }

        .progression-template-display-card {
          --card-accent: rgb(244, 63, 94);
          display: flex;
          flex-direction: column;
          gap: 0.32rem;
          min-height: 70px;
          padding: 0.7rem;
          border: 1px solid color-mix(in srgb, var(--card-accent) 44%, transparent);
          border-radius: var(--radius-md);
          background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 17%, transparent), rgba(255, 255, 255, 0.035));
        }

        .progression-template-display-card.color-violet,
        .progression-template-builder-card.color-violet {
          --card-accent: rgb(139, 92, 246);
        }

        .progression-template-display-card.color-cyan,
        .progression-template-builder-card.color-cyan {
          --card-accent: rgb(6, 182, 212);
        }

        .progression-template-display-card.color-amber,
        .progression-template-builder-card.color-amber {
          --card-accent: rgb(245, 158, 11);
        }

        .progression-template-display-card.color-emerald,
        .progression-template-builder-card.color-emerald {
          --card-accent: rgb(16, 185, 129);
        }

        .progression-template-display-card.color-blue,
        .progression-template-builder-card.color-blue {
          --card-accent: rgb(59, 130, 246);
        }

        .progression-template-display-card.color-fuchsia,
        .progression-template-builder-card.color-fuchsia {
          --card-accent: rgb(217, 70, 239);
        }

        .progression-template-display-card.color-lime,
        .progression-template-builder-card.color-lime {
          --card-accent: rgb(132, 204, 22);
        }

        .progression-template-display-card span {
          color: color-mix(in srgb, var(--card-accent) 64%, white);
          font-size: 0.67rem;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-template-display-card strong {
          color: white;
          font-size: 0.9rem;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .progression-template-field-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .progression-template-field-list div {
          display: flex;
          flex-direction: column;
          gap: 0.16rem;
          min-width: 0;
          padding: 0.42rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
        }

        .progression-template-field-list small {
          color: color-mix(in srgb, var(--card-accent) 56%, white);
          font-size: 0.63rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .progression-template-field-list strong {
          font-size: 0.78rem;
        }

        .progression-template-display-card.wide {
          min-height: 0;
        }

        .progression-template-progress {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.45rem;
          align-items: center;
          margin-top: 0.15rem;
        }

        .progression-template-progress div {
          height: 7px;
          overflow: hidden;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.11);
        }

        .progression-template-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--card-accent), color-mix(in srgb, var(--card-accent) 45%, white));
        }

        .progression-template-progress small {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
        }

        .progression-template-ability-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .progression-template-ability-list div {
          padding: 0.55rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.18);
        }

        .progression-template-ability-list strong {
          display: inline;
          font-size: 0.82rem;
        }

        .progression-template-ability-list em {
          float: right;
          color: rgb(253, 224, 71);
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 900;
        }

        .progression-template-ability-list p {
          margin: 0.32rem 0 0;
          color: var(--text-secondary);
          font-size: 0.75rem;
          line-height: 1.45;
        }

        .progression-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(99, 102, 241, 0.24);
          border-radius: var(--radius-md);
          background: radial-gradient(circle at top left, rgba(99, 102, 241, 0.26), transparent 48%), rgba(15, 23, 42, 0.52);
        }

        .progression-hero h3,
        .progression-hero p {
          margin: 0;
        }

        .progression-hero span {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-hero h3 {
          color: var(--text-primary);
          font-size: 1.12rem;
          line-height: 1.2;
        }

        .progression-hero p {
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        .progression-hero > strong {
          flex-shrink: 0;
          padding: 0.28rem 0.52rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(252, 211, 77, 0.22);
          background: rgba(252, 211, 77, 0.1);
          color: rgb(252, 211, 77);
          font-size: 0.75rem;
          font-weight: 900;
        }

        .progression-hero-actions {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
        }

        .btn-icon-mini {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-icon-mini:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .btn-icon-mini.danger {
          color: var(--error);
        }

        .btn-icon-mini.danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-hover);
        }

        .progression-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.07);
        }

        .progression-edit-grid,
        .progression-edit-stat-grid,
        .progression-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .progression-edit-grid label,
        .progression-edit-stat-grid label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .progression-exp {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .progression-exp > div:first-child {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
          font-size: 0.74rem;
          font-weight: 800;
        }

        .progression-exp-bar {
          height: 7px;
          overflow: hidden;
          border-radius: var(--radius-full);
          background: rgba(148, 163, 184, 0.14);
        }

        .progression-exp-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, rgb(99, 102, 241), rgb(20, 184, 166));
        }

        .progression-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .progression-stat-grid div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.55rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.035);
        }

        .progression-stat-grid span {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .progression-stat-grid strong {
          color: var(--text-primary);
        }

        .progression-field-grid div {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.65rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.045);
        }

        .progression-field-grid.profile-sheet {
          grid-template-columns: 1fr;
        }

        .progression-field-grid span {
          color: var(--text-dim);
          font-size: 0.66rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .progression-field-grid strong {
          color: var(--text-primary);
          font-size: 0.84rem;
          overflow-wrap: anywhere;
        }

        .progression-unique-card {
          padding: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.08);
        }

        .progression-unique-card span {
          color: rgb(94, 234, 212);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-unique-card p {
          margin: 0.4rem 0 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .progression-profile-footer-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          padding-top: 0.25rem;
        }

        .growth-toggle-buttons {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.15rem;
          border-radius: var(--radius-sm, 4px);
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .btn-toggle-growth {
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.2rem 0.45rem;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-toggle-growth:hover {
          color: var(--text-primary);
        }

        .btn-toggle-growth.active {
          background: var(--color-primary, #6366f1);
          color: #fff;
        }

        .growth-chart-container {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: var(--radius-md);
          padding: 0.6rem;
        }

        .growth-chart-tooltip {
          pointer-events: none;
          transition: left 0.1s ease, top 0.1s ease;
        }

        .growth-tooltip-content {
          background: #0f0f1b;
          border: 1px solid var(--color-primary, #6366f1);
          border-radius: 4px;
          padding: 0.35rem 0.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 100px;
        }

        .growth-tooltip-content strong {
          color: var(--color-primary, #6366f1);
          font-size: 0.72rem;
          font-weight: 900;
        }

        .growth-tooltip-content span {
          color: #cdd6f4;
          font-size: 0.65rem;
          opacity: 0.85;
          white-space: nowrap;
        }

        .progression-growth-timeline {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding-top: 0.25rem;
        }

        .progression-growth-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .progression-growth-header div {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          min-width: 0;
        }

        .progression-growth-header strong {
          color: var(--text-primary);
          font-size: 0.82rem;
        }

        .progression-growth-header span {
          flex-shrink: 0;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .progression-growth-empty,
        .progression-growth-item {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .progression-growth-empty {
          padding: 0.7rem;
        }

        .progression-growth-empty p,
        .progression-growth-empty small {
          margin: 0;
        }

        .progression-growth-empty p {
          color: var(--text-primary);
          font-size: 0.8rem;
          font-weight: 800;
        }

        .progression-growth-empty small {
          display: block;
          margin-top: 0.25rem;
          color: var(--text-dim);
          font-size: 0.72rem;
          line-height: 1.4;
        }

        .progression-growth-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .progression-growth-item {
          overflow: hidden;
        }

        .progression-growth-item summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.55rem;
          align-items: center;
          padding: 0.65rem;
          cursor: pointer;
          list-style: none;
        }

        .progression-growth-item summary::-webkit-details-marker {
          display: none;
        }

        .progression-growth-item summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }

        .progression-growth-summary-main {
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
          min-width: 0;
        }

        .progression-growth-summary-main span,
        .progression-growth-detail-block > span {
          color: rgb(125, 211, 252);
          font-size: 0.64rem;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .progression-growth-summary-main strong {
          color: var(--text-primary);
          font-size: 0.82rem;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .progression-growth-summary-main small {
          color: var(--text-dim);
          font-size: 0.68rem;
        }

        .progression-growth-deltas {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.3rem;
          max-width: 160px;
        }

        .progression-growth-deltas em,
        .progression-growth-chip-list em {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0.18rem 0.42rem;
          border: 1px solid rgba(252, 211, 77, 0.24);
          border-radius: var(--radius-full);
          background: rgba(252, 211, 77, 0.1);
          color: rgb(253, 224, 71);
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 900;
          line-height: 1.2;
          text-align: center;
        }

        .progression-growth-body {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0 0.65rem 0.7rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .progression-growth-body p {
          margin: 0.65rem 0 0;
          color: var(--text-secondary);
          font-size: 0.75rem;
          line-height: 1.45;
        }

        .progression-growth-detail-block {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .progression-growth-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }

        .progression-growth-detail-block ul {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          margin: 0;
          padding-left: 1rem;
          color: var(--text-secondary);
          font-size: 0.73rem;
          line-height: 1.45;
        }

        .progression-growth-detail-block.evidence {
          padding: 0.55rem;
          border: 1px solid rgba(125, 211, 252, 0.15);
          border-radius: var(--radius-sm);
          background: rgba(14, 165, 233, 0.07);
        }

        .danger-text {
          color: var(--error) !important;
        }

        .modal.progression-edit-modal {
          width: min(1080px, calc(100vw - 2rem));
          max-width: min(1080px, calc(100vw - 2rem));
          max-height: min(90vh, 900px);
          display: flex;
          flex-direction: column;
        }

        .progression-edit-modal-body {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          overflow-y: auto;
          padding-right: 0.35rem;
        }

        .progression-custom-editor {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-card-editor-section {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-editor-section-title {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .progression-editor-section-title strong {
          color: var(--text-primary);
          font-size: 0.84rem;
        }

        .progression-editor-section-title span {
          color: var(--text-dim);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .progression-edit-card-grid,
        .progression-ability-card-editor-list,
        .progression-template-value-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .progression-profile-edit-card,
        .progression-ability-edit-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 0.7rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
        }

        .progression-profile-edit-card.wide {
          grid-column: 1 / -1;
        }

        .progression-profile-edit-card.color-rose,
        .progression-profile-edit-card.color-violet,
        .progression-profile-edit-card.color-cyan,
        .progression-profile-edit-card.color-amber,
        .progression-profile-edit-card.color-emerald,
        .progression-profile-edit-card.color-blue,
        .progression-profile-edit-card.color-fuchsia,
        .progression-profile-edit-card.color-lime,
        .progression-preset-card.color-rose,
        .progression-preset-card.color-violet,
        .progression-preset-card.color-cyan,
        .progression-preset-card.color-amber,
        .progression-preset-card.color-emerald,
        .progression-preset-card.color-blue,
        .progression-preset-card.color-fuchsia,
        .progression-preset-card.color-lime {
          border-color: color-mix(in srgb, var(--card-accent, rgb(244, 63, 94)) 30%, transparent);
          background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent, rgb(244, 63, 94)) 10%, transparent), rgba(255, 255, 255, 0.035));
        }

        .progression-profile-edit-card.color-violet { --card-accent: rgb(139, 92, 246); }
        .progression-profile-edit-card.color-cyan { --card-accent: rgb(6, 182, 212); }
        .progression-profile-edit-card.color-amber { --card-accent: rgb(245, 158, 11); }
        .progression-profile-edit-card.color-emerald { --card-accent: rgb(16, 185, 129); }
        .progression-profile-edit-card.color-blue { --card-accent: rgb(59, 130, 246); }
        .progression-profile-edit-card.color-fuchsia { --card-accent: rgb(217, 70, 239); }
        .progression-profile-edit-card.color-lime { --card-accent: rgb(132, 204, 22); }
        .progression-preset-card.color-violet { --card-accent: rgb(139, 92, 246); }
        .progression-preset-card.color-cyan { --card-accent: rgb(6, 182, 212); }
        .progression-preset-card.color-amber { --card-accent: rgb(245, 158, 11); }
        .progression-preset-card.color-emerald { --card-accent: rgb(16, 185, 129); }
        .progression-preset-card.color-blue { --card-accent: rgb(59, 130, 246); }
        .progression-preset-card.color-fuchsia { --card-accent: rgb(217, 70, 239); }
        .progression-preset-card.color-lime { --card-accent: rgb(132, 204, 22); }

        .progression-template-value-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .progression-template-value-fields label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .progression-template-value-fields small {
          color: var(--text-dim);
          font-size: 0.62rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .progression-profile-edit-card > .btn-icon-mini,
        .progression-ability-edit-card > .btn-icon-mini {
          position: absolute;
          top: 0.45rem;
          right: 0.45rem;
          width: 24px;
          height: 24px;
        }

        .progression-profile-edit-card span {
          padding-right: 1.8rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .progression-field-edit-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 30px;
          gap: 0.35rem;
          align-items: center;
        }

        .progression-add-field-row {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(112px, 0.65fr) minmax(0, 0.85fr) auto;
          gap: 0.45rem;
          align-items: center;
        }

        .progression-abilities-editor {
          min-height: 130px;
        }

        .progression-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .progression-ability,
        .progression-history-item {
          padding: 0.65rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.035);
        }

        .progression-ability div,
        .progression-history-item div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .progression-ability strong,
        .progression-history-item strong {
          color: var(--text-primary);
          font-size: 0.8rem;
        }

        .progression-ability span,
        .progression-history-item span {
          color: rgb(252, 211, 77);
          font-size: 0.72rem;
          font-weight: 900;
        }

        .progression-ability p,
        .progression-history-item p,
        .progression-history-item small {
          margin: 0.35rem 0 0;
          color: var(--text-secondary);
          font-size: 0.74rem;
          line-height: 1.45;
        }

        .progression-history-item small {
          display: block;
          color: var(--text-dim);
        }

        .progression-characters-modal {
          width: min(760px, calc(100vw - 2rem));
          max-height: min(88vh, 860px);
          display: flex;
          flex-direction: column;
        }

        .modal.progression-template-modal {
          width: min(1180px, calc(100vw - 2rem));
          max-width: min(1180px, calc(100vw - 2rem));
          height: min(92vh, 980px);
          max-height: calc(100vh - 2rem);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .progression-template-modal .modal-header {
          flex-shrink: 0;
          margin-bottom: 1rem;
        }

        .progression-template-modal-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-right: 0.35rem;
        }

        .progression-template-modal .modal-actions {
          flex-shrink: 0;
          margin-top: 0.9rem;
          padding-top: 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .progression-character-modal-list,
        .progression-template-builder-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          overflow-y: auto;
          padding-right: 0.15rem;
        }

        .progression-character-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .progression-character-row:hover,
        .progression-character-row.active {
          border-color: rgba(244, 63, 94, 0.42);
          background: rgba(244, 63, 94, 0.12);
        }

        .progression-character-row div {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
        }

        .progression-character-row strong {
          color: white;
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .progression-character-row span {
          color: var(--text-dim);
          font-size: 0.74rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .progression-character-row em {
          flex-shrink: 0;
          color: rgb(253, 224, 71);
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 900;
        }

        .progression-template-tool-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.7rem;
        }

        .progression-template-tool-row span {
          padding: 0.28rem 0.5rem;
          border: 1px solid rgba(99, 102, 241, 0.22);
          border-radius: var(--radius-full);
          background: rgba(99, 102, 241, 0.1);
          color: rgb(199, 210, 254);
          font-size: 0.7rem;
          font-weight: 900;
        }

        .progression-theme-library {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding: 0.75rem;
          margin-bottom: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-theme-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .theme-btn-premium {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.6rem;
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%);
          color: rgb(224, 231, 255);
          font-weight: 600;
          font-size: 0.75rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .theme-btn-premium:hover {
          transform: translateY(-1px);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.18) 100%);
          border-color: rgba(168, 85, 247, 0.5);
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);
        }

        .theme-btn-premium:active {
          transform: translateY(1px);
        }

        .progression-preset-library {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding: 0.75rem;
          margin-bottom: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-preset-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .progression-preset-card {
          --card-accent: rgb(244, 63, 94);
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-height: 64px;
          padding: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .progression-preset-card:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--card-accent) 58%, transparent);
        }

        .progression-preset-card strong {
          color: white;
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .progression-preset-card span {
          color: var(--text-dim);
          font-size: 0.66rem;
          line-height: 1.3;
        }

        .progression-cultivation-import-box {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem;
          margin-bottom: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.24);
          border-radius: var(--radius-md);
          background: linear-gradient(145deg, rgba(20, 184, 166, 0.11), rgba(255, 255, 255, 0.03));
        }

        .progression-cultivation-import-box .rotate {
          transform: rotate(180deg);
        }

        .progression-cultivation-import-body {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding-top: 0.2rem;
        }

        .progression-cultivation-actions {
          display: flex;
          justify-content: flex-start;
        }

        .progression-file-btn {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          flex-shrink: 0;
        }

        .progression-file-btn input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .progression-realm-import-textarea {
          min-height: 86px;
          max-height: 150px;
        }

        .progression-cultivation-import-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .progression-template-builder-card {
          --card-accent: rgb(244, 63, 94);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid color-mix(in srgb, var(--card-accent) 34%, transparent);
          border-radius: var(--radius-md);
          background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 12%, transparent), rgba(255, 255, 255, 0.035));
        }

        .progression-template-builder-card.dragging {
          opacity: 0.58;
          outline: 2px dashed color-mix(in srgb, var(--card-accent) 70%, white);
          outline-offset: 3px;
        }

        .progression-template-builder-card.disabled-card {
          opacity: 0.5;
          filter: grayscale(40%);
          border: 1px dashed color-mix(in srgb, var(--card-accent) 24%, transparent);
          background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 4%, transparent), rgba(255, 255, 255, 0.01));
        }

        .progression-template-drag-handle {
          grid-column: 1 / -1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          min-height: 30px;
          border: 1px dashed color-mix(in srgb, var(--card-accent) 40%, transparent);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
          color: color-mix(in srgb, var(--card-accent) 58%, white);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: grab;
          user-select: none;
        }

        .progression-template-drag-handle:active {
          cursor: grabbing;
        }

        .progression-template-builder-card label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .progression-template-fields-editor {
          grid-column: 1 / -1;
        }

        .progression-template-field-editor-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .progression-template-field-editor-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 30px;
          gap: 0.35rem;
          align-items: center;
        }

        .progression-add-field-inline {
          justify-content: center;
        }

        .progression-template-builder-card label span {
          color: var(--text-dim);
          font-size: 0.66rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-template-card-actions {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .progression-template-card-actions label {
          flex-direction: row;
          align-items: center;
          color: var(--text-secondary);
          font-size: 0.76rem;
          font-weight: 900;
        }

        .progression-template-card-actions input {
          accent-color: var(--primary);
        }

        .progression-template-add-row {
          display: flex;
          justify-content: flex-start;
          margin-top: 0.75rem;
        }

        .brain-detail-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 0.3rem;
          border-top: 1px solid var(--surface-border);
        }

        /* Brain Map Styles */
        .brain-panel {
          display: flex;
          flex-direction: column;
        }

        .brain-panel .ai-instructions {
          display: none;
        }

        .brain-entity-strip {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding: 0.15rem 0 0.55rem;
          flex-shrink: 0;
        }

        .brain-entity-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          max-width: 132px;
          padding: 0.38rem 0.48rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }

        .brain-entity-chip:hover {
          border-color: rgba(168, 85, 247, 0.35);
          color: var(--text-primary);
        }

        .brain-entity-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .brain-entity-chip strong {
          font-size: 0.66rem;
          color: var(--primary);
        }

        .brain-ask-panel {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 0.65rem;
          margin-bottom: 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          flex-shrink: 0;
        }

        .brain-ask-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .brain-ask-input {
          width: 100%;
          min-height: 58px;
          max-height: 96px;
          resize: vertical;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.78rem;
          line-height: 1.45;
          padding: 0.55rem;
          outline: none;
        }

        .brain-ask-input:focus {
          border-color: rgba(168, 85, 247, 0.4);
        }

        .brain-ask-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          height: 30px;
          border: 0;
          border-radius: var(--radius-sm);
          background: var(--primary);
          color: white;
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-ask-button:hover:not(:disabled) {
          background: var(--primary-hover);
        }

        .brain-ask-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .brain-ask-answer {
          max-height: 150px;
          overflow-y: auto;
          padding: 0.55rem;
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-secondary);
          font-size: 0.75rem;
          line-height: 1.45;
        }

        .brain-ask-answer.error {
          color: var(--danger);
          background: var(--danger-light);
        }

        .brain-ask-answer p,
        .brain-ask-answer ul {
          margin: 0 0 0.45rem;
        }

        .brain-type-filter {
          width: 100%;
          margin-bottom: 0.75rem;
          padding: 0.48rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.76rem;
          outline: none;
          flex-shrink: 0;
        }

        .brain-type-filter option,
        .brain-detail-select option {
          background: rgb(15, 15, 18);
          color: rgb(226, 232, 240);
        }

        .brain-panel .search-bar {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          width: 100%;
          padding: 0.48rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          flex-shrink: 0;
        }

        .brain-panel .search-input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .brain-panel .search-input::placeholder {
          color: var(--text-dim);
        }

        .brain-entries-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .brain-chapter-divider {
          display: none;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0;
          margin-top: 0.25rem;
        }

        .brain-chapter-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
          opacity: 0.7;
        }

        .brain-entry-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          min-height: 74px;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          transition: var(--transition);
          cursor: pointer;
          outline: none;
        }

        .brain-entry-card:hover,
        .brain-entry-card:focus-visible {
          border-color: rgba(168, 85, 247, 0.3);
          background: rgba(168, 85, 247, 0.05);
          transform: translateY(-1px);
        }

        .brain-entry-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          width: 100%;
        }

        .brain-entry-card-main {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-entry-meta-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          min-width: 0;
          flex-wrap: wrap;
        }

        .brain-chapter-badge,
        .brain-pending-badge,
        .brain-type-badge,
        .brain-importance-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          width: fit-content;
          border-radius: var(--radius-full);
          padding: 0.22rem 0.5rem;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .brain-type-badge {
          background: rgba(20, 184, 166, 0.11);
          color: rgb(94, 234, 212);
          border: 1px solid rgba(20, 184, 166, 0.2);
          cursor: pointer;
        }

        .brain-type-badge.type-character {
          background: rgba(59, 130, 246, 0.1);
          color: rgb(147, 197, 253);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .brain-type-badge.type-place {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .brain-type-badge.type-object {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(252, 211, 77);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .brain-type-badge.type-foreshadowing {
          background: rgba(168, 85, 247, 0.12);
          color: rgb(216, 180, 254);
          border-color: rgba(168, 85, 247, 0.22);
        }

        .brain-importance-badge {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-dim);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .brain-importance-badge.importance-major {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(252, 211, 77);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .brain-importance-badge.importance-critical {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(252, 165, 165);
          border-color: rgba(239, 68, 68, 0.22);
        }

        .brain-chapter-badge {
          background: var(--primary-light);
          color: var(--primary-hover);
          border: 1px solid rgba(99, 102, 241, 0.18);
        }

        .brain-pending-badge {
          background: var(--warning-light);
          color: var(--warning);
          border: 1px solid rgba(245, 158, 11, 0.18);
        }

        .brain-highlight-text {
          display: block;
          font-size: 0.78rem;
          font-weight: 600;
          color: rgb(192, 132, 252);
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brain-entity-name {
          display: block;
          max-width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.83rem;
          font-weight: 800;
          line-height: 1.2;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        .brain-entity-name:hover {
          color: rgb(216, 180, 254);
        }

        .brain-connection-count {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 700;
        }

        .brain-card-delete {
          flex-shrink: 0;
        }

        .brain-entry-summary {
          display: none;
          font-size: 0.73rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .brain-entry-summary p {
          margin: 0;
        }

        .brain-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.73rem;
          color: var(--text-dim);
          font-style: italic;
        }

        .brain-detail-modal {
          max-width: 560px;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .brain-detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .brain-detail-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .brain-detail-date {
          font-size: 0.75rem;
          color: var(--text-dim);
        }

        .brain-detail-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .brain-detail-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .brain-detail-controls label {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-detail-select {
          width: 100%;
          padding: 0.55rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.8rem;
          outline: none;
        }

        .brain-detail-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-dim);
        }

        .brain-detail-keyword,
        .brain-detail-summary {
          padding: 0.875rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.6;
          word-break: break-word;
        }

        .brain-detail-keyword {
          color: rgb(216, 180, 254);
          font-weight: 600;
        }

        .brain-detail-summary {
          max-height: 280px;
          overflow-y: auto;
        }

        .brain-detail-summary p {
          margin: 0;
        }

        .brain-detail-entity-link {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          width: fit-content;
          max-width: 100%;
          padding: 0.55rem 0.7rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-detail-entity-link:hover {
          border-color: rgba(168, 85, 247, 0.35);
        }

        .brain-connection-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-connection-item {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          padding: 0.62rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.12);
          color: var(--text-secondary);
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .brain-entity-modal {
          max-height: min(760px, 86vh);
        }

        .brain-entity-entry-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          max-height: 460px;
          overflow-y: auto;
        }

        .brain-entity-entry {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
          padding: 0.8rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-entity-entry:hover {
          border-color: rgba(168, 85, 247, 0.32);
          background: rgba(168, 85, 247, 0.05);
        }

        .brain-entity-entry-top {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .brain-entity-entry strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .brain-entity-entry p {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .bible-drawer {
          border-left: 1px solid var(--surface-border);
          background: rgba(12, 12, 18, 0.95) !important;
          z-index: 60 !important;
        }

        .drawer-save-badge {
          padding-top: 1rem;
          border-top: 1px solid var(--surface-border);
        }

        /* Ambient Sound Panel */
        .sound-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 1rem 0;
        }

        .sound-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0.75rem 1rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          text-align: left;
          transition: var(--transition);
          width: 100%;
        }

        .sound-card:hover {
          background: var(--surface-hover);
          border-color: var(--text-dim);
        }

        .sound-card.active {
          background: var(--primary-light);
          border-color: var(--primary);
          color: var(--primary-hover);
        }

        .sound-card.active .glow-icon {
          animation: pulse 2.5s infinite;
        }

        .sound-info {
          display: flex;
          flex-direction: column;
        }

        .sound-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .sound-card.active .sound-title {
          color: var(--primary-hover);
        }

        .sound-desc {
          font-size: 0.7rem;
          color: var(--text-dim);
        }

        .volume-control {
          margin: 1.5rem 0;
          padding: 1rem;
          background: rgba(0,0,0,0.15);
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
        }

        .volume-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .volume-slider {
          width: 100%;
          background: var(--surface-border);
          outline: none;
          height: 4px;
          border-radius: var(--radius-full);
          -webkit-appearance: none;
          cursor: pointer;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--primary);
          box-shadow: 0 0 5px var(--primary-glow);
          transition: transform 0.15s ease;
        }

        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .zen-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--surface-border);
        }

        /* Formatting Toolbar */
        .formatting-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
          width: fit-content;
          border: 1px solid var(--surface-border);
          z-index: 10;
        }

        .fmt-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .fmt-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .fmt-divider {
          width: 1px;
          height: 16px;
          background: var(--surface-border);
          margin: 0 4px;
        }

        .fmt-btn-action {
          display: flex;
          align-items: center;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: var(--primary-hover);
          padding: 0 10px;
          height: 28px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
        }

        .fmt-btn-action:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.25);
          border-color: var(--primary);
          color: var(--primary-hover);
          transform: translateY(-1px);
        }

        .fmt-btn-action.disabled,
        .fmt-btn-action:disabled {
          opacity: 0.35;
          cursor: default;
          transform: none;
        }

        .fmt-btn-brain {
          background: rgba(168, 85, 247, 0.15);
          border-color: rgba(168, 85, 247, 0.3);
          color: rgb(168, 85, 247);
        }
        .fmt-btn-brain:hover:not(:disabled) {
          background: rgba(168, 85, 247, 0.25);
          border-color: rgb(168, 85, 247);
          color: rgb(192, 132, 252);
        }

        /* Autocomplete suggestions panel styles */
        .autocomplete-panel {
          position: absolute;
          top: 8px;
          right: 20px;
          width: 260px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-lg), 0 0 25px -5px var(--primary-glow);
          z-index: 50;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .autocomplete-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--surface-border);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .autocomplete-close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }
        .autocomplete-close-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .autocomplete-list {
          display: flex;
          flex-direction: column;
          padding: 4px;
        }

        .autocomplete-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .autocomplete-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .autocomplete-item.selected {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .tab-hint {
          font-size: 0.65rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-dim);
        }

        @keyframes slideInDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Command Palette Slash Menu styles */
        .command-palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 4, 6, 0.4);
          z-index: 300;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
          backdrop-filter: blur(4px);
        }

        .command-palette {
          width: 500px;
          max-width: 90%;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          background: rgba(15, 17, 23, 0.95);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px -10px var(--primary-glow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideDownPalette 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideDownPalette {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .palette-header {
          display: flex;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
          gap: 0.75rem;
        }

        .glow-icon {
          color: var(--primary-hover);
          filter: drop-shadow(0 0 4px var(--primary-glow));
        }

        .palette-header input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
        }

        .esc-hint {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius-xs);
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          color: var(--text-dim);
        }

        .palette-results {
          max-height: 300px;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .global-search-modal {
          width: min(680px, 92vw);
          max-height: 78vh;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          background: var(--surface-raised);
          box-shadow: var(--shadow-xl);
          overflow: hidden;
        }

        .global-search-results {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 58vh;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .global-search-empty {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          color: var(--text-dim);
          font-size: 0.85rem;
        }

        .global-search-result {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.2rem 0.75rem;
          width: 100%;
          padding: 0.85rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .global-search-result:hover {
          border-color: rgba(99, 102, 241, 0.35);
          background: var(--primary-light);
        }

        .global-result-source {
          grid-row: span 3;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          height: fit-content;
          padding: 0.24rem 0.42rem;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.06);
          color: var(--primary);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .global-search-result strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .global-search-result small {
          color: var(--text-dim);
          font-size: 0.72rem;
          text-transform: capitalize;
        }

        .global-search-result p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .palette-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
        }

        .palette-item.selected {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .palette-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .palette-cmd {
          font-family: var(--font-mono), monospace;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--accent);
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(167, 139, 250, 0.1);
        }

        .palette-item.selected .palette-cmd {
          background: rgba(167, 139, 250, 0.2);
        }

        .palette-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .palette-desc {
          font-size: 0.75rem;
          color: var(--text-dim);
        }

        .empty-palette {
          padding: 2rem;
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-dim);
        }

        /* AI Assistant Sidebar CSS */
        .editor-ai-sidebar {
          width: 340px;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--surface-border);
          background: var(--surface-raised);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          flex-shrink: 0;
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .ai-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.25rem 0.75rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
        }

        .ai-header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-outfit);
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .ai-header-title .sparkles-icon {
          color: var(--accent);
          animation: pulse 2s infinite;
        }

        .btn-close-ai {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-close-ai:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .ai-tabs {
          display: flex;
          padding: 0.25rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.1);
        }

        .ai-tab-btn {
          flex: 1;
          padding: 0.6rem 0.25rem;
          border: none;
          background: transparent;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: var(--transition);
          text-align: center;
        }

        .ai-tab-btn:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .ai-tab-btn.active {
          color: var(--primary-hover);
          background: var(--primary-light);
        }

        .ai-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .ai-tab-pane {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ai-instructions {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .btn-ai-action {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          border: none;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow-glow);
        }

        .btn-ai-action:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px -3px var(--primary-glow);
        }

        .btn-ai-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-selection-preview {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .selection-quote-box {
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.15);
          border-left: 3px solid var(--accent);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-style: italic;
          color: var(--text-secondary);
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
        }

        .ai-no-selection {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--primary-light);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .ai-form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ai-form-field label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ai-select {
          width: 100%;
          height: 38px;
          padding: 0 0.5rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }

        .ai-select option {
          background: var(--background);
          color: var(--text-primary);
        }

        .ai-input {
          width: 100%;
          height: 36px;
          padding: 0 0.55rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.82rem;
          outline: none;
        }

        .ai-input:focus {
          border-color: var(--primary);
        }

        .ai-textarea {
          width: 100%;
          height: 100px;
          padding: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          resize: none;
          line-height: 1.5;
        }

        .ai-textarea:focus {
          border-color: var(--primary);
        }

        .ai-textarea.compact {
          height: 82px;
          min-height: 82px;
        }

        .ai-error-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--error-light);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          color: #fca5a5;
        }

        .ai-response-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 1rem;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
        }

        .copied-label {
          color: var(--success);
          font-weight: 700;
          font-size: 0.7rem;
        }

        .response-content {
          font-size: 0.85rem;
          color: var(--text-primary);
          line-height: 1.6;
          max-height: 250px;
          overflow-y: auto;
          white-space: pre-wrap;
          padding: 0.25rem 0;
        }

        .markdown-preview-ai {
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .markdown-preview-ai h1, .markdown-preview-ai h2, .markdown-preview-ai h3 {
          font-family: var(--font-outfit);
          color: var(--text-primary);
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .markdown-preview-ai h1 { font-size: 1.1rem; }
        .markdown-preview-ai h2 { font-size: 0.95rem; }
        .markdown-preview-ai h3 { font-size: 0.85rem; }
        
        .markdown-preview-ai ul, .markdown-preview-ai ol {
          padding-left: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .response-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.25rem;
          border-top: 1px solid var(--surface-border);
          padding-top: 0.75rem;
        }

        .btn-ai-sub {
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          transition: var(--transition);
        }

        .btn-ai-primary {
          background: var(--primary);
          color: white;
        }

        .btn-ai-primary:hover {
          background: var(--primary-hover);
        }

        .btn-ai-secondary {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
        }

        .btn-ai-secondary:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .analytics-panel {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          padding-bottom: 2rem;
        }

        .analytics-streak-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .streak-card {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 0.55rem;
        }

        .streak-badge {
          font-size: 1.3rem;
          line-height: 1;
        }

        .streak-card div {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .streak-card strong {
          color: var(--text-primary);
          font-size: 0.85rem;
          font-weight: 800;
        }

        .streak-card span {
          color: var(--text-dim);
          font-size: 0.65rem;
          font-weight: 600;
        }

        .analytics-goal-card {
          padding: 0.8rem;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--surface-border);
        }

        .goal-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.65rem;
          gap: 0.5rem;
        }

        .goal-card-header h4 {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-primary);
          font-weight: 800;
        }

        .goal-input-wrapper {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .goal-input-wrapper input {
          width: 3.5rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--surface-border);
          border-radius: 4px;
          color: #fff;
          font-size: 0.75rem;
          padding: 0.15rem 0.25rem;
          text-align: right;
        }

        .goal-input-wrapper span {
          font-size: 0.68rem;
          color: var(--text-dim);
        }

        .goal-progress-section {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .goal-progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          overflow: hidden;
        }

        .goal-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary, #6366f1) 0%, #a855f7 100%);
          border-radius: 3px;
        }

        .goal-progress-labels {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--text-dim);
        }

        .analytics-section {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .analytics-section h5 {
          margin: 0;
          font-size: 0.72rem;
          color: var(--text-dim);
          text-transform: uppercase;
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        .contribution-grid-container {
          width: 100%;
          overflow-x: auto;
          padding: 0.25rem 0;
          background: rgba(0, 0, 0, 0.12);
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          display: flex;
          justify-content: center;
        }

        .contribution-grid {
          display: flex;
          gap: 3px;
          padding: 0.5rem;
        }

        .contribution-column {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .contribution-square {
          width: 9px;
          height: 9px;
          border-radius: 1.5px;
          transition: all 0.15s ease;
        }

        .contribution-square.level-0 {
          background: rgba(255, 255, 255, 0.035);
        }

        .contribution-square.level-1 {
          background: rgba(99, 102, 241, 0.25);
        }

        .contribution-square.level-2 {
          background: rgba(99, 102, 241, 0.5);
        }

        .contribution-square.level-3 {
          background: rgba(99, 102, 241, 0.75);
        }

        .contribution-square.level-4 {
          background: rgba(99, 102, 241, 1);
          box-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
        }

        .contribution-legend {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.65rem;
          color: var(--text-dim);
          align-self: flex-end;
          margin-top: -0.25rem;
        }

        .legend-squares {
          display: flex;
          gap: 2px;
        }

        .sprint-history-empty {
          padding: 0.8rem;
          text-align: center;
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.01);
        }

        .sprint-history-empty p {
          margin: 0;
          font-size: 0.76rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .sprint-history-empty small {
          font-size: 0.68rem;
          color: var(--text-dim);
          display: block;
          margin-top: 0.25rem;
          line-height: 1.4;
        }

        .sprint-history-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .sprint-history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 0.5rem 0.65rem;
          gap: 0.5rem;
        }

        .sprint-history-item div {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .sprint-history-item strong {
          color: var(--text-primary);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .sprint-history-item span {
          color: var(--text-dim);
          font-size: 0.68rem;
        }

        .sprint-history-item small {
          color: var(--text-dim);
          font-size: 0.65rem;
          text-align: right;
          flex-shrink: 0;
        }

        .milestones-analytics-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .milestone-analytics-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 0.5rem 0.65rem;
          opacity: 0.5;
          transition: all 0.2s ease;
        }

        .milestone-analytics-item.unlocked {
          opacity: 1;
          border-color: rgba(99, 102, 241, 0.35);
          background: rgba(99, 102, 241, 0.03);
        }

        .milestone-item-badge {
          font-size: 1.3rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .milestone-item-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .milestone-item-details strong {
          color: var(--text-primary);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .milestone-item-details p {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.68rem;
        }

        .milestone-status {
          font-size: 0.65rem;
          font-weight: 900;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }

        .milestone-status.unlocked {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
        }

        .milestone-status.locked {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-dim);
        }

        @media (max-width: 1024px) {
          .modal.progression-edit-modal {
            width: min(900px, calc(100vw - 1.25rem));
            max-width: min(900px, calc(100vw - 1.25rem));
          }
          .modal.progression-template-modal {
            width: calc(100vw - 1rem);
            max-width: calc(100vw - 1rem);
            height: calc(100vh - 1rem);
            max-height: calc(100vh - 1rem);
            padding: 1.25rem;
          }
          .progression-edit-card-grid,
          .progression-ability-card-editor-list,
          .progression-template-value-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .progression-theme-grid,
          .progression-preset-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .editor-ai-sidebar {
            width: 100%;
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            z-index: 100;
          }
        }

        .export-progress {
          margin: 1.5rem 0;
        }

        .export-format-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
          margin: 1rem 0;
        }

        .export-format {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.2rem 0.5rem;
          align-items: center;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .export-format:hover,
        .export-format.active {
          border-color: var(--primary);
          background: var(--primary-light);
        }

        .export-format strong {
          color: var(--text-primary);
          font-size: 0.84rem;
        }

        .export-format span {
          grid-column: 2;
          color: var(--text-dim);
          font-size: 0.7rem;
        }

        .versions-modal {
          max-width: 640px;
          transition: max-width 0.2s ease;
        }

        .versions-modal.diff-mode {
          max-width: 960px;
          width: 92vw;
        }

        .diff-split-pane {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          height: 52vh;
          min-height: 380px;
          overflow: hidden;
          margin: 0.8rem 0;
        }

        .diff-pane-column {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
        }

        .diff-pane-column h4 {
          margin: 0 0 0.45rem 0;
          font-size: 0.75rem;
          color: var(--text-dim);
          text-transform: uppercase;
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        .diff-pane-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          background: #09090f;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 0.5rem 0;
        }

        .diff-line-row {
          display: flex;
          min-height: 1.3rem;
          align-items: flex-start;
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          line-height: 1.35;
          padding: 0.05rem 0;
        }

        .diff-line-number {
          width: 2.5rem;
          text-align: right;
          padding-right: 0.5rem;
          color: rgba(255, 255, 255, 0.2);
          user-select: none;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          margin-right: 0.5rem;
          font-size: 0.7rem;
        }

        .diff-line-content {
          margin: 0;
          padding: 0;
          white-space: pre-wrap;
          word-break: break-all;
          color: #cdd6f4;
          font-family: inherit;
          font-size: inherit;
          flex: 1;
        }

        .diff-line-row.line-added {
          background: rgba(46, 160, 67, 0.12);
          border-left: 2px solid #2ea043;
        }

        .diff-line-row.line-added .diff-line-content {
          color: #aff5b4;
        }

        .diff-line-row.line-removed {
          background: rgba(248, 81, 73, 0.12);
          border-left: 2px solid #f85149;
        }

        .diff-line-row.line-removed .diff-line-content {
          color: #ffd8d6;
        }

        .diff-line-row.line-empty {
          background: rgba(255, 255, 255, 0.005);
          opacity: 0.25;
        }

        .version-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          max-height: 48vh;
          overflow-y: auto;
        }

        .version-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .version-item div {
          min-width: 0;
        }

        .version-item strong,
        .version-item span {
          display: block;
        }

        .version-item strong {
          color: var(--text-primary);
          font-size: 0.86rem;
        }

        .version-item span {
          color: var(--text-dim);
          font-size: 0.72rem;
          margin-top: 0.2rem;
        }

        .version-item p {
          margin: 0.5rem 0 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .progress-bar {
          height: 8px;
          background: var(--surface);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--accent));
          transition: width 0.3s ease;
        }

        .btn-delete-chapter:hover {
          background: var(--error-light);
          color: var(--error);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow-y: auto;
          padding: 2rem 1rem;
          z-index: 100;
        }

        .modal {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .modal-header {
          margin-bottom: 1.5rem;
        }

        .modal-title {
          font-family: var(--font-outfit);
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .modal-description {
          color: var(--text-dim);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-danger {
          background: var(--error);
          color: white;
          border: none;
        }

        .btn-danger:hover {
          background: var(--error-hover);
        }

        .editor-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--background);
        }

        .editor-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0.75rem 1.5rem 1rem 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          overflow: hidden;
          transition: max-width 0.5s ease, padding 0.5s ease;
        }

        /* Zen mode overrides */
        .zen-mode .editor-workspace {
          max-width: 800px;
          padding: 1.5rem 1rem;
        }

        .editor-title-input {
          width: 100%;
          background: transparent;
          border: none;
          font-family: var(--font-outfit);
          font-size: 2.25rem;
          font-weight: 800;
          color: var(--text-primary);
          outline: none;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
          padding: 0;
          transition: font-size 0.5s ease;
        }

        .zen-mode .editor-title-input {
          font-size: 2rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .editor-title-input::placeholder {
          color: var(--text-dim);
        }

        .editor-title-input.readonly {
          cursor: default;
        }

        .editor-title-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .badge-info {
          background: linear-gradient(135deg, var(--primary-light), var(--accent-light));
          color: var(--primary);
        }

        .editor-content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        .textarea-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .editor-textarea {
          flex: 1;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          line-height: 1.55;
          resize: none;
          outline: none;
          font-family: Georgia, serif;
          min-height: 0;
          position: relative;
          z-index: 1;
        }

        .zen-mode .editor-textarea {
          max-width: 700px;
          margin: 0 auto;
        }

        .editor-textarea::placeholder {
          color: var(--text-dim);
        }

        .markdown-preview {
          flex: 1;
          padding: 1.5rem;
          background: rgba(0,0,0,0.15);
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          line-height: 1.55;
          color: var(--text-secondary);
          overflow-y: auto;
        }

        .editor-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0;
          flex-shrink: 0;
          border-top: 1px solid var(--surface-border);
          gap: 0.5rem;
          background: var(--background);
        }

        .status-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .word-count {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-dim);
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .word-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .word-progress-bar {
          width: 80px;
          height: 4px;
          background: var(--surface);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .word-progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .word-progress-text {
          font-size: 0.75rem;
          color: var(--text-dim);
          min-width: 35px;
        }

        .status-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-goal-btn {
          background: transparent;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.75rem;
          padding: 3px 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .status-goal-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--surface-hover);
        }

        .status-timer-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .timer-display {
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        .timer-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          border-left: 1px solid var(--surface-border);
          padding-left: 8px;
        }

        .timer-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .timer-btn:hover {
          color: var(--primary);
          background: var(--surface-hover);
        }

        .btn-icon.active {
          background: var(--primary-light);
          color: var(--primary);
          border-color: var(--primary);
        }

        .textarea-wrapper.typewriter {
          position: relative;
        }

        .textarea-wrapper.typewriter::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 38%;
          background: linear-gradient(to bottom, var(--background) 25%, var(--background-transparent) 100%);
          pointer-events: none;
          z-index: 10;
        }

        .textarea-wrapper.typewriter .editor-textarea {
          scroll-padding-top: 50%;
          scroll-padding-bottom: 0px;
        }

        .focus-mode .editor-sidebar {
          display: none;
        }

        .focus-mode .editor-workspace {
          max-width: 900px;
          padding: 1rem 1.5rem;
        }

        @media (max-width: 768px) {
          .editor-container {
            height: 100dvh;
            display: flex;
            flex-direction: column;
          }
          .editor-body {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
          }
          .editor-sidebar {
            display: none;
          }
          .editor-activity-bar {
            display: none;
          }
          .editor-workspace {
            padding: 1.5rem;
            overflow: visible;
            flex: none;
          }
          .header-center {
            display: none;
          }
          .editor-title-input {
            font-size: 1.5rem;
          }
          .editor-textarea {
            min-height: calc(100dvh - 200px);
          }
          .header-right {
            gap: 0.35rem;
          }
          .last-saved-label {
            display: none;
          }
          .global-search-result {
            grid-template-columns: 1fr;
          }
          .global-result-source {
            grid-row: auto;
            width: fit-content;
          }
          .export-format-grid,
          .brain-detail-controls {
            grid-template-columns: 1fr;
          }
          .progression-library-actions,
          .progression-template-builder-card,
          .progression-add-field-row,
          .progression-edit-card-grid,
          .progression-ability-card-editor-list,
          .progression-template-value-grid,
          .progression-template-field-list,
          .progression-template-value-fields,
          .progression-template-field-editor-list {
            grid-template-columns: 1fr;
          }
          .progression-showcase-head,
          .progression-character-row,
          .progression-cultivation-import-footer {
            flex-direction: column;
            align-items: stretch;
          }
          .version-item {
            flex-direction: column;
          }
          .mobile-fab {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 100;
          }
          .fab-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--primary);
            border: none;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-lg), var(--shadow-glow);
            cursor: pointer;
            transition: var(--transition);
          }
          .fab-btn:hover {
            background: var(--primary-hover);
            transform: scale(1.05);
          }
          .fab-btn:active {
            transform: scale(0.95);
          }
          .fab-list {
            background: var(--surface-raised);
          }
          .chapter-drawer-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 200;
            display: flex;
            align-items: flex-end;
          }
          .chapter-drawer {
            background: var(--surface);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            width: 100%;
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.3s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--surface-border);
          }
          .drawer-header h3 {
            font-size: 1.1rem;
            font-weight: 700;
          }
          .drawer-header button {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.5rem;
          }
          .drawer-search {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.5rem;
            border-bottom: 1px solid var(--surface-border);
            color: var(--text-dim);
          }
          .drawer-search input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 0.95rem;
            outline: none;
          }
          .drawer-search input::placeholder {
            color: var(--text-dim);
          }
          .drawer-chapters {
            flex: 1;
            overflow-y: auto;
            padding: 1rem 1.5rem;
          }
          .drawer-chapters .chapter-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: var(--transition);
            color: var(--text-secondary);
          }
          .drawer-chapters .chapter-item:hover {
            background: var(--surface-hover);
          }
          .drawer-chapters .chapter-item.active {
            background: var(--primary-light);
            color: var(--primary);
          }
          .drawer-chapters .chapter-title {
            font-size: 0.95rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .empty-chapters {
            text-align: center;
            padding: 2rem;
            color: var(--text-dim);
          }
        }

        /* Focus Sprint Timer Styles */
        .focus-sprint-section {
          margin-top: 1.5rem;
          padding: 1.25rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--surface-border);
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .sprint-timer-display {
          font-family: monospace;
          font-size: 2.25rem;
          font-weight: 700;
          text-align: center;
          color: var(--primary);
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
          letter-spacing: 0.05em;
          padding: 0.5rem 0;
        }

        .timer-progress-container {
          background: rgba(255, 255, 255, 0.05);
          height: 6px;
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }

        .timer-progress-bar {
          background: linear-gradient(90deg, var(--primary), var(--accent));
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .sprint-stats {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .timer-presets {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 4px;
        }

        .preset-btn {
          padding: 6px 0;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .preset-btn:hover:not(:disabled) {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .preset-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .preset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .timer-controls {
          display: flex;
          gap: 8px;
        }

        /* Daily Progress Heatmap Styles */
        .heatmap-section {
          margin-top: 1.5rem;
          border-top: 1px solid var(--surface-border);
          padding-top: 1.5rem;
        }

        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          margin-top: 0.75rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.01);
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
        }

        .heatmap-cell {
          aspect-ratio: 1;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          transition: var(--transition);
          cursor: pointer;
          position: relative;
        }

        .heatmap-cell:hover {
          transform: scale(1.15);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
          z-index: 10;
        }

        .heatmap-cell.intensity-0 {
          background: rgba(255, 255, 255, 0.04);
        }

        .heatmap-cell.intensity-1 {
          background: rgba(99, 102, 241, 0.25);
          border: 1px solid rgba(99, 102, 241, 0.4);
        }

        .heatmap-cell.intensity-2 {
          background: rgba(99, 102, 241, 0.5);
          border: 1px solid rgba(99, 102, 241, 0.6);
        }

        .heatmap-cell.intensity-3 {
          background: rgba(99, 102, 241, 0.75);
          border: 1px solid rgba(99, 102, 241, 0.85);
        }

        .heatmap-cell.intensity-4 {
          background: var(--primary);
          border: 1px solid var(--primary);
          box-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
        }

        .heatmap-legend {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          font-size: 0.7rem;
          color: var(--text-dim);
          margin-top: 6px;
        }

        .heatmap-legend .heatmap-cell {
          width: 8px;
          height: 8px;
          cursor: default;
        }

        .heatmap-legend .heatmap-cell:hover {
          transform: none;
        }

        /* Cultivation Milestones Styles */
        .milestones-section {
          margin-top: 1.5rem;
          border-top: 1px solid var(--surface-border);
          padding-top: 1.5rem;
        }

        .milestones-progress-text {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 600;
        }

        .milestones-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 0.75rem;
        }

        .milestone-card {
          display: flex;
          gap: 12px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          transition: var(--transition);
        }

        .milestone-card.unlocked {
          background: rgba(99, 102, 241, 0.03);
          border-color: rgba(99, 102, 241, 0.15);
        }

        .milestone-card.locked {
          opacity: 0.6;
          background: rgba(255, 255, 255, 0.01);
        }

        .milestone-badge-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.04);
          font-size: 1.25rem;
        }

        .milestone-card.unlocked .milestone-badge-container {
          background: rgba(99, 102, 241, 0.1);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.15);
        }

        .lock-icon {
          position: absolute;
          bottom: -2px;
          right: -2px;
          font-size: 0.65rem;
          background: var(--surface);
          border-radius: 50%;
          padding: 2px;
        }

        .milestone-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .milestone-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .milestone-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .milestone-card.unlocked .milestone-title {
          color: var(--primary);
        }

        .milestone-req {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-dim);
        }

        .milestone-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.25;
        }

        .milestone-progress-bar-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }

        .milestone-progress-bar {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
        }

        .milestone-progress-bar::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: var(--text-dim);
          width: 100%;
          transform-origin: left;
          transform: scaleX(0);
        }

        /* Overlay Modals for Sprints & Milestones */
        .sprint-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.25s ease;
        }

        .sprint-modal-content {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 2rem;
          width: 90%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-shadow: var(--shadow-lg), 0 0 30px rgba(99, 102, 241, 0.15);
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .sprint-modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
        }

        .sprint-modal-icon {
          font-size: 3rem;
        }

        .sprint-modal-header h3 {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--text-primary), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .sprint-modal-body {
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .sprint-stats-summary {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin: 1.25rem 0;
        }

        .stat-box {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--surface-border);
          padding: 1rem;
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-val {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }

        .stat-lbl {
          font-size: 0.75rem;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 4px;
        }

        .sprint-modal-quote {
          font-style: italic;
          font-size: 0.85rem;
          color: var(--text-dim);
          margin-top: 0.5rem;
        }

        .sprint-modal-actions {
          display: flex;
          justify-content: center;
        }

        .milestone-overlay {
          background: rgba(0, 0, 0, 0.8);
        }

        .milestone-content {
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.3);
        }

        .pulse-glow {
          position: relative;
        }

        .pulse-glow::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: calc(var(--radius-lg) + 2px);
          z-index: -1;
          opacity: 0.6;
          animation: pulseGlow 2s infinite alternate;
        }

        @keyframes pulseGlow {
          from { filter: blur(4px); opacity: 0.4; }
          to { filter: blur(12px); opacity: 0.8; }
        }

        .milestone-achieved-title {
          background: linear-gradient(135deg, var(--primary), var(--accent)) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
        }

        .milestone-unlocked-rank {
          font-size: 1.85rem;
          font-weight: 900;
          color: var(--text-primary);
          margin: 0.5rem 0;
          letter-spacing: 0.02em;
          text-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
        }

        .milestone-unlock-subtitle {
          font-size: 0.85rem;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .milestone-unlock-desc {
          font-size: 0.95rem;
          font-style: italic;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .milestone-unlocked-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          margin-top: 0.5rem;
        }

        .milestone-unlocked-details strong {
          color: var(--primary);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <Feather size={24} />
          </div>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <style jsx>{`
          .loading-screen {
            height: 100vh;
            background: var(--background);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
          }
          .loading-logo {
            width: 56px;
            height: 56px;
            border-radius: var(--radius-lg);
            background: linear-gradient(135deg, var(--primary), var(--accent));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
        `}</style>
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}
