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
  Download, Save, BookOpen, Send,
  Play, Pause, RotateCcw,
  Sparkles, Wand2, Copy, Clipboard, BarChart3,
  Book, Volume2, VolumeX, Headphones,
  Bold, Italic, Strikethrough, Heading1, Heading2, Quote, Code, List, ChevronLeft, ChevronRight, ChevronDown,
  User, PawPrint, MapPin, Globe, Package, BrainCircuit, Link2, MessageSquare, Star, History, FileDown, Layers, TrendingUp, GripVertical,
  Network, ShieldAlert, AlertTriangle, CheckCircle2, Bookmark, Image as ImageIcon
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
  saveArcSeedsLocal,
  getArcSeedsLocal,
  saveChapterVersionsLocal,
  getChapterVersionsLocal,
  saveExportHistoryLocal,
  getExportHistoryLocal
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
  syncArcSeedsWithCloud,
  saveArcSeedToCloud,
  deleteArcSeedFromCloud,
  syncProgressionProfilesWithCloud,
  saveProgressionProfileToCloud,
  syncProgressionSystemWithCloud,
  saveProgressionSystemToCloud,
  BibleEntry,
  BrainEntry,
  ArcSeed,
  ArcSeedStatus,
  Project,
  saveProjectToCloud
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
type SidebarTab = 'manuscript' | 'insights' | 'appearance' | 'progression' | 'bible' | 'names' | 'sounds' | 'brain' | 'arcs' | 'analytics'
type BrainEntityType = NonNullable<BrainEntry['entityType']>
type BrainImportance = NonNullable<BrainEntry['importance']>
type BrainTypeFilter = 'all' | BrainEntityType
type ExportFormat = 'folder' | 'txt' | 'md' | 'html' | 'doc' | 'pdf' | 'epub'
type SearchSource = 'chapter' | 'brain' | 'arc' | 'lore'

type ProgressionStatKey = 'strength' | 'agility' | 'endurance' | 'vitality' | 'intelligence' | 'sense' | 'mana'
type NameForgePicker = 'category' | 'style' | 'style2' | 'structure' | 'tone' | 'gender'

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

interface BibleTimelineFact {
  id: string
  chapterId: string
  chapterTitle: string
  chapterNumber?: number | null
  summary: string
  evidence?: string
  status?: string
  createdAt: number
}

interface BibleCanonConflict {
  entryName: string
  severity: "warning" | "critical"
  message: string
  chapterEvidence?: string
  bibleEvidence?: string
  suggestedFix?: string
}

interface TimelineIssue {
  type: "power_regression" | "missing_progression" | "contradictory_state" | "premature_appearance" | "ignored_plot_point"
  characterName: string
  severity: "warning" | "critical"
  message: string
  chaptersInvolved: string[]
  suggestion: string
}

interface BibleExtractionSuggestion {
  entryName: string
  category: BibleEntry["category"]
  summary: string
  contentPatch: string
  matchedEntryId?: string
  characterDetails?: {
    appearance?: string
    attire?: string
    hair?: string
    eyes?: string
    body?: string
    distinguishingFeatures?: string
    chapterAppearance?: {
      summary?: string
      evidence?: string
      appearance?: string
      attire?: string
      hair?: string
      eyes?: string
      body?: string
      distinguishingFeatures?: string
    }
  }
  timelineFact?: {
    summary: string
    evidence?: string
    status?: string
  }
}

interface ExportHistoryRecord {
  filename: string
  fingerprint: string
  exportedAt: number
}

interface AppearancePromptResult {
  characterName?: string
  overview?: string
  prompts?: Record<string, string>
  consistencyNotes?: string[]
  negativePrompt?: string
  negativePrompts?: Record<string, string>
  characterDetails?: {
    appearance?: string
    hair?: string
    eyes?: string
    body?: string
    attire?: string
    distinguishingFeatures?: string
  }
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
type ProgressionJsonTemplateFieldKind = 'text' | 'number' | 'boolean' | 'list' | 'object'

interface ProgressionTemplateCard {
  id: string
  label: string
  type: ProgressionTemplateCardType
  sourceKey: string
  fields: string[]
  color: string
  enabled: boolean
  repeatable?: boolean
}

interface GeneratedNameOption {
  name: string
  category: BibleEntry["category"]
  style: string
  raceOrOrigin: string
  structure: string
  meaning: string
  pronunciation: string
  vibe: string
  bibleContent: string
}

const NAME_CATEGORY_OPTIONS: Array<{ value: BibleEntry["category"]; label: string; hint: string }> = [
  { value: "character", label: "Character", hint: "People, rivals, allies" },
  { value: "beast", label: "Beast", hint: "Monsters and creatures" },
  { value: "world", label: "Faction / World", hint: "Sects, clans, powers" },
  { value: "place", label: "Place", hint: "Cities, realms, ruins" },
  { value: "item", label: "Artifact / Item", hint: "Weapons, relics, objects" }
]

const NAME_STYLE_OPTIONS = [
  { value: "fantasy", label: "Wild Fantasy", hint: "Flexible invented names" },
  { value: "chinese", label: "Chinese Inspired", hint: "Cultivation-friendly" },
  { value: "japanese", label: "Japanese Inspired", hint: "Elegant and sharp" },
  { value: "korean", label: "Korean Inspired", hint: "Clean fantasy tone" },
  { value: "elven", label: "Elven", hint: "Lyrical and ancient" },
  { value: "demonic", label: "Demonic", hint: "Dark and severe" },
  { value: "beast", label: "Beast / Monster", hint: "Feral creature names" },
  { value: "cultivation", label: "Cultivation Sect", hint: "Sects and realms" },
  { value: "noble", label: "Noble House", hint: "Aristocratic names" },
  { value: "divine", label: "Divine / Celestial", hint: "Holy and mythic" },
  { value: "grimdark", label: "Grimdark", hint: "Harsh and grounded" },
  { value: "invented", label: "Fully Invented", hint: "No real-world anchor" },
  { value: "viking", label: "Viking / Norse", hint: "Sagas and fjords" },
  { value: "slavic", label: "Slavic", hint: "Eastern fairy-tale tone" },
  { value: "celtic", label: "Celtic", hint: "Misty druidic names" },
  { value: "egyptian", label: "Egyptian", hint: "Sands of antiquity" },
  { value: "mesoamerican", label: "Mesoamerican", hint: "Jungle-empire feel" },
  { value: "arabian", label: "Arabian / Persian", hint: "Silk-road mystique" },
  { value: "hindi", label: "Indian / Hindi", hint: "Epic mythology weight" },
  { value: "greek", label: "Greco-Roman", hint: "Classical mythic names" },
  { value: "steampunk", label: "Steampunk", hint: "Gears, brass, fog" },
  { value: "cyberpunk", label: "Cyberpunk", hint: "Neon-drenched future" },
  { value: "celestial", label: "Celestial Body", hint: "Stars, moons, cosmic" },
  { value: "elemental", label: "Elemental", hint: "Fire, water, stone, storm" },
  { value: "fey", label: "Fey / Faerie", hint: "Whimsical and tricksy" },
  { value: "undead", label: "Undead / Lich", hint: "Barrow-cold and haunting" },
  { value: "dwarf", label: "Dwarven", hint: "Stone and forge" },
  { value: "void", label: "Void / Abyss", hint: "Eldritch and alien" }
]

const NAME_STRUCTURE_OPTIONS = [
  { value: "any", label: "Any Structure", hint: "Let the forge decide" },
  { value: "single", label: "Single Name", hint: "One-word names" },
  { value: "double", label: "First + Last", hint: "Two-part names" },
  { value: "triple", label: "First + Middle + Last", hint: "Three-part names" },
  { value: "clan", label: "Clan / House Name", hint: "Family or group names" },
  { value: "title", label: "Title Name", hint: "The-style names" },
  { value: "epithet", label: "Name + Epithet", hint: "Name with a legend" }
]

const NAME_TONE_OPTIONS = [
  { value: "memorable", label: "Memorable", hint: "Strong first impression" },
  { value: "elegant", label: "Elegant", hint: "Graceful and refined" },
  { value: "sinister", label: "Sinister", hint: "Dangerous undertone" },
  { value: "ancient", label: "Ancient", hint: "Old-world weight" },
  { value: "heroic", label: "Heroic", hint: "Bright and bold" },
  { value: "mysterious", label: "Mysterious", hint: "Secretive aura" },
  { value: "feral", label: "Feral", hint: "Wild and predatory" },
  { value: "royal", label: "Royal", hint: "Noble authority" }
]

const NAME_GENDER_OPTIONS = [
  { value: "any", label: "Any", hint: "No preference" },
  { value: "masculine", label: "Masculine", hint: "Male-leaning names" },
  { value: "feminine", label: "Feminine", hint: "Female-leaning names" },
  { value: "neutral", label: "Neutral", hint: "Androgynous / unisex" }
]

const CATEGORY_STYLE_FILTER: Record<string, string[]> = {
  character: [],
  beast: ["beast", "demonic", "fey", "undead", "viking", "void", "grimdark"],
  world: ["cultivation", "noble", "arabian", "viking", "slavic", "celtic", "egyptian", "mesoamerican", "hindi", "greek", "steampunk", "cyberpunk"],
  place: ["elven", "celestial", "viking", "egyptian", "mesoamerican", "arabian", "hindi", "greek", "dwarf", "elemental", "fey"],
  item: ["divine", "steampunk", "elemental", "celestial", "dwarf", "noble", "fey"]
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
  cultivationSourceText?: string
  cultivationGuide?: string
  allowEmptyTemplate?: boolean
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
  loreEntries?: {
    id: string
    chapterId?: string
    chapterTitle?: string
    chapterNumber?: number | null
    text: string
    timestamp: number
  }[]
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
const PROGRESSION_AI_CHAPTER_CHAR_LIMIT = 60000
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
  { id: "template-preset-title", label: "Title", type: "compound", sourceKey: "Title", fields: ["Title", "Title Effect"], color: "amber", enabled: true, repeatable: true },
  { id: "template-preset-class", label: "Class", type: "compound", sourceKey: "Class", fields: ["Class", "Class Rank"], color: "fuchsia", enabled: true, repeatable: true },
  { id: "template-preset-exp", label: "EXP", type: "progress", sourceKey: "exp", fields: ["EXP"], color: "lime", enabled: true },
  { id: "template-preset-level-up", label: "Level Up", type: "counter", sourceKey: "Level Ups", fields: ["Level Ups"], color: "fuchsia", enabled: true },
  { id: "template-preset-realm-stage", label: "Realm / Stage", type: "rank", sourceKey: "cultivation", fields: ["Realm", "Stage"], color: "violet", enabled: true },
  { id: "template-preset-affinity", label: "Affinity", type: "compound", sourceKey: "Affinity", fields: ["Affinity Names", "Rank"], color: "cyan", enabled: true },
  { id: "template-preset-bloodline", label: "Bloodline", type: "compound", sourceKey: "Bloodline", fields: ["Bloodline", "Bloodline Grade"], color: "emerald", enabled: true },
  { id: "template-preset-titles", label: "Titles", type: "compound", sourceKey: "Titles", fields: ["Title", "Reputation"], color: "amber", enabled: true },
  { id: "template-preset-weapon", label: "Weapon", type: "compound", sourceKey: "Weapon", fields: ["Weapon", "Weapon Grade", "Weapon Status"], color: "rose", enabled: true, repeatable: true },
  { id: "template-preset-resources", label: "Resources", type: "resource", sourceKey: "Resources", fields: ["HP", "Mana / Qi", "Stamina"], color: "blue", enabled: true },
  { id: "template-preset-artifacts", label: "Inventory / Artifacts", type: "compound", sourceKey: "Artifacts", fields: ["Artifact", "Grade", "Status"], color: "rose", enabled: true }
]
const DEFAULT_PROFILE_TEMPLATE_CARDS: ProgressionTemplateCard[] = [
  { id: "template-name", label: "Name", type: "text", sourceKey: "name", fields: ["Name", "Title"], color: "rose", enabled: true },
  { id: "template-bloodline", label: "Bloodline", type: "compound", sourceKey: "Bloodline", fields: ["Bloodline", "Bloodline Rank"], color: "emerald", enabled: true },
  { id: "template-affinity", label: "Affinity", type: "compound", sourceKey: "Affinity", fields: ["Affinity Names", "Rank"], color: "cyan", enabled: true },
  { id: "template-class", label: "Class", type: "compound", sourceKey: "className", fields: ["Main Class", "Secondary Class"], color: "fuchsia", enabled: true },
  { id: "template-skills", label: "Skills", type: "ability", sourceKey: "abilities", fields: ["Skill", "Rank", "Description"], color: "amber", enabled: true },
  { id: "template-lore", label: "Lore", type: "text", sourceKey: "notes", fields: ["Lore"], color: "blue", enabled: true }
]
const SIMPLE_PROGRESSION_CUSTOM_FIELDS = ["Bloodline", "Bloodline Rank", "Affinity Names", "Affinity Rank", "Secondary Class", "Race", "Affiliation"]
const SIMPLE_PROGRESSION_CUSTOM_FIELD_ALIASES: Record<string, string> = {
  bloodline: "Bloodline",
  "bloodline name": "Bloodline",
  "bloodline rank": "Bloodline Rank",
  "bloodline grade": "Bloodline Rank",
  "bloodline quality": "Bloodline Rank",
  "bloodline tier": "Bloodline Rank",
  "main bloodline": "Bloodline",
  "bloodline name/rank": "Bloodline",
  affinity: "Affinity Names",
  affinities: "Affinity Names",
  "affinity name": "Affinity Names",
  "affinity names": "Affinity Names",
  "elemental affinity": "Affinity Names",
  "elemental affinity names": "Affinity Names",
  "spirit affinity": "Affinity Names",
  "spirit affinity names": "Affinity Names",
  "affinity rank": "Affinity Rank",
  "affinity ranks": "Affinity Rank",
  "affinity grade": "Affinity Rank",
  "affinity grades": "Affinity Rank",
  "affinity tier": "Affinity Rank",
  "affinity tiers": "Affinity Rank",
  "elemental affinity rank": "Affinity Rank",
  "elemental affinity grade": "Affinity Rank",
  "spirit affinity rank": "Affinity Rank",
  "spirit affinity grade": "Affinity Rank",
  "affinity name/rank": "Affinity Names",
  "secondary class": "Secondary Class",
  "second class": "Secondary Class",
  subclass: "Secondary Class",
  "sub class": "Secondary Class",
  "secondary job": "Secondary Class",
  "second job": "Secondary Class",
  race: "Race",
  affiliation: "Affiliation"
}
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
  customFields: SIMPLE_PROGRESSION_CUSTOM_FIELDS,
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
  cultivationSourceText: "",
  cultivationGuide: "",
  notes: "Simple character progression tracks Name, Title, Bloodline, Bloodline Rank, Affinities, Class, Skills, Lore, Race, and Affiliation."
}

const formatSimpleProgressionFieldValue = (value: unknown, canonicalKey: string): string => {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) {
    const formatted = value.map(item => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>
        const name = String(record.name || record.affinity || record.value || record.title || "").trim()
        const rank = String(record.rank || record.grade || record.tier || record.quality || "").trim()
        if (canonicalKey === "Affinity Rank" && name && rank) return `${name} (${rank})`
        if (canonicalKey === "Affinity Names" && name) return name
        if (name && rank) return `${name} (${rank})`
        return name || rank || ""
      }
      return String(item || "").trim()
    }).filter(Boolean)
    return formatted.join(", ")
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const name = String(record.name || record.affinity || record.value || record.title || "").trim()
    const rank = String(record.rank || record.grade || record.tier || record.quality || "").trim()
    if (canonicalKey === "Affinity Rank" && name && rank) return `${name} (${rank})`
    if (canonicalKey === "Affinity Names" && name) return name
    if (name && rank) return `${name} (${rank})`
    return Object.entries(record)
      .map(([key, item]) => `${key}: ${String(item || "").trim()}`)
      .filter(item => !item.endsWith(":"))
      .join(", ")
  }
  return String(value || "").trim()
}

const sanitizeSimpleProgressionCustomFields = (fields?: Record<string, unknown>) => {
  const cleaned: Record<string, string> = {}
  Object.entries(fields || {}).forEach(([key, value]) => {
    const canonicalKey = SIMPLE_PROGRESSION_CUSTOM_FIELD_ALIASES[key.trim().toLowerCase()]
    if (!canonicalKey) return
    const cleanValue = formatSimpleProgressionFieldValue(value, canonicalKey)
    if (cleanValue || !cleaned[canonicalKey]) {
      cleaned[canonicalKey] = cleanValue
    }
  })
  return cleaned
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

const REPEATABLE_PROGRESSION_TEMPLATE_KEYS = new Set(["title", "titles", "class", "classname", "jobclass", "weapon", "weapons"])

const isRepeatableProgressionTemplateCard = (card: Pick<ProgressionTemplateCard, "label" | "sourceKey"> & { repeatable?: boolean }) => {
  if (card.repeatable) return true
  return [card.label, card.sourceKey]
    .map(item => normalizeProgressionTemplateLookupKey(item))
    .some(key => REPEATABLE_PROGRESSION_TEMPLATE_KEYS.has(key))
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
  const activeNoteIdRef = useRef<string | null>(null)
  activeNoteIdRef.current = activeNoteId
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
  const [dirPermission, setDirPermission] = useState<'granted' | 'prompt' | 'denied'>('prompt')
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectError, setReconnectError] = useState<string | null>(null)

  const [isBuffering, setIsBuffering] = useState(false)
  const [bufferStatus, setBufferStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSendToBuffer = async () => {
    if (!activeNote || !projectName) return

    setIsBuffering(true)
    setBufferStatus('idle')

    try {
      const response = await fetch('/api/sync/buffer-chapter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novelName: projectName,
          chapterTitle: activeNote.title || 'Untitled Chapter',
          chapterContent: activeNote.content || '',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send to buffer')
      }

      setBufferStatus('success')
      setTimeout(() => setBufferStatus('idle'), 3000)
    } catch (error) {
      console.error('Error buffering chapter:', error)
      setBufferStatus('error')
      setTimeout(() => setBufferStatus('idle'), 5000)
    } finally {
      setIsBuffering(false)
    }
  }

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
  const [activeBiblePopup, setActiveBiblePopup] = useState<"extract" | "canon" | "timeline" | null>(null)
  const [bibleExtractLoading, setBibleExtractLoading] = useState(false)
  const [bibleExtractionSuggestions, setBibleExtractionSuggestions] = useState<BibleExtractionSuggestion[]>([])
  const [bibleCanonLoading, setBibleCanonLoading] = useState(false)
  const [bibleCanonConflicts, setBibleCanonConflicts] = useState<BibleCanonConflict[]>([])
  const [bibleCanonCheckedNoteId, setBibleCanonCheckedNoteId] = useState<string | null>(null)
  const [nameStyle, setNameStyle] = useState("fantasy")
  const [nameCategory, setNameCategory] = useState<BibleEntry["category"]>("character")
  const [nameStructure, setNameStructure] = useState("any")
  const [nameTone, setNameTone] = useState("memorable")
  const [nameCustomPrompt, setNameCustomPrompt] = useState("")
  const [generatedNames, setGeneratedNames] = useState<GeneratedNameOption[]>([])
  const [nameGenerateLoading, setNameGenerateLoading] = useState(false)
  const [nameGenerateError, setNameGenerateError] = useState("")
  const [acceptedNameId, setAcceptedNameId] = useState<string | null>(null)
  const [activeNamePicker, setActiveNamePicker] = useState<NameForgePicker | null>(null)
  const [nameGender, setNameGender] = useState("any")
  const [nameStyle2, setNameStyle2] = useState("")
  const [nameSyllableBank, setNameSyllableBank] = useState("")
  const [nameShortlist, setNameShortlist] = useState<GeneratedNameOption[]>([])
  const [selectedForBatch, setSelectedForBatch] = useState<Set<number>>(new Set())
  const [showLoreEditor, setShowLoreEditor] = useState(false)
  const [loreEditorDraft, setLoreEditorDraft] = useState<GeneratedNameOption | null>(null)
  const [nameVariantLoading, setNameVariantLoading] = useState(false)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [showNameSyllables, setShowNameSyllables] = useState(false)
  const [nameStyle2Options, setNameStyle2Options] = useState(NAME_STYLE_OPTIONS)

  useEffect(() => {
    const allowed = CATEGORY_STYLE_FILTER[nameCategory]
    if (allowed && allowed.length > 0) {
      setNameStyle2Options(NAME_STYLE_OPTIONS.filter(s => allowed.includes(s.value)))
      if (nameStyle2 && !allowed.includes(nameStyle2)) setNameStyle2("")
    } else {
      setNameStyle2Options(NAME_STYLE_OPTIONS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameCategory])

  const activeBibleEntry = bibleEntries.find(e => e.id === activeBibleEntryId)

  // Brain Map States
  const [brainEntries, setBrainEntries] = useState<BrainEntry[]>([])
  const [brainSearchQuery, setBrainSearchQuery] = useState('')
  const [selectedBrainEntryId, setSelectedBrainEntryId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>("")
  const [selectedSegment, setSelectedSegment] = useState<{ id: string; title: string; content: string } | null>(null)

  useEffect(() => {
    setMergeTargetId("")
    setSelectedSegment(null)
  }, [selectedBrainEntryId])
  const [brainTypeFilter, setBrainTypeFilter] = useState<BrainTypeFilter>('all')
  const [selectedBrainEntityName, setSelectedBrainEntityName] = useState<string | null>(null)
  const [brainAskQuestion, setBrainAskQuestion] = useState('')
  const [brainAskAnswer, setBrainAskAnswer] = useState('')
  const [brainAskLoading, setBrainAskLoading] = useState(false)
  const [brainAskError, setBrainAskError] = useState('')

  // New Brain Map Enhancements States
  const [showBrainGraph, setShowBrainGraph] = useState(false)
  const [consistencyLoading, setConsistencyLoading] = useState(false)
  const [consistencyWarnings, setConsistencyWarnings] = useState<{ entityName: string; severity: 'warning' | 'critical'; message: string }[]>([])
  const [consistencyCheckedNoteId, setConsistencyCheckedNoteId] = useState<string | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestedEntities, setSuggestedEntities] = useState<{ entityName: string; entityType: BrainEntityType; importance: BrainImportance; aiSummary: string }[]>([])
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierMessage, setDossierMessage] = useState('')
  const [isEditingDossier, setIsEditingDossier] = useState(false)
  const [dossierEditText, setDossierEditText] = useState('')
  const [activeBrainPopup, setActiveBrainPopup] = useState<'ask' | 'suggestions' | 'continuity' | null>(null)
  const [arcSeeds, setArcSeeds] = useState<ArcSeed[]>([])
  const [arcSeedLoading, setArcSeedLoading] = useState(false)
  const [arcSeedError, setArcSeedError] = useState("")
  const [selectedArcSeedId, setSelectedArcSeedId] = useState<string | null>(null)
  const [arcSeedSearchQuery, setArcSeedSearchQuery] = useState("")
  const [arcSeedStatusFilter, setArcSeedStatusFilter] = useState<ArcSeedStatus | 'all'>('all')

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
  const [showLoreHistoryModal, setShowLoreHistoryModal] = useState(false)
  const [draggedProgressionTemplateCardId, setDraggedProgressionTemplateCardId] = useState<string | null>(null)
  const [progressionRealmImportText, setProgressionRealmImportText] = useState("")
  const [progressionRealmImportLoading, setProgressionRealmImportLoading] = useState(false)
  const [isProgressionCultivationImportOpen, setIsProgressionCultivationImportOpen] = useState(false)
  const [progressionTemplatePrompt, setProgressionTemplatePrompt] = useState("")
  const [progressionTemplatePromptLoading, setProgressionTemplatePromptLoading] = useState(false)
  const [progressionTemplatePromptError, setProgressionTemplatePromptError] = useState("")
  const [isProgressionPromptDesignerOpen, setIsProgressionPromptDesignerOpen] = useState(false)
  const [progressionJsonNewKey, setProgressionJsonNewKey] = useState("")
  const [progressionJsonNewKind, setProgressionJsonNewKind] = useState<ProgressionJsonTemplateFieldKind>("text")
  const [progressionBulkUpdating, setProgressionBulkUpdating] = useState(false)
  const [progressionBulkUpdateStatus, setProgressionBulkUpdateStatus] = useState("")
  const [showStatsChart, setShowStatsChart] = useState(false)
  const [selectedGraphStat, setSelectedGraphStat] = useState<string>("level")
  const [timelineCheckLoading, setTimelineCheckLoading] = useState(false)
  const [timelineIssues, setTimelineIssues] = useState<TimelineIssue[]>([])
  const [showTimelineCheckModal, setShowTimelineCheckModal] = useState(false)
  const [timelineCheckTimestamp, setTimelineCheckTimestamp] = useState<number | null>(null)
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
  const [appearanceCustomStyle, setAppearanceCustomStyle] = useState("")
  const [appearanceSelectedEntryId, setAppearanceSelectedEntryId] = useState<string | null>(null)
  const [appearanceResult, setAppearanceResult] = useState<AppearancePromptResult | null>(null)
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState("")
  const [appearanceCopiedKey, setAppearanceCopiedKey] = useState<string | null>(null)
  const [appearanceFormLabels, setAppearanceFormLabels] = useState<Record<string, string>>({
    beastForm: "Beast Form",
    demiHumanForm: "Demi-human Form",
    humanForm: "Human Form"
  })
  const [appearanceFormDescriptions, setAppearanceFormDescriptions] = useState<Record<string, string>>({})
  const [appearanceFormEnabled, setAppearanceFormEnabled] = useState<Record<string, boolean>>({
    beastForm: true,
    demiHumanForm: true,
    humanForm: true
  })
  const [appearanceFormKeys, setAppearanceFormKeys] = useState<string[]>(["beastForm", "demiHumanForm", "humanForm"])

  const getDefaultEntryForms = useCallback((category: string): { keys: string[]; enabled: Record<string, boolean>; labels: Record<string, string>; descriptions: Record<string, string> } => {
    if (category === "beast") {
      return { keys: ["beastForm"], enabled: { beastForm: true, demiHumanForm: false, humanForm: false }, labels: { beastForm: "Beast Form", demiHumanForm: "Demi-human Form", humanForm: "Human Form" }, descriptions: {} }
    }
    if (category === "character") {
      return { keys: ["humanForm", "demiHumanForm"], enabled: { beastForm: false, humanForm: true, demiHumanForm: true }, labels: { beastForm: "Beast Form", humanForm: "Human Form", demiHumanForm: "Demi-human Form" }, descriptions: {} }
    }
    return { keys: ["beastForm", "demiHumanForm", "humanForm"], enabled: { beastForm: true, demiHumanForm: true, humanForm: true }, labels: { beastForm: "Beast Form", demiHumanForm: "Demi-human Form", humanForm: "Human Form" }, descriptions: {} }
  }, [])

  const [appearanceEntryForms, setAppearanceEntryForms] = useState<Record<string, { keys: string[]; enabled: Record<string, boolean>; labels: Record<string, string>; descriptions: Record<string, string> }>>({})

  const saveCurrentEntryFormConfig = useCallback((entryId: string | null) => {
    if (!entryId) return
    setAppearanceEntryForms(prev => ({
      ...prev,
      [entryId]: {
        keys: appearanceFormKeys,
        enabled: appearanceFormEnabled,
        labels: appearanceFormLabels,
        descriptions: appearanceFormDescriptions
      }
    }))
  }, [appearanceFormKeys, appearanceFormEnabled, appearanceFormLabels, appearanceFormDescriptions])

  const loadEntryFormConfig = useCallback((entryId: string | null) => {
    if (!entryId) {
      setAppearanceFormKeys(["beastForm", "demiHumanForm", "humanForm"])
      setAppearanceFormEnabled({ beastForm: true, demiHumanForm: true, humanForm: true })
      setAppearanceFormLabels({ beastForm: "Beast Form", demiHumanForm: "Demi-human Form", humanForm: "Human Form" })
      setAppearanceFormDescriptions({})
      return
    }
    const saved = appearanceEntryForms[entryId]
    if (saved) {
      setAppearanceFormKeys(saved.keys)
      setAppearanceFormEnabled(saved.enabled)
      setAppearanceFormLabels(saved.labels)
      setAppearanceFormDescriptions(saved.descriptions || {})
    } else {
      const entry = bibleEntries.find(e => e.id === entryId)
      const defaults = getDefaultEntryForms(entry?.category || "character")
      setAppearanceFormKeys(defaults.keys)
      setAppearanceFormEnabled(defaults.enabled)
      setAppearanceFormLabels(defaults.labels)
      setAppearanceFormDescriptions({})
    }
  }, [appearanceEntryForms, bibleEntries, getDefaultEntryForms])

  const formConfigSnapshotRef = useRef<string>("")
  useEffect(() => {
    if (!appearanceSelectedEntryId) return
    const snapshot = JSON.stringify({ keys: appearanceFormKeys, enabled: appearanceFormEnabled, labels: appearanceFormLabels, descriptions: appearanceFormDescriptions })
    if (formConfigSnapshotRef.current && formConfigSnapshotRef.current !== snapshot) {
      saveCurrentEntryFormConfig(appearanceSelectedEntryId)
    }
    formConfigSnapshotRef.current = snapshot
  }, [appearanceFormKeys, appearanceFormEnabled, appearanceFormLabels, appearanceFormDescriptions, appearanceSelectedEntryId, saveCurrentEntryFormConfig])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("penpad_appearance_entry_forms")
      if (stored) setAppearanceEntryForms(JSON.parse(stored))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("penpad_appearance_entry_forms", JSON.stringify(appearanceEntryForms))
    } catch {}
  }, [appearanceEntryForms])

  const [appearanceGeneratingForm, setAppearanceGeneratingForm] = useState<string | null>(null)
  const [appearanceImageGenerating, setAppearanceImageGenerating] = useState<string | null>(null)
  const [appearanceGeneratedImages, setAppearanceGeneratedImages] = useState<Record<string, string>>({})
  const [appearancePerFormNegative, setAppearancePerFormNegative] = useState(false)
  const [appearanceBatchEntryIds, setAppearanceBatchEntryIds] = useState<string[]>([])
  const [appearanceBatchLoading, setAppearanceBatchLoading] = useState(false)
  const [appearanceAddFormKey, setAppearanceAddFormKey] = useState("")

  // Hover Tooltip States
  const [hoveredLore, setHoveredLore] = useState<BibleEntry | null>(null)
  const [hoveredLorePosition, setHoveredLorePosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!hoveredLore) return
    const handleOutsideClick = () => {
      setHoveredLore(null)
      setHoveredLorePosition(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [hoveredLore])

  // Autocomplete States
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const [autocompleteTriggerPos, setAutocompleteTriggerPos] = useState(0)



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

  const getFormLabel = (key: string) => appearanceFormLabels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()

  const buildAppearanceLoreContent = (result: AppearancePromptResult) => {
    const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
    const chapterLine = activeNote
      ? `${activeChapterNumber ? `Chapter ${activeChapterNumber} - ` : ""}${activeNote.title || "Untitled"}`
      : "No chapter selected"
    const prompts = result.prompts || {}
    const notes = Array.isArray(result.consistencyNotes) && result.consistencyNotes.length > 0
      ? result.consistencyNotes.map(note => `- ${note}`).join("\r\n")
      : "- Keep recognizable traits consistent across every form."
    const styleToUse = appearanceCustomStyle || appearanceStyle

    const promptSections = Object.keys(prompts).length > 0
      ? Object.entries(prompts).map(([key, text]) => `### ${getFormLabel(key)}\r\n${typeof text === "string" ? text : "Not generated."}`).join("\r\n\r\n")
      : ""

    const negPromptSections = result.negativePrompts && Object.keys(result.negativePrompts).length > 0
      ? Object.entries(result.negativePrompts).map(([key, text]) => `${getFormLabel(key)} Negative Prompt: ${typeof text === "string" ? text : ""}`).join("\r\n")
      : ""

    return [
      "## Appearance Prompt Sheet",
      `Source: ${chapterLine}`,
      `Style Direction: ${styleToUse}`,
      "",
      result.overview ? `### Visual Core\r\n${result.overview}\r\n` : "",
      promptSections,
      "### Consistency Notes",
      notes,
      "",
      result.negativePrompt ? `### Negative Prompt\r\n${result.negativePrompt}` : "",
      negPromptSections ? `### Per-Form Negative Prompts\r\n${negPromptSections}` : ""
    ].filter(Boolean).join("\r\n")
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
      const activeFormKeys = appearanceFormKeys.filter(k => appearanceFormEnabled[k] !== false)
      const forms: Record<string, string> = {}
      for (const key of activeFormKeys) {
        if (appearanceFormDescriptions[key]?.trim()) forms[key] = appearanceFormDescriptions[key].trim()
      }
      const styleToUse = appearanceCustomStyle.trim() || appearanceStyle
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appearance_prompts",
          name: sourceEntry.name,
          style: styleToUse,
          selectedText,
          forms: Object.keys(forms).length > 0 ? forms : undefined,
          formLabels: appearanceFormLabels,
          formEnabled: appearanceFormEnabled,
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
        setAppearanceResult(data.appearancePrompts || { overview: "", prompts: {}, negativePrompt: "", consistencyNotes: [], negativePrompts: {}, characterName: sourceEntry.name })
      }
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Failed to generate appearance prompts")
    } finally {
      setAppearanceLoading(false)
    }
  }

  const handleRegenerateSingleForm = async (formKey: string) => {
    const selectedText = aiSelectionText
    const sourceEntry = selectedAppearanceEntry || findLoreEntryFromSelection(selectedText)
    if (!sourceEntry) {
      setAppearanceError("No entry selected.")
      return
    }
    setAppearanceGeneratingForm(formKey)
    try {
      const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
      const chapterContext = activeNote?.content
        ? activeNote.content.slice(0, 5000)
        : ""
      const activeFormKeys = appearanceFormKeys.filter(k => appearanceFormEnabled[k] !== false)
      const forms: Record<string, string> = {}
      for (const key of activeFormKeys) {
        if (appearanceFormDescriptions[key]?.trim()) forms[key] = appearanceFormDescriptions[key].trim()
      }
      const styleToUse = appearanceCustomStyle.trim() || appearanceStyle
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appearance_prompts",
          name: sourceEntry.name,
          style: styleToUse,
          selectedText,
          forms: Object.keys(forms).length > 0 ? forms : undefined,
          formLabels: appearanceFormLabels,
          formEnabled: { [formKey]: true },
          regenerateForm: formKey,
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
        const newPrompts = data.appearancePrompts?.prompts || {}
        setAppearanceResult(prev => {
          if (!prev) return data.appearancePrompts || { overview: "", prompts: { [formKey]: typeof newPrompts[formKey] === "string" ? newPrompts[formKey] : "" }, negativePrompt: "", consistencyNotes: [], negativePrompts: {}, characterName: sourceEntry.name }
          const mergedNegPrompts = { ...(prev.negativePrompts || {}) }
          const negVal = data.appearancePrompts?.negativePrompts?.[formKey]
          if (typeof negVal === "string") mergedNegPrompts[formKey] = negVal
          const newVal = typeof newPrompts[formKey] === "string" ? newPrompts[formKey] : ""
          return {
            ...prev,
            prompts: { ...(prev.prompts || {}), [formKey]: newVal || prev.prompts?.[formKey] || "" },
            negativePrompts: mergedNegPrompts
          }
        })
      }
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Failed to regenerate form")
    } finally {
      setAppearanceGeneratingForm(null)
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
    const sheetHeader = promptSheet.split("\r\n")[0] || ""

    if (targetEntry.content.includes(sheetHeader)) {
      setAppearanceError("This prompt sheet already exists in the lore entry. Skipping duplicate.")
      return
    }

    const charDetails = appearanceResult.characterDetails
    const updatedEntry: BibleEntry = {
      ...targetEntry,
      content: `${targetEntry.content || ""}\r\n\r\n${promptSheet}`.trim(),
      updatedAt: now,
      ...(charDetails && (targetEntry.category === "character" || targetEntry.category === "beast")
        ? {
            characterDetails: {
              ...(targetEntry.characterDetails || {}),
              appearance: charDetails.appearance || targetEntry.characterDetails?.appearance || "",
              hair: charDetails.hair || targetEntry.characterDetails?.hair || "",
              eyes: charDetails.eyes || targetEntry.characterDetails?.eyes || "",
              body: charDetails.body || targetEntry.characterDetails?.body || "",
              attire: charDetails.attire || targetEntry.characterDetails?.attire || "",
              distinguishingFeatures: charDetails.distinguishingFeatures || targetEntry.characterDetails?.distinguishingFeatures || "",
              updatedAt: now
            }
          }
        : {})
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
    
    const oldArr = oldStr.split('\r\n')
    const newArr = newStr.split('\r\n')
    
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

    const lineSegments = chapterContent.split(/\r?\r\n/).map(line => line.trim()).filter(Boolean)
    const sentenceSegments = chapterContent
      .replace(/([.!?。！？])/g, "$1\r\n")
      .split(/\r\n+/)
      .map(line => line.trim())
      .filter(Boolean)
    const lines = lineSegments.length >= 5 ? lineSegments : sentenceSegments
    const matchedIndexes = new Set<number>()
    lines.forEach((line, index) => {
      const cleanLine = normalizeProgressionLookupText(line)
      if (aliases.some(alias => cleanLine.includes(alias))) {
        for (let offset = -4; offset <= 6; offset += 1) {
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

    return evidenceLines.join("\r\n").slice(0, 18000)
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
          enabled: card.enabled !== false,
          repeatable: card.repeatable === true
        }
      })
      .filter(Boolean) as ProgressionTemplateCard[]

    const seen = new Set<string>()
    const uniqueCards = normalized.filter(card => {
      const key = `${normalizeProgressionTemplateLookupKey(card.sourceKey)}::${normalizeProgressionTemplateLookupKey(card.label)}`
      const uniqueKey = isRepeatableProgressionTemplateCard(card) ? `${key}::${card.id}` : key
      if (seen.has(uniqueKey)) return false
      seen.add(uniqueKey)
      return true
    })
    customFields.forEach(fieldName => {
      let cleanName = String(fieldName || "").trim()
      if (!cleanName) return
      if (cleanName === "Spirit Affinity" || cleanName === "Elemental Affinity") {
        cleanName = "Affinity"
      }
      const belongsToExistingCard = uniqueCards.some(card => {
        const cardKeys = [card.label, card.sourceKey, ...card.fields]
          .map(item => normalizeProgressionTemplateLookupKey(item))
        return cardKeys.includes(normalizeProgressionTemplateLookupKey(cleanName))
      })
      if (belongsToExistingCard) return
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

    let labelCandidates: string[] = []
    let rankCandidates: string[] = []

    if (kind === "bloodline") {
      labelCandidates = [
        fieldName,
        card.sourceKey,
        card.label,
        "Bloodline",
        "Bloodline Name",
        "Bloodline Type"
      ]
      rankCandidates = [
        fieldName,
        `${card.label} Rank`,
        `${card.label} Ranks`,
        `${card.label} Grade`,
        `${card.label} Grades`,
        `${card.sourceKey} Rank`,
        `${card.sourceKey} Ranks`,
        `${card.sourceKey} Grade`,
        `${card.sourceKey} Grades`,
        "Bloodline Rank",
        "Bloodline Grade",
        "Bloodline Ranks",
        "Bloodline Grades",
        "Bloodline Quality",
        "Bloodline Tier",
        "Bloodline Realm",
        "Bloodline Stage",
        "Rank"
      ]
    } else if (kind === "affinity") {
      labelCandidates = [
        fieldName,
        card.sourceKey,
        card.label,
        "Affinity",
        "Affinity Names",
        "Elemental Affinity",
        "Spirit Affinity"
      ]
      rankCandidates = [
        fieldName,
        `${card.label} Rank`,
        `${card.label} Ranks`,
        `${card.label} Grade`,
        `${card.label} Grades`,
        `${card.sourceKey} Rank`,
        `${card.sourceKey} Ranks`,
        `${card.sourceKey} Grade`,
        `${card.sourceKey} Grades`,
        "Affinity Rank",
        "Affinity Ranks",
        "Affinity Grade",
        "Affinity Grades",
        "Elemental Affinity Rank",
        "Elemental Affinity Grade",
        "Spirit Affinity Ranks",
        "Spirit Affinity Grade",
        "Rank"
      ]
    }

    const uniqueLabelCandidates = Array.from(new Set(labelCandidates.filter(Boolean)))
    const uniqueRankCandidates = Array.from(new Set(rankCandidates.filter(Boolean)))

    const candidates = isProgressionRankFieldName(fieldName) ? uniqueRankCandidates : uniqueLabelCandidates
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
    if (cleanField === "main class" || cleanField === "primary class") return profile.className
    if (cleanField === "secondary class" || cleanField === "second class" || cleanField === "subclass" || cleanField === "sub class") return getProgressionCustomFieldValue(profile, "Secondary Class")
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

  const getProgressionTemplateCardsForProfile = () => {
    const configuredCards = normalizeProgressionTemplateCards(
      progressionSystem?.profileTemplate?.cards,
      SIMPLE_PROGRESSION_CUSTOM_FIELDS
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
      allowEmptyTemplate: nextCards.length === 0,
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
      notes: "",
      cultivationSourceText: "",
      cultivationGuide: "",
      allowEmptyTemplate: true
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
        notes: progressionSystem.notes,
        cultivationSourceText: progressionSystem.cultivationSourceText || "",
        cultivationGuide: progressionSystem.cultivationGuide || "",
        allowEmptyTemplate: progressionSystem.allowEmptyTemplate === true
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
    const createRepeatablePresetCard = () => {
      const usedNames = new Set<string>()
      currentCards.forEach(card => {
        const cardNames = [card.label, card.sourceKey, ...card.fields]
        cardNames.forEach(value => {
          const key = normalizeProgressionTemplateLookupKey(value)
          if (key) usedNames.add(key)
        })
      })
      const systemCustomFields = progressionSystem?.customFields || []
      systemCustomFields.forEach(value => {
        const key = normalizeProgressionTemplateLookupKey(value)
        if (key) usedNames.add(key)
      })

      const cleanBase = String(preset.label || preset.sourceKey || "Card").trim()
      let nextLabel = cleanBase
      let suffix = 2
      while (usedNames.has(normalizeProgressionTemplateLookupKey(nextLabel))) {
        nextLabel = `${cleanBase} ${suffix}`
        suffix += 1
      }

      const nextFields = preset.fields.map(fieldName => {
        const cleanField = String(fieldName || "").trim()
        const cleanFieldKey = normalizeProgressionTemplateLookupKey(cleanField)
        const cleanBaseKey = normalizeProgressionTemplateLookupKey(cleanBase)
        if (!cleanField) return nextLabel
        if (cleanFieldKey === cleanBaseKey || usedNames.has(cleanFieldKey)) return nextLabel
        if (cleanField.toLowerCase().startsWith(`${cleanBase.toLowerCase()} `)) {
          return cleanField.replace(new RegExp(`^${cleanBase}\\b`, "i"), nextLabel)
        }
        return cleanField
      })

      return {
        ...preset,
        id: `${preset.id}-${crypto.randomUUID()}`,
        label: nextLabel,
        sourceKey: nextLabel,
        fields: Array.from(new Set(nextFields)),
        repeatable: true
      }
    }

    if (preset.repeatable) {
      const nextCards = [...currentCards, createRepeatablePresetCard()]
      persistProgressionSystem({
        ...progressionSystem,
        customFields: Array.from(new Set([
          ...(progressionSystem?.customFields || []),
          ...getProgressionCustomFieldsFromTemplateCards(nextCards)
        ])),
        allowEmptyTemplate: false,
        profileTemplate: {
          ...(progressionSystem?.profileTemplate || DEFAULT_PROFILE_TEMPLATE),
          cards: nextCards
        }
      })
      setProgressionNotice(`${preset.label} card added to the profile template.`)
      return
    }

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
      allowEmptyTemplate: false,
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
        cultivationSourceText: text.slice(0, 20000),
        cultivationGuide: importedSettings.cultivationGuide || importedSettings.notes || progressionSystem.cultivationGuide || "",
        notes: importedSettings.notes || progressionSystem.notes
      })
      setProgressionRealmImportText("")
      setIsProgressionCultivationImportOpen(false)
      setProgressionNotice("Cultivation stages imported. The AI will use this realm order to keep class and cultivation separate in later chapter updates.")
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

  const renderCultivationImportPanel = () => (
    <div className="progression-cultivation-import-box">
      <div className="progression-template-header">
        <div>
          <strong>Cultivation System</strong>
          <span>Upload or paste this novel&apos;s realm ladder so AI updates keep cultivation separate from class/job fields.</span>
        </div>
        <button type="button" className="btn-ai-sub btn-ai-secondary" onClick={() => setIsProgressionCultivationImportOpen(prev => !prev)}>
          <ChevronDown size={12} className={isProgressionCultivationImportOpen ? "rotate" : ""} />
          {isProgressionCultivationImportOpen ? "Hide" : "Manage"}
        </button>
      </div>
      <div className="progression-system-summary">
        <span>{progressionSystem.realms.length} realms</span>
        <span>{progressionSystem.stageLabels.join(" / ") || "No stages"}</span>
        {progressionSystem.cultivationGuide && <span>AI guide saved</span>}
      </div>
      {progressionSystem.cultivationGuide && (
        <div className="progression-cultivation-guide-preview">
          {progressionSystem.cultivationGuide}
        </div>
      )}
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
            placeholder="Paste cultivation stages weakest to strongest. Example: Mortal Realm, Spirit Realm, Saint Realm, God Realm. Add sub-stages like Low / Medium / High / Peak if your novel uses them."
          />
          <div className="progression-cultivation-import-footer">
            <button
              type="button"
              className="btn-ai-sub btn-ai-primary"
              onClick={() => handleCultivationRealmImport()}
              disabled={!progressionRealmImportText.trim() || progressionRealmImportLoading}
            >
              {progressionRealmImportLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
              Save Cultivation Stages
            </button>
          </div>
        </div>
      )}
    </div>
  )

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
        allowEmptyTemplate: false,
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

const fillEmptyCustomJsonData = (
  jsonData: Record<string, any>,
  profile: {
    name: string;
    title: string;
    className: string;
    realm: string;
    stage: string;
    rank: string;
    level: number;
    exp: number;
    nextLevelExp: number;
    abilities: ProgressionAbility[];
    customFields: Record<string, any>;
    stats: Record<string, any>;
  }
): Record<string, any> => {
  const result = { ...jsonData }

  const isEmpty = (val: any): boolean => {
    if (val === null || val === undefined) return true
    if (typeof val === "string") return val.trim() === ""
    if (Array.isArray(val)) return val.length === 0 || val.every(isEmpty)
    if (typeof val === "object") return Object.values(val).every(isEmpty)
    return false
  }

  const getCleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "")

  const getProfileValueForKey = (k: string, expectedType: string): any => {
    const clean = getCleanKey(k)
    if (clean === "name") return profile.name
    if (clean === "title") return expectedType === "array" ? [profile.title].filter(Boolean) : profile.title
    if (clean === "classname" || clean === "class") return profile.className
    if (clean === "realm") return profile.realm
    if (clean === "stage") return profile.stage
    if (clean === "rank") return profile.rank
    if (clean === "cultivation" || clean === "cultivationstage") {
      if (expectedType === "object") {
        return {
          realm: profile.realm,
          stage: profile.stage,
          rank: profile.rank
        }
      }
      return [profile.realm, profile.stage || profile.rank].filter(Boolean).join(" - ")
    }
    if (clean === "level" || clean === "lvl") return profile.level
    if (clean === "exp" || clean === "experience") return expectedType === "string" ? `${profile.exp}/${profile.nextLevelExp}` : profile.exp
    
    if (clean === "skills" || clean === "abilities" || clean === "techniques") {
      if (expectedType === "array") {
        return profile.abilities.map(a => a.name)
      }
      return profile.abilities.map(a => `${a.name}${a.rank ? ` (${a.rank})` : ""}`).join(", ")
    }

    if (clean === "bloodline") {
      const bloodlineName = profile.customFields["Bloodline"] || profile.customFields["bloodline"] || ""
      const bloodlineRank = profile.customFields["Bloodline Rank"] || profile.customFields["Bloodline Grade"] || profile.customFields["bloodline rank"] || ""
      if (expectedType === "object") {
        return {
          name: bloodlineName,
          rank: bloodlineRank,
          description: bloodlineRank
        }
      }
      return [bloodlineName, bloodlineRank].filter(Boolean).join(" - ")
    }

    // Try customFields match
    for (const cfKey of Object.keys(profile.customFields)) {
      if (getCleanKey(cfKey) === clean) {
        return profile.customFields[cfKey]
      }
    }

    // Try stats match
    for (const sKey of Object.keys(profile.stats)) {
      if (getCleanKey(sKey) === clean) {
        return profile.stats[sKey]
      }
    }

    return undefined
  }

  const fillValue = (val: any, keyContext: string): any => {
    if (val === null || val === undefined) {
      return getProfileValueForKey(keyContext, "string") || val
    }

    if (Array.isArray(val)) {
      if (val.length === 0) {
        const fallback = getProfileValueForKey(keyContext, "array")
        if (Array.isArray(fallback)) return fallback
      }
      return val.map((item, idx) => fillValue(item, `${keyContext}_${idx}`))
    }

    if (typeof val === "object") {
      const keys = Object.keys(val)
      const isValEmpty = keys.every(k => isEmpty(val[k]))
      
      if (isValEmpty) {
        const fallback = getProfileValueForKey(keyContext, "object")
        if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
          const filledObj: Record<string, any> = {}
          for (const k of keys) {
            const cleanSub = getCleanKey(k)
            if (cleanSub in fallback) {
              filledObj[k] = fallback[cleanSub]
            } else if (cleanSub === "realm" && "realm" in fallback) {
              filledObj[k] = fallback.realm
            } else if ((cleanSub === "stage" || cleanSub === "rank") && ("stage" in fallback || "rank" in fallback)) {
              filledObj[k] = fallback.stage || fallback.rank
            } else if (cleanSub === "description" && "description" in fallback) {
              filledObj[k] = fallback.description
            } else {
              filledObj[k] = getProfileValueForKey(k, typeof val[k]) || val[k]
            }
          }
          return filledObj
        }
      }

      const newObj: Record<string, any> = {}
      for (const k of keys) {
        if (isEmpty(val[k])) {
          newObj[k] = getProfileValueForKey(k, typeof val[k]) || val[k]
        } else if (typeof val[k] === "object") {
          newObj[k] = fillValue(val[k], k)
        } else {
          newObj[k] = val[k]
        }
      }
      return newObj
    }

    if (isEmpty(val)) {
      return getProfileValueForKey(keyContext, typeof val) || val
    }

    return val
  }

  for (const key of Object.keys(result)) {
    if (isEmpty(result[key])) {
      result[key] = getProfileValueForKey(key, typeof result[key]) || result[key]
    } else if (typeof result[key] === "object") {
      result[key] = fillValue(result[key], key)
    }
  }

  return result
}

  const normalizeProgressionProfile = (
    sourceEntry: BibleEntry,
    aiProfile: Partial<CharacterProgressionProfile> | undefined,
    existingProfile: CharacterProgressionProfile | undefined,
    historyEntry: ProgressionHistoryEntry,
    now: number
  ): CharacterProgressionProfile => {
    const sharedTemplate = progressionSystem.profileTemplate?.enabled ? progressionSystem.profileTemplate : DEFAULT_PROFILE_TEMPLATE
    
    // Capture lore history
    const incomingNotes = String(aiProfile?.notes || "").trim()
    const existingLoreEntries = existingProfile?.loreEntries || []
    const nextLoreEntries = [...existingLoreEntries]
    if (incomingNotes) {
      const existingEntryForChapter = nextLoreEntries.find(entry => entry.chapterId === historyEntry.chapterId)
      if (existingEntryForChapter) {
        if (existingEntryForChapter.text !== incomingNotes) {
          const idx = nextLoreEntries.findIndex(entry => entry.id === existingEntryForChapter.id)
          if (idx !== -1) {
            nextLoreEntries[idx] = { ...nextLoreEntries[idx], text: incomingNotes, timestamp: now }
          }
        }
      } else {
        nextLoreEntries.push({
          id: crypto.randomUUID(),
          chapterId: historyEntry.chapterId,
          chapterTitle: historyEntry.chapterTitle,
          chapterNumber: historyEntry.chapterNumber,
          text: incomingNotes,
          timestamp: now
        })
      }
    }

    const aiCustomFields = aiProfile?.customFields && typeof aiProfile.customFields === "object" ? aiProfile.customFields as Record<string, unknown> : {}
    const rawSkillFallback = aiCustomFields.Skills || aiCustomFields.Skill || aiCustomFields.Techniques || aiCustomFields.Abilities
    const rawAbilities = Array.isArray(aiProfile?.abilities)
      ? aiProfile?.abilities || []
      : Array.isArray(rawSkillFallback)
      ? rawSkillFallback as unknown[]
      : typeof rawSkillFallback === "string" && rawSkillFallback.trim()
      ? rawSkillFallback.split(/[,;\r\n]+/).map(item => item.trim()).filter(Boolean)
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
    const customFields = sanitizeSimpleProgressionCustomFields({
      ...(existingProfile?.customFields || {}),
      ...(aiProfile?.customFields || {})
    })
    const inferredClassName = String(
      aiProfile?.className ||
      aiCustomFields["Main Class"] ||
      aiCustomFields.mainClass ||
      aiCustomFields.Class ||
      aiCustomFields.class ||
      ""
    ).trim()

    return {
      id: existingProfile?.id || crypto.randomUUID(),
      loreEntryId: sourceEntry.id,
      name: aiProfile?.name || existingProfile?.name || sourceEntry.name,
      title: aiProfile?.title || existingProfile?.title || "",
      className: inferredClassName || existingProfile?.className || sharedTemplate.defaultClassName || "",
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
      notes: incomingNotes || existingProfile?.notes || sharedTemplate.notes || "",
      loreEntries: nextLoreEntries,
      customJsonData: (() => {
        const baseCustomJson = {
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
        }
        if (progressionSystem.useCustomJsonTemplate) {
          return fillEmptyCustomJsonData(baseCustomJson, {
            name: aiProfile?.name || existingProfile?.name || sourceEntry.name,
            title: aiProfile?.title || existingProfile?.title || "",
            className: inferredClassName || existingProfile?.className || sharedTemplate.defaultClassName || "",
            realm: aiProfile?.realm || existingProfile?.realm || sharedTemplate.defaultRealm || "",
            stage: aiProfile?.stage || existingProfile?.stage || sharedTemplate.defaultStage || "",
            rank: aiProfile?.rank || existingProfile?.rank || sharedTemplate.defaultRank || "",
            level: Number.isFinite(Number(aiProfile?.level)) ? Number(aiProfile?.level) : existingProfile?.level || sharedTemplate.baseLevel || 1,
            exp: Number.isFinite(Number(aiProfile?.exp)) ? Number(aiProfile?.exp) : existingProfile?.exp || sharedTemplate.baseExp || 0,
            nextLevelExp: Number.isFinite(Number(aiProfile?.nextLevelExp)) ? Number(aiProfile?.nextLevelExp) : existingProfile?.nextLevelExp || sharedTemplate.nextLevelExp || 100,
            abilities,
            customFields,
            stats: { ...DEFAULT_PROGRESSION_STATS, ...(sharedTemplate.defaultStats || {}), ...(existingProfile?.stats || {}), ...(aiProfile?.stats || {}) }
          })
        }
        return baseCustomJson
      })(),
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
    const customFields = sanitizeSimpleProgressionCustomFields(existingProfile?.customFields || {})

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
      loreEntries: existingProfile?.loreEntries || [],
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
      const chapterContentForAi = activeNote.content.slice(0, PROGRESSION_AI_CHAPTER_CHAR_LIMIT)
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
            affinityNames: profile.customFields?.["Affinity Names"] || profile.customFields?.Affinity || "",
            affinityRank: profile.customFields?.["Affinity Rank"] || "",
            className: profile.className,
            secondaryClass: profile.customFields?.["Secondary Class"] || "",
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
          affinityNames: profile.customFields?.["Affinity Names"] || profile.customFields?.Affinity || "",
          affinityRank: profile.customFields?.["Affinity Rank"] || "",
          className: profile.className,
          secondaryClass: profile.customFields?.["Secondary Class"] || "",
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
    const chapterContentForAi = note.content.slice(0, PROGRESSION_AI_CHAPTER_CHAR_LIMIT)
    const targetEvidence = buildProgressionTargetEvidence(entry, note.content, "")
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
      affinityNames: profile.customFields?.["Affinity Names"] || profile.customFields?.Affinity || "",
      affinityRank: profile.customFields?.["Affinity Rank"] || "",
      className: profile.className,
      secondaryClass: profile.customFields?.["Secondary Class"] || "",
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
          targetEvidence
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
      customFields: sanitizeSimpleProgressionCustomFields(profile.customFields || {}),
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
    if (cleanField === "title") {
      setProgressionDraftField("title", value)
      setProgressionDraftCustomField(fieldName, value)
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
    if (cleanField === "class" || cleanField === "job class" || cleanField === "main class" || cleanField === "primary class") {
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
    const existingCards = progressionSystem?.profileTemplate?.cards || []
    if (progressionSystem?.allowEmptyTemplate === true && existingCards.length === 0) {
      return
    }
    const learnedCustomFields = SIMPLE_PROGRESSION_CUSTOM_FIELDS
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
      allowEmptyTemplate: false,
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

    const incomingNotes = String(progressionEditProfileDraft.notes || "").trim()
    let existingLoreEntries = progressionEditProfileDraft.loreEntries || []
    if (existingLoreEntries.length === 0 && incomingNotes) {
      existingLoreEntries = [{
        id: crypto.randomUUID(),
        text: incomingNotes,
        timestamp: now
      }]
    }
    const nextLoreEntries = [...existingLoreEntries]
    if (incomingNotes && existingLoreEntries.length > 0 && !existingLoreEntries.some(entry => entry.text === incomingNotes)) {
      nextLoreEntries.push({
        id: crypto.randomUUID(),
        text: incomingNotes,
        timestamp: now
      })
    }

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
      customFields: sanitizeSimpleProgressionCustomFields(progressionEditProfileDraft.customFields || {}),
      loreEntries: nextLoreEntries,
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
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setHoveredLore(match.entry)
              setHoveredLorePosition({
                top: rect.top + window.scrollY - 10,
                left: rect.left + window.scrollX + rect.width / 2
              })
            }}
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

  // On every page load, silently check if Chrome still has permission
  // from the previous session. If so, auto-reconnect without any user action.
  useEffect(() => {
    if (!dirHandle) {
      setDirPermission('prompt')
      return
    }
    const checkPerm = async () => {
      try {
        const state = await dirHandle.queryPermission({ mode: 'readwrite' })
        setDirPermission(state)
      } catch (e) {
        console.error('Error checking dir handle permission:', e)
      }
    }
    checkPerm()
  }, [dirHandle])

  // Reconnect by opening the folder picker starting directly inside the
  // previously linked folder. The user just clicks "Select Folder" once — no navigation needed.
  // The new handle is saved back to IndexedDB for this project.
  const reconnectFolder = useCallback(async () => {
    if (!dirHandle || isReconnecting) return
    setIsReconnecting(true)
    setReconnectError(null)
    try {
      const restored = await verifyPermission(dirHandle)
      if (restored) {
        setDirPermission('granted')
        await saveFolderHandleToProject(dirHandle)
        return
      }

      const newHandle = await (window as any).showDirectoryPicker({
        startIn: dirHandle,     // opens picker directly inside the linked folder
        mode: 'readwrite'
      })
      const granted = await verifyPermission(newHandle)
      if (!granted) {
        setDirPermission('denied')
        setReconnectError('Folder access was not granted. Please select the folder and allow read/write access.')
        return
      }
      setDirHandle(newHandle)
      setDirPermission('granted')
      await saveFolderHandleToProject(newHandle)
    } catch (e: any) {
      // AbortError = user closed the picker — treat silently
      if (e?.name !== 'AbortError') {
        console.error('Reconnect error:', e)
        setReconnectError('Could not reconnect. Please try again or disconnect and re-link the folder.')
      }
    } finally {
      setIsReconnecting(false)
    }
  }, [dirHandle, isReconnecting, saveFolderHandleToProject, verifyPermission])

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
    const lines = textBeforeCursor.split('\r\n').length - 1
    
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

  const updateProjectMetadata = useCallback((updates: Partial<Project>) => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      if (stored) {
        const projects = JSON.parse(stored)
        const idx = projects.findIndex((p: any) => p.id === projectId)
        if (idx >= 0) {
          const updatedProject = {
            ...projects[idx],
            ...updates,
            lastUpdated: Date.now()
          }
          projects[idx] = updatedProject
          localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(projects))
          
          // Save to cloud in background
          saveProjectToCloud(user.uid, updatedProject)
        }
      }
    } catch (e) {
      console.error("Failed to update project metadata:", e)
    }
  }, [user, projectId])

  const persistVolumes = useCallback((nextVolumes: ManuscriptVolume[]) => {
    const key = getVolumesStorageKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(nextVolumes))
    setVolumes(nextVolumes)
    updateProjectMetadata({ volumes: nextVolumes })
  }, [getVolumesStorageKey, updateProjectMetadata])

  const fetchVolumes = useCallback(() => {
    if (!projectId) return
    try {
      let storedVolumes = localStorage.getItem(getVolumesStorageKey())
      if (!storedVolumes && user) {
        const storedProjs = localStorage.getItem(`penpad_projects_${user.uid}`)
        if (storedProjs) {
          const projects = JSON.parse(storedProjs)
          const project = projects.find((p: any) => p.id === projectId)
          if (project && project.volumes) {
            storedVolumes = JSON.stringify(project.volumes)
            localStorage.setItem(getVolumesStorageKey(), storedVolumes)
          }
        }
      }

      const volumeList: ManuscriptVolume[] = storedVolumes
        ? JSON.parse(storedVolumes).map((volume: ManuscriptVolume) => ({ ...volume, isOpen: volume.isOpen !== false }))
        : []
      setVolumes(volumeList.sort((a, b) => a.sortOrder - b.sortOrder))

      const storedCollapsed = localStorage.getItem(getCollapsedVolumesStorageKey())
      const collapsedList: string[] = storedCollapsed ? JSON.parse(storedCollapsed) : []
      setCollapsedVolumeIds(new Set(collapsedList))

      getExportHistoryLocal(projectId).then(indexedDbHistory => {
        let history = indexedDbHistory
        if (!history) {
          const storedHistory = localStorage.getItem(getExportHistoryStorageKey())
          history = storedHistory ? JSON.parse(storedHistory) : {}
          if (history && Object.keys(history).length > 0) {
            saveExportHistoryLocal(projectId, history).catch(err =>
              console.error("Failed to migrate export history to IndexedDB:", err)
            )
          }
        }
        setExportHistory(history || {})
        savedFilenamesRef.current = new Map(Object.entries(history || {}).map(([chapterId, record]) => [chapterId, record.filename]))
        setSavedChapters(new Set(Object.keys(history || {})))
      }).catch(err => {
        console.error("Failed to load export history from IndexedDB:", err)
        const storedHistory = localStorage.getItem(getExportHistoryStorageKey())
        const history: Record<string, ExportHistoryRecord> = storedHistory ? JSON.parse(storedHistory) : {}
        setExportHistory(history)
        savedFilenamesRef.current = new Map(Object.entries(history).map(([chapterId, record]) => [chapterId, record.filename]))
        setSavedChapters(new Set(Object.keys(history)))
      })
    } catch (e) {
      console.error("Failed to load volume or export history:", e)
      setVolumes([])
      setCollapsedVolumeIds(new Set())
      setExportHistory({})
    }
  }, [user, projectId, getVolumesStorageKey, getCollapsedVolumesStorageKey, getExportHistoryStorageKey])

  const persistProgressionProfiles = useCallback((nextProfiles: CharacterProgressionProfile[]) => {
    if (!projectId) return
    const key = getProgressionStorageKey()
    if (!key) return
    const sorted = [...nextProfiles].sort((a, b) => b.updatedAt - a.updatedAt)
    localStorage.setItem(key, JSON.stringify(sorted))
    setProgressionProfiles(sorted)
    updateProjectMetadata({ progressionProfiles: sorted })
    if (user) {
      sorted.forEach(profile => {
        saveProgressionProfileToCloud(user.uid, projectId, profile)
      })
    }
  }, [getProgressionStorageKey, updateProjectMetadata, user, projectId])

  const normalizeProgressionSystem = useCallback((settings?: Partial<ProgressionSystemSettings>): ProgressionSystemSettings => {
    const validStatKeys = new Set(Object.keys(DEFAULT_PROGRESSION_STATS))
    const allowEmptyTemplate = settings?.allowEmptyTemplate === true
    const incomingCards = Array.isArray(settings?.profileTemplate?.cards)
      ? settings.profileTemplate.cards
      : DEFAULT_PROFILE_TEMPLATE_CARDS
    const templateCards = allowEmptyTemplate && incomingCards.length === 0
      ? []
      : incomingCards.length > 0
      ? incomingCards
      : DEFAULT_PROFILE_TEMPLATE_CARDS
    const rawTemplate = {
      ...DEFAULT_PROFILE_TEMPLATE,
      ...(settings?.profileTemplate || {}),
      cards: templateCards
    }
    const normalizedCustomFields = Array.isArray(settings?.customFields)
      ? Array.from(new Set(settings.customFields.map(item => String(item).trim()).filter(Boolean)))
      : DEFAULT_PROGRESSION_SYSTEM.customFields
    const templateCustomFields = allowEmptyTemplate && templateCards.length === 0
      ? []
      : normalizedCustomFields
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
        rawTemplate.cards,
        templateCustomFields
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
      customFields: templateCustomFields,
      profileTemplate: normalizedTemplate,
      notes: settings?.notes || DEFAULT_PROGRESSION_SYSTEM.notes,
      useCustomJsonTemplate: settings?.useCustomJsonTemplate === true,
      customJsonTemplate: settings?.customJsonTemplate || DEFAULT_PROGRESSION_SYSTEM.customJsonTemplate,
      jsonCardOrder: settings?.jsonCardOrder || DEFAULT_PROGRESSION_SYSTEM.jsonCardOrder,
      cultivationSourceText: typeof settings?.cultivationSourceText === "string" ? settings.cultivationSourceText.slice(0, 20000) : "",
      cultivationGuide: typeof settings?.cultivationGuide === "string" ? settings.cultivationGuide.slice(0, 4000) : "",
      allowEmptyTemplate,
      showLevels: false,
      showExp: false,
      showStats: false
    }
  }, [normalizeProgressionTemplateCards])

  const persistProgressionSystem = useCallback((nextSettings: ProgressionSystemSettings) => {
    if (!projectId) return
    const key = getProgressionSystemStorageKey()
    if (!key) return
    const normalized = normalizeProgressionSystem({ ...nextSettings, updatedAt: Date.now() })
    localStorage.setItem(key, JSON.stringify(normalized))
    setProgressionSystem(normalized)
    updateProjectMetadata({ progressionSystem: normalized })
    if (user) {
      saveProgressionSystemToCloud(user.uid, projectId, normalized)
    }
  }, [getProgressionSystemStorageKey, normalizeProgressionSystem, updateProjectMetadata, user, projectId])

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

  const getJsonBuilderKey = useCallback((label: string) => {
    const words = String(label || "field")
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
    if (words.length === 0) return "field"
    return words
      .map((word, index) => {
        const clean = word.toLowerCase()
        return index === 0 ? clean : `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`
      })
      .join("")
  }, [])

  const getUniqueJsonBuilderKey = useCallback((label: string, usedKeys: Set<string>) => {
    const baseKey = getJsonBuilderKey(label)
    let candidate = baseKey
    let suffix = 2
    while (usedKeys.has(candidate)) {
      candidate = `${baseKey}${suffix}`
      suffix += 1
    }
    usedKeys.add(candidate)
    return candidate
  }, [getJsonBuilderKey])

  const getJsonTemplateFieldKind = useCallback((value: any): ProgressionJsonTemplateFieldKind => {
    if (Array.isArray(value)) return "list"
    if (value && typeof value === "object") return "object"
    if (typeof value === "number") return "number"
    if (typeof value === "boolean") return "boolean"
    return "text"
  }, [])

  const getJsonTemplateDefaultValue = useCallback((kind: ProgressionJsonTemplateFieldKind, label = ""): any => {
    if (kind === "number") return 0
    if (kind === "boolean") return false
    if (kind === "list") return label ? [label] : []
    if (kind === "object") return { value: "" }
    return ""
  }, [])

  const getJsonTemplateValueForCard = useCallback((card: ProgressionTemplateCard) => {
    const fieldNames = card.fields.length > 0 ? card.fields : [card.label]
    const fieldObject = fieldNames.reduce<Record<string, any>>((acc, fieldName) => {
      const fieldKey = getJsonBuilderKey(fieldName)
      acc[fieldKey] = card.type === "counter" || card.type === "stat" ? 0 : ""
      return acc
    }, {})

    if (card.type === "ability") {
      return [{
        name: "",
        rank: "",
        description: ""
      }]
    }
    if (card.type === "counter" || card.type === "stat") return fieldNames.length > 1 ? fieldObject : 0
    if (card.type === "progress" || card.type === "resource") {
      return {
        ...fieldObject,
        current: 0,
        max: 100
      }
    }
    if (card.type === "rank" || card.type === "compound" || fieldNames.length > 1) return fieldObject
    return ""
  }, [getJsonBuilderKey])

  const parseProgressionJsonTemplate = useCallback((): Record<string, any> => {
    if (!progressionSystem.customJsonTemplate?.trim()) return {}
    try {
      const parsed = JSON.parse(progressionSystem.customJsonTemplate)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }, [progressionSystem.customJsonTemplate])

  const getOrderedJsonTemplateKeys = useCallback((template: Record<string, any>) => {
    const keys = Object.keys(template)
    const order = progressionSystem.jsonCardOrder || []
    return [
      ...order.filter(key => keys.includes(key)),
      ...keys.filter(key => !order.includes(key))
    ]
  }, [progressionSystem.jsonCardOrder])

  const persistJsonTemplateBuilder = useCallback((template: Record<string, any>, order?: string[]) => {
    const nextKeys = Object.keys(template)
    const nextOrder = order
      ? order.filter(key => nextKeys.includes(key))
      : getOrderedJsonTemplateKeys(template)
    nextKeys.forEach(key => {
      if (!nextOrder.includes(key)) nextOrder.push(key)
    })
    persistProgressionSystem({
      ...progressionSystem,
      useCustomJsonTemplate: true,
      customJsonTemplate: JSON.stringify(template, null, 2),
      jsonCardOrder: nextOrder
    })
  }, [getOrderedJsonTemplateKeys, persistProgressionSystem, progressionSystem])

  const convertProgressionCardsToJsonTemplate = useCallback(() => {
    const cards = normalizeProgressionTemplateCards(progressionSystem.profileTemplate.cards, progressionSystem.customFields)
      .filter(card => card.enabled)
    const usedKeys = new Set<string>()
    const starterTemplate: Record<string, any> = {}
    const cardOrder: string[] = []

    cards.forEach(card => {
      const key = getUniqueJsonBuilderKey(card.sourceKey || card.label, usedKeys)
      starterTemplate[key] = getJsonTemplateValueForCard(card)
      cardOrder.push(key)
    })

    persistProgressionSystem({
      ...progressionSystem,
      useCustomJsonTemplate: true,
      customJsonTemplate: JSON.stringify(starterTemplate, null, 2),
      jsonCardOrder: cardOrder
    })
    setProgressionNotice(`Converted ${cardOrder.length} profile template cards into a starter JSON template.`)
  }, [getJsonTemplateValueForCard, getUniqueJsonBuilderKey, normalizeProgressionTemplateCards, persistProgressionSystem, progressionSystem])

  const addJsonTemplateField = useCallback(() => {
    const template = parseProgressionJsonTemplate()
    const usedKeys = new Set(Object.keys(template))
    const key = getUniqueJsonBuilderKey(progressionJsonNewKey || "newField", usedKeys)
    const order = getOrderedJsonTemplateKeys(template)
    template[key] = getJsonTemplateDefaultValue(progressionJsonNewKind, progressionJsonNewKey)
    persistJsonTemplateBuilder(template, [...order, key])
    setProgressionJsonNewKey("")
  }, [getJsonTemplateDefaultValue, getOrderedJsonTemplateKeys, getUniqueJsonBuilderKey, parseProgressionJsonTemplate, persistJsonTemplateBuilder, progressionJsonNewKey, progressionJsonNewKind])

  const renameJsonTemplateField = useCallback((oldKey: string, rawKey: string) => {
    const nextKey = getJsonBuilderKey(rawKey)
    if (!nextKey || nextKey === oldKey) return
    const template = parseProgressionJsonTemplate()
    if (!(oldKey in template) || nextKey in template) return
    const order = getOrderedJsonTemplateKeys(template).map(key => key === oldKey ? nextKey : key)
    const nextTemplate: Record<string, any> = {}
    Object.keys(template).forEach(key => {
      nextTemplate[key === oldKey ? nextKey : key] = template[key]
    })
    persistJsonTemplateBuilder(nextTemplate, order)
  }, [getJsonBuilderKey, getOrderedJsonTemplateKeys, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const updateJsonTemplateFieldKind = useCallback((key: string, kind: ProgressionJsonTemplateFieldKind) => {
    const template = parseProgressionJsonTemplate()
    template[key] = getJsonTemplateDefaultValue(kind, key)
    persistJsonTemplateBuilder(template)
  }, [getJsonTemplateDefaultValue, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const updateJsonTemplatePrimitiveValue = useCallback((key: string, value: string | boolean, kind: ProgressionJsonTemplateFieldKind) => {
    const template = parseProgressionJsonTemplate()
    template[key] = kind === "number" ? Number(value) || 0 : kind === "boolean" ? Boolean(value) : value
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const removeJsonTemplateField = useCallback((key: string) => {
    const template = parseProgressionJsonTemplate()
    delete template[key]
    persistJsonTemplateBuilder(template, getOrderedJsonTemplateKeys(template).filter(item => item !== key))
  }, [getOrderedJsonTemplateKeys, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const reorderJsonTemplateField = useCallback((key: string, direction: 'up' | 'down') => {
    const template = parseProgressionJsonTemplate()
    const order = getOrderedJsonTemplateKeys(template)
    const index = order.indexOf(key)
    if (index < 0) return
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= order.length) return
    const nextOrder = [...order]
    const temp = nextOrder[index]
    nextOrder[index] = nextOrder[targetIndex]
    nextOrder[targetIndex] = temp
    persistJsonTemplateBuilder(template, nextOrder)
  }, [getOrderedJsonTemplateKeys, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const addJsonTemplateObjectField = useCallback((parentKey: string) => {
    const template = parseProgressionJsonTemplate()
    const parent = template[parentKey] && typeof template[parentKey] === "object" && !Array.isArray(template[parentKey])
      ? { ...template[parentKey] }
      : {}
    const fieldKey = getUniqueJsonBuilderKey("field", new Set(Object.keys(parent)))
    parent[fieldKey] = ""
    template[parentKey] = parent
    persistJsonTemplateBuilder(template)
  }, [getUniqueJsonBuilderKey, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const renameJsonTemplateObjectField = useCallback((parentKey: string, oldFieldKey: string, rawKey: string) => {
    const nextFieldKey = getJsonBuilderKey(rawKey)
    if (!nextFieldKey || nextFieldKey === oldFieldKey) return
    const template = parseProgressionJsonTemplate()
    const parent = template[parentKey] && typeof template[parentKey] === "object" && !Array.isArray(template[parentKey])
      ? template[parentKey] as Record<string, any>
      : {}
    if (!(oldFieldKey in parent) || nextFieldKey in parent) return
    const nextParent: Record<string, any> = {}
    Object.keys(parent).forEach(key => {
      nextParent[key === oldFieldKey ? nextFieldKey : key] = parent[key]
    })
    template[parentKey] = nextParent
    persistJsonTemplateBuilder(template)
  }, [getJsonBuilderKey, parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const updateJsonTemplateObjectValue = useCallback((parentKey: string, fieldKey: string, value: string) => {
    const template = parseProgressionJsonTemplate()
    const parent = template[parentKey] && typeof template[parentKey] === "object" && !Array.isArray(template[parentKey])
      ? { ...template[parentKey] }
      : {}
    parent[fieldKey] = value
    template[parentKey] = parent
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const removeJsonTemplateObjectField = useCallback((parentKey: string, fieldKey: string) => {
    const template = parseProgressionJsonTemplate()
    const parent = template[parentKey] && typeof template[parentKey] === "object" && !Array.isArray(template[parentKey])
      ? { ...template[parentKey] }
      : {}
    delete parent[fieldKey]
    template[parentKey] = parent
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const addJsonTemplateListItem = useCallback((key: string) => {
    const template = parseProgressionJsonTemplate()
    const list = Array.isArray(template[key]) ? [...template[key]] : []
    list.push("")
    template[key] = list
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const updateJsonTemplateListItem = useCallback((key: string, index: number, value: string) => {
    const template = parseProgressionJsonTemplate()
    const list = Array.isArray(template[key]) ? [...template[key]] : []
    list[index] = value
    template[key] = list
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const removeJsonTemplateListItem = useCallback((key: string, index: number) => {
    const template = parseProgressionJsonTemplate()
    const list = Array.isArray(template[key]) ? [...template[key]] : []
    template[key] = list.filter((_, itemIndex) => itemIndex !== index)
    persistJsonTemplateBuilder(template)
  }, [parseProgressionJsonTemplate, persistJsonTemplateBuilder])

  const fetchProgressionSystem = useCallback(async () => {
    if (!projectId) return
    try {
      let stored = localStorage.getItem(getProgressionSystemStorageKey())
      if (!stored && user) {
        const storedProjs = localStorage.getItem(`penpad_projects_${user.uid}`)
        if (storedProjs) {
          const projects = JSON.parse(storedProjs)
          const project = projects.find((p: any) => p.id === projectId)
          if (project && project.progressionSystem) {
            stored = JSON.stringify(project.progressionSystem)
            localStorage.setItem(getProgressionSystemStorageKey(), stored)
          }
        }
      }
      const localSystem = normalizeProgressionSystem(stored ? JSON.parse(stored) : undefined)
      setProgressionSystem(localSystem)
      if (user) {
        const synced = await syncProgressionSystemWithCloud(user.uid, projectId, localSystem)
        if (JSON.stringify(synced) !== JSON.stringify(localSystem)) {
          const normalizedSynced = normalizeProgressionSystem(synced as Partial<ProgressionSystemSettings>)
          setProgressionSystem(normalizedSynced)
          localStorage.setItem(getProgressionSystemStorageKey(), JSON.stringify(normalizedSynced))
          updateProjectMetadata({ progressionSystem: normalizedSynced })
        }
      }
    } catch (e) {
      console.error("Failed to load progression system:", e)
      setProgressionSystem(DEFAULT_PROGRESSION_SYSTEM)
    }
  }, [user, projectId, getProgressionSystemStorageKey, normalizeProgressionSystem, updateProjectMetadata])

  const fetchProgressionProfiles = useCallback(async () => {
    if (!projectId) return
    try {
      let stored = localStorage.getItem(getProgressionStorageKey())
      if (!stored && user) {
        const storedProjs = localStorage.getItem(`penpad_projects_${user.uid}`)
        if (storedProjs) {
          const projects = JSON.parse(storedProjs)
          const project = projects.find((p: any) => p.id === projectId)
          if (project && project.progressionProfiles) {
            stored = JSON.stringify(project.progressionProfiles)
            localStorage.setItem(getProgressionStorageKey(), stored)
          }
        }
      }
      const profiles: CharacterProgressionProfile[] = stored ? JSON.parse(stored) : []
      const normalized = profiles.map(profile => {
        const jsonData = profile.customJsonData && typeof profile.customJsonData === "object" ? profile.customJsonData as Record<string, any> : {}
        const jsonCultivation = jsonData.cultivation && typeof jsonData.cultivation === "object" ? jsonData.cultivation as Record<string, any> : {}
        const customFields = sanitizeSimpleProgressionCustomFields({
          Bloodline: jsonData.bloodline || jsonData.Bloodline || "",
          "Bloodline Rank": jsonData.bloodlineRank || jsonData["Bloodline Rank"] || jsonData.bloodlineGrade || "",
          "Affinity Names": jsonData.affinity || jsonData.affinities || jsonData["Affinity Names"] || "",
          "Affinity Rank": jsonData.affinityRank || jsonData["Affinity Rank"] || jsonData.affinityGrade || "",
          "Secondary Class": jsonData.secondaryClass || jsonData["Secondary Class"] || jsonData.subclass || "",
          Race: jsonData.race || jsonData.Race || "",
          Affiliation: jsonData.affiliation || jsonData.Affiliation || "",
          ...(profile.customFields && typeof profile.customFields === "object" ? profile.customFields : {})
        })
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

        const finalJsonData = (() => {
          const baseJson = {
            ...(() => {
              if (progressionSystem.useCustomJsonTemplate && progressionSystem.customJsonTemplate) {
                try {
                  return JSON.parse(progressionSystem.customJsonTemplate)
                } catch {}
              }
              return {}
            })(),
            ...jsonData
          }
          if (progressionSystem.useCustomJsonTemplate) {
            return fillEmptyCustomJsonData(baseJson, {
              name: profile.name || String(jsonData.name || ""),
              title: profile.title || String(jsonData.title || ""),
              className: profile.className || String(jsonData.mainClass || jsonData["Main Class"] || jsonData.class || jsonData.className || ""),
              realm: profile.realm || String(jsonCultivation.realm || jsonCultivation.stage || jsonData.realm || ""),
              stage: profile.stage || String(jsonCultivation.rank || jsonCultivation.subRank || jsonData.stage || jsonData.rank || ""),
              rank: profile.rank || "",
              level: Number.isFinite(Number(profile.level)) ? Number(profile.level) : 1,
              exp: Number.isFinite(Number(profile.exp)) ? Number(profile.exp) : 0,
              nextLevelExp: Number.isFinite(Number(profile.nextLevelExp)) ? Number(profile.nextLevelExp) : 100,
              abilities: migratedAbilities,
              customFields,
              stats: { ...DEFAULT_PROGRESSION_STATS, ...(profile.stats || {}) }
            })
          }
          return baseJson
        })()

        return {
          ...profile,
          customJsonData: finalJsonData,
          title: profile.title || String(jsonData.title || ""),
          className: profile.className || String(jsonData.mainClass || jsonData["Main Class"] || jsonData.class || jsonData.className || ""),
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
      if (user) {
        const synced = await syncProgressionProfilesWithCloud(user.uid, projectId, normalized)
        const syncedStr = JSON.stringify(synced)
        const localStr = JSON.stringify(normalized)
        if (syncedStr !== localStr) {
          const reNormalized = (synced as CharacterProgressionProfile[]).map(profile => {
            const jsonData = profile.customJsonData && typeof profile.customJsonData === "object" ? profile.customJsonData as Record<string, any> : {}
            const customFields = sanitizeSimpleProgressionCustomFields({
              Bloodline: jsonData.bloodline || jsonData.Bloodline || "",
              "Bloodline Rank": jsonData.bloodlineRank || jsonData["Bloodline Rank"] || jsonData.bloodlineGrade || "",
              "Affinity Names": jsonData.affinity || jsonData.affinities || jsonData["Affinity Names"] || "",
              "Affinity Rank": jsonData.affinityRank || jsonData["Affinity Rank"] || jsonData.affinityGrade || "",
              "Secondary Class": jsonData.secondaryClass || jsonData["Secondary Class"] || jsonData.subclass || "",
              Race: jsonData.race || jsonData.Race || "",
              Affiliation: jsonData.affiliation || jsonData.Affiliation || "",
              ...(profile.customFields && typeof profile.customFields === "object" ? profile.customFields : {})
            })
            return {
              ...profile,
              stats: { ...DEFAULT_PROGRESSION_STATS, ...(profile.stats || {}) },
              traits: Array.isArray(profile.traits) ? profile.traits : [],
              nicknames: Array.isArray(profile.nicknames) ? profile.nicknames : [],
              uniqueTrait: profile.uniqueTrait || "",
              customFields,
              notes: profile.notes || String(jsonData.lore || jsonData.notes || ""),
              processedChapterIds: Array.isArray(profile.processedChapterIds) ? profile.processedChapterIds : [],
              history: Array.isArray(profile.history) ? profile.history : []
            }
          }).sort((a, b) => b.updatedAt - a.updatedAt)
          setProgressionProfiles(reNormalized)
          localStorage.setItem(getProgressionStorageKey(), JSON.stringify(reNormalized))
          updateProjectMetadata({ progressionProfiles: reNormalized })
        }
      }
    } catch (e) {
      console.error("Failed to load progression profiles:", e)
      setProgressionProfiles([])
    }
  }, [user, projectId, getProgressionStorageKey, selectedProgressionProfileId, progressionSystem, updateProjectMetadata])

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
      if (noteList.length > 0 && !activeNoteIdRef.current) {
        setActiveNoteId(noteList[0].id)
      }
      
      const syncedNotes = await syncChaptersWithCloud(user.uid, projectId, noteList)
      const orderedSyncedNotes = syncedNotes.sort((a: Note, b: Note) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
      setNotes(orderedSyncedNotes)
      if (syncedNotes.length > 0 && !activeNoteIdRef.current) {
        setActiveNoteId(orderedSyncedNotes[0].id)
      }
    } catch (e) {
      console.error("Fetch/Sync notes failed:", e)
    } finally {
      setIsLoadingNotes(false)
    }
  }, [user, projectId])

  // World Bible Logic
  const persistBibleGroups = useCallback((nextGroups: StoryBibleGroup[]) => {
    const key = getBibleGroupsStorageKey()
    if (!key) return
    const sorted = nextGroups.sort((a, b) => a.sortOrder - b.sortOrder)
    localStorage.setItem(key, JSON.stringify(sorted))
    setBibleGroups(sorted)
    updateProjectMetadata({ bibleGroups: sorted })
  }, [getBibleGroupsStorageKey, updateProjectMetadata])

  const fetchBible = useCallback(async () => {
    if (!user || !projectId) return
    try {
      let storedGroups = localStorage.getItem(getBibleGroupsStorageKey())
      if (!storedGroups) {
        const storedProjs = localStorage.getItem(`penpad_projects_${user.uid}`)
        if (storedProjs) {
          const projects = JSON.parse(storedProjs)
          const project = projects.find((p: any) => p.id === projectId)
          if (project && project.bibleGroups) {
            storedGroups = JSON.stringify(project.bibleGroups)
            localStorage.setItem(getBibleGroupsStorageKey(), storedGroups)
          }
        }
      }
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

  const normalizeNameForCompare = (name: string) => {
    try {
      return name.normalize("NFKC").toLocaleLowerCase().replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), "")
    } catch {
      return name.toLocaleLowerCase().replace(/\s+/g, "")
    }
  }

  const makePhoneticKey = (name: string): string => {
    return name
      .toLocaleLowerCase()
      .replace(/[^a-z]/g, "")
      .replace(/[aeiouy]/g, "")
      .replace(/(.)\1+/g, "$1")
      .slice(0, 8)
  }

  const isPhoneticDuplicate = (name: string, existing: string[]): boolean => {
    const key = makePhoneticKey(name)
    if (!key) return false
    return existing.some(ex => makePhoneticKey(ex) === key)
  }

  const generateNameOptions = async (append = false) => {
    if (nameGenerateLoading) return
    setNameGenerateLoading(true)
    setNameGenerateError("")
    if (!append) setAcceptedNameId(null)

    try {
      const existingNameSet = new Set(bibleEntries.map(entry => normalizeNameForCompare(entry.name)).filter(Boolean))
      const existingPhoneticKeys = bibleEntries.map(entry => makePhoneticKey(entry.name)).filter(Boolean)
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "name_generate",
          nameStyle,
          nameStyle2: nameStyle2 || undefined,
          nameCategory,
          nameStructure,
          nameTone,
          nameGender,
          nameSyllableBank: nameSyllableBank || undefined,
          customPrompt: nameCustomPrompt,
          bibleEntries,
          count: 5,
          chapterTitle: activeNote?.title || "",
          chapterContent: activeNote?.content || ""
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate names")

      const uniqueNames: GeneratedNameOption[] = []
      for (const option of Array.isArray(data.names) ? data.names : []) {
        const name = String(option.name || "").trim()
        const normalized = normalizeNameForCompare(name)
        if (!name || !normalized) continue
        if (existingNameSet.has(normalized)) continue
        if (isPhoneticDuplicate(name, existingPhoneticKeys)) continue
        if (!append && uniqueNames.some(item => normalizeNameForCompare(item.name) === normalized)) continue
        if (append && generatedNames.some(item => normalizeNameForCompare(item.name) === normalized)) continue
        uniqueNames.push({
          name,
          category: ["character", "world", "beast", "place", "item"].includes(String(option.category)) ? option.category : nameCategory,
          style: String(option.style || nameStyle).trim(),
          raceOrOrigin: String(option.raceOrOrigin || "").trim(),
          structure: String(option.structure || nameStructure).trim(),
          meaning: String(option.meaning || "").trim(),
          pronunciation: String(option.pronunciation || "").trim(),
          vibe: String(option.vibe || "").trim(),
          bibleContent: String(option.bibleContent || option.meaning || option.vibe || "").trim()
        })
      }

      const newBatch = uniqueNames.slice(0, 5)
      if (append) {
        setGeneratedNames(prev => [...prev, ...newBatch].slice(0, 50))
      } else {
        setGeneratedNames(newBatch)
      }
      if (newBatch.length === 0) {
        setNameGenerateError("No fresh names came back. Try different settings or reroll.")
      }
    } catch (err) {
      setNameGenerateError(err instanceof Error ? err.message : "Failed to generate names")
      if (!append) setGeneratedNames([])
    } finally {
      setNameGenerateLoading(false)
    }
  }

  const acceptGeneratedName = async (option: GeneratedNameOption) => {
    if (!user || !projectId) return
    const normalized = normalizeNameForCompare(option.name)
    if (bibleEntries.some(entry => normalizeNameForCompare(entry.name) === normalized)) {
      setNameGenerateError(`${option.name} already exists in the World Bible.`)
      return
    }

    const now = Date.now()
    const contentParts = [
      option.bibleContent || `${option.name} is a generated ${option.category} name.`,
      option.meaning ? `Meaning: ${option.meaning}` : "",
      option.pronunciation ? `Pronunciation: ${option.pronunciation}` : "",
      option.raceOrOrigin ? `Origin or race: ${option.raceOrOrigin}` : "",
      option.vibe ? `Vibe: ${option.vibe}` : "",
      `Generated through Name Forge. Style: ${option.style || nameStyle}; structure: ${option.structure || nameStructure}.`
    ].filter(Boolean)
    const newEntry: BibleEntry = {
      id: crypto.randomUUID(),
      name: option.name,
      category: option.category,
      content: contentParts.join("\n\n"),
      createdAt: now,
      updatedAt: now
    }

    try {
      const localEntries = await getStoryBibleLocal(projectId)
      const currentEntries = Array.isArray(localEntries) ? localEntries : bibleEntries
      const withoutDuplicate = currentEntries.filter(entry => normalizeNameForCompare(entry.name) !== normalized)
      const updated = [newEntry, ...withoutDuplicate]
      setBibleEntries(updated)
      await saveStoryBibleLocal(projectId, updated)
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
      setAcceptedNameId(normalized)
      setNameGenerateError("")
    } catch (err) {
      setNameGenerateError(err instanceof Error ? err.message : "Failed to add name to World Bible")
    }
  }

  const acceptGeneratedNameWithLore = async () => {
    if (!loreEditorDraft) return
    await acceptGeneratedName(loreEditorDraft)
    setShowLoreEditor(false)
    setLoreEditorDraft(null)
  }

  const generateNameVariants = async (base: GeneratedNameOption) => {
    if (nameVariantLoading) return
    setNameVariantLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "name_generate",
          nameStyle,
          nameStyle2: nameStyle2 || undefined,
          nameCategory: base.category,
          nameStructure,
          nameTone,
          nameGender,
          customPrompt: `Variants of "${base.name}": similar sound, same vibe, alternative spellings. ${nameCustomPrompt}`,
          bibleEntries,
          count: 5,
          chapterTitle: activeNote?.title || "",
          chapterContent: activeNote?.content || ""
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate variants")
      const names: GeneratedNameOption[] = (Array.isArray(data.names) ? data.names : []).slice(0, 5)
      setGeneratedNames(prev => [...names, ...prev].slice(0, 50))
    } catch (err) {
      setNameGenerateError(err instanceof Error ? err.message : "Failed to generate variants")
    } finally {
      setNameVariantLoading(false)
    }
  }

  const addToShortlist = (option: GeneratedNameOption) => {
    setNameShortlist(prev => {
      if (prev.some(n => normalizeNameForCompare(n.name) === normalizeNameForCompare(option.name))) return prev
      return [option, ...prev]
    })
  }

  const removeFromShortlist = (name: string) => {
    setNameShortlist(prev => prev.filter(n => normalizeNameForCompare(n.name) !== normalizeNameForCompare(name)))
  }

  const batchAddToBible = async () => {
    if (!user || !projectId) return
    const indices = Array.from(selectedForBatch)
    for (let i = 0; i < indices.length; i++) {
      const option = generatedNames[indices[i]]
      if (option) await acceptGeneratedName(option)
    }
    setSelectedForBatch(new Set())
  }

  const toggleBatchSelect = (idx: number) => {
    setSelectedForBatch(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const insertNameAtCursor = (e: React.MouseEvent, name: string) => {
    e.preventDefault()
    insertAtCursor(name)
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

  const updateActiveBibleCharacterDetails = (updates: Partial<NonNullable<BibleEntry["characterDetails"]>>) => {
    if (!activeBibleEntry) return
    updateActiveBibleEntry({
      characterDetails: {
        ...getBibleCharacterDetails(activeBibleEntry),
        ...updates,
        updatedAt: Date.now()
      }
    })
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

  const getBibleTimelineFacts = (entry: BibleEntry): BibleTimelineFact[] => {
    const rawFacts = Array.isArray(entry.timelineFacts) ? entry.timelineFacts : []
    return rawFacts
      .filter((fact): fact is BibleTimelineFact => Boolean(fact) && typeof fact === "object")
      .map((fact, index) => ({
        id: String(fact.id || `${entry.id}-timeline-${index}`),
        chapterId: String(fact.chapterId || ""),
        chapterTitle: String(fact.chapterTitle || "Untitled"),
        chapterNumber: Number.isFinite(Number(fact.chapterNumber)) ? Number(fact.chapterNumber) : null,
        summary: String(fact.summary || "").trim(),
        evidence: String(fact.evidence || "").trim(),
        status: String(fact.status || "").trim(),
        createdAt: Number.isFinite(Number(fact.createdAt)) ? Number(fact.createdAt) : entry.updatedAt || Date.now()
      }))
      .filter(fact => fact.summary)
      .sort((a, b) => {
        const aChapter = Number(a.chapterNumber || 0)
        const bChapter = Number(b.chapterNumber || 0)
        if (aChapter !== bChapter) return aChapter - bChapter
        return a.createdAt - b.createdAt
      })
  }

  const getBibleFactChapterLabel = (fact: Pick<BibleTimelineFact, "chapterNumber" | "chapterTitle">) => {
    if (fact.chapterNumber) return `Chapter ${fact.chapterNumber}`
    return fact.chapterTitle || "Unknown chapter"
  }

  const appendBibleTimelineFact = (entry: BibleEntry, fact: Omit<BibleTimelineFact, "id" | "createdAt">): BibleEntry => {
    const now = Date.now()
    const nextFact: BibleTimelineFact = {
      ...fact,
      id: crypto.randomUUID(),
      createdAt: now
    }
    const existingFacts = getBibleTimelineFacts(entry)
    const isDuplicate = existingFacts.some(existing =>
      existing.chapterId === nextFact.chapterId &&
      existing.summary.toLowerCase() === nextFact.summary.toLowerCase()
    )
    return {
      ...entry,
      timelineFacts: isDuplicate ? existingFacts : [...existingFacts, nextFact],
      updatedAt: now
    }
  }

  const getBibleCharacterDetails = (entry: BibleEntry) => {
    const details = entry.characterDetails || {}
    const chapterAppearances = Array.isArray(details.chapterAppearances)
      ? details.chapterAppearances
          .filter(fact => fact && typeof fact === "object" && String(fact.summary || "").trim())
          .map((fact, index) => ({
            id: String(fact.id || `${entry.id}-appearance-${index}`),
            chapterId: String(fact.chapterId || ""),
            chapterTitle: String(fact.chapterTitle || "Untitled"),
            chapterNumber: Number.isFinite(Number(fact.chapterNumber)) ? Number(fact.chapterNumber) : null,
            summary: String(fact.summary || "").trim(),
            evidence: String(fact.evidence || "").trim(),
            appearance: String(fact.appearance || "").trim(),
            attire: String(fact.attire || "").trim(),
            hair: String(fact.hair || "").trim(),
            eyes: String(fact.eyes || "").trim(),
            body: String(fact.body || "").trim(),
            distinguishingFeatures: String(fact.distinguishingFeatures || "").trim(),
            createdAt: Number.isFinite(Number(fact.createdAt)) ? Number(fact.createdAt) : entry.updatedAt || Date.now()
          }))
          .sort((a, b) => {
            const aChapter = Number(a.chapterNumber || 0)
            const bChapter = Number(b.chapterNumber || 0)
            if (aChapter !== bChapter) return aChapter - bChapter
            return a.createdAt - b.createdAt
          })
      : []

    return {
      appearance: String(details.appearance || "").trim(),
      attire: String(details.attire || "").trim(),
      hair: String(details.hair || "").trim(),
      eyes: String(details.eyes || "").trim(),
      body: String(details.body || "").trim(),
      distinguishingFeatures: String(details.distinguishingFeatures || "").trim(),
      chapterAppearances,
      updatedAt: Number.isFinite(Number(details.updatedAt)) ? Number(details.updatedAt) : undefined
    }
  }

  const mergeBibleCharacterDetails = (
    entry: BibleEntry,
    suggestion: BibleExtractionSuggestion,
    chapter: { id: string; title: string; chapterNumber?: number | null }
  ): BibleEntry => {
    if (entry.category !== "character" && entry.category !== "beast") return entry
    const incoming = suggestion.characterDetails
    if (!incoming) return entry

    const now = Date.now()
    const existing = getBibleCharacterDetails(entry)
    const nextDetails = {
      ...existing,
      appearance: incoming.appearance || existing.appearance,
      attire: incoming.attire || existing.attire,
      hair: incoming.hair || existing.hair,
      eyes: incoming.eyes || existing.eyes,
      body: incoming.body || existing.body,
      distinguishingFeatures: incoming.distinguishingFeatures || existing.distinguishingFeatures,
      updatedAt: now
    }

    const chapterAppearance = incoming.chapterAppearance
    const chapterSummary = String(chapterAppearance?.summary || suggestion.summary || "").trim()
    if (chapterSummary) {
      const nextAppearanceFact = {
        id: crypto.randomUUID(),
        chapterId: chapter.id,
        chapterTitle: chapter.title || "Untitled",
        chapterNumber: chapter.chapterNumber ?? null,
        summary: chapterSummary,
        evidence: String(chapterAppearance?.evidence || suggestion.timelineFact?.evidence || "").trim(),
        appearance: String(chapterAppearance?.appearance || incoming.appearance || "").trim(),
        attire: String(chapterAppearance?.attire || incoming.attire || "").trim(),
        hair: String(chapterAppearance?.hair || incoming.hair || "").trim(),
        eyes: String(chapterAppearance?.eyes || incoming.eyes || "").trim(),
        body: String(chapterAppearance?.body || incoming.body || "").trim(),
        distinguishingFeatures: String(chapterAppearance?.distinguishingFeatures || incoming.distinguishingFeatures || "").trim(),
        createdAt: now
      }
      const isDuplicate = existing.chapterAppearances.some(fact =>
        fact.chapterId === nextAppearanceFact.chapterId &&
        fact.summary.toLowerCase() === nextAppearanceFact.summary.toLowerCase()
      )
      nextDetails.chapterAppearances = isDuplicate
        ? existing.chapterAppearances
        : [...existing.chapterAppearances, nextAppearanceFact]
    }

    return {
      ...entry,
      characterDetails: nextDetails,
      updatedAt: now
    }
  }

  const scanChapterForBibleSuggestions = async () => {
    if (!activeNote || bibleExtractLoading) return
    setBibleExtractLoading(true)
    setBibleExtractionSuggestions([])
    try {
      const chapterNumber = getNoteChapterNumber(activeNote)
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bible_extract_from_chapter",
          chapterContent: activeNote.content,
          chapterTitle: activeNote.title,
          chapterNumber,
          bibleEntries
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to extract Bible suggestions")
      setBibleExtractionSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to extract Bible suggestions")
    } finally {
      setBibleExtractLoading(false)
    }
  }

  const approveBibleExtractionSuggestion = async (suggestion: BibleExtractionSuggestion) => {
    if (!projectId || !activeNote) return
    const now = Date.now()
    const chapterNumber = getNoteChapterNumber(activeNote)
    const matchedEntry = suggestion.matchedEntryId
      ? bibleEntries.find(entry => entry.id === suggestion.matchedEntryId)
      : bibleEntries.find(entry => entry.name.toLowerCase() === suggestion.entryName.toLowerCase())

    const timelineFact = {
      chapterId: activeNote.id,
      chapterTitle: activeNote.title || "Untitled",
      chapterNumber,
      summary: suggestion.timelineFact?.summary || suggestion.summary,
      evidence: suggestion.timelineFact?.evidence || "",
      status: suggestion.timelineFact?.status || ""
    }

    let nextEntry: BibleEntry
    if (matchedEntry) {
      const contentPatch = suggestion.contentPatch.trim()
      const nextContent = contentPatch && !matchedEntry.content.includes(contentPatch)
        ? `${matchedEntry.content || ""}${matchedEntry.content ? "\r\n\r\n" : ""}### Chapter ${chapterNumber || "Update"} Update\r\n${contentPatch}`.trim()
        : matchedEntry.content
      nextEntry = appendBibleTimelineFact({
        ...matchedEntry,
        content: nextContent,
        updatedAt: now
      }, timelineFact)
      nextEntry = mergeBibleCharacterDetails(nextEntry, suggestion, {
        id: activeNote.id,
        title: activeNote.title || "Untitled",
        chapterNumber
      })
    } else {
      nextEntry = appendBibleTimelineFact({
        id: crypto.randomUUID(),
        name: suggestion.entryName,
        category: suggestion.category || "world",
        content: suggestion.contentPatch || suggestion.summary,
        createdAt: now,
        updatedAt: now
      }, timelineFact)
      nextEntry = mergeBibleCharacterDetails(nextEntry, suggestion, {
        id: activeNote.id,
        title: activeNote.title || "Untitled",
        chapterNumber
      })
    }

    const nextEntries = matchedEntry
      ? bibleEntries.map(entry => entry.id === nextEntry.id ? nextEntry : entry)
      : [nextEntry, ...bibleEntries]

    setBibleEntries(nextEntries)
    await saveStoryBibleLocal(projectId, nextEntries)
    if (user) await saveBibleEntryToCloud(user.uid, projectId, nextEntry)
    setBibleExtractionSuggestions(items => items.filter(item => item !== suggestion))
    setActiveBibleEntryId(nextEntry.id)
    setIsBibleDrawerOpen(true)
  }

  const checkBibleCanonConsistency = async () => {
    if (!activeNote || bibleCanonLoading) return
    setBibleCanonLoading(true)
    setBibleCanonConflicts([])
    try {
      const chapterNumber = getNoteChapterNumber(activeNote)
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bible_consistency_check",
          chapterContent: activeNote.content,
          chapterTitle: activeNote.title,
          chapterNumber,
          bibleEntries
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to check Story Bible canon")
      setBibleCanonConflicts(Array.isArray(data.conflicts) ? data.conflicts : [])
      setBibleCanonCheckedNoteId(activeNote.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to check Story Bible canon")
    } finally {
      setBibleCanonLoading(false)
    }
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

  const fetchArcSeeds = useCallback(async () => {
    if (!user || !projectId) return
    try {
      let seedList: ArcSeed[] = (await getArcSeedsLocal(projectId)) || []
      if (seedList.length === 0) {
        const stored = localStorage.getItem(`penpad_arc_seeds_${projectId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          seedList = parsed
          await saveArcSeedsLocal(projectId, parsed)
          localStorage.removeItem(`penpad_arc_seeds_${projectId}`)
        }
      }
      setArcSeeds(seedList)

      const synced = await syncArcSeedsWithCloud(user.uid, projectId, seedList)
      setArcSeeds(synced)
      await saveArcSeedsLocal(projectId, synced)
    } catch {
      console.error("Fetch/Sync arc seeds failed")
    }
  }, [user, projectId])

  const getArcSeedChapterLabel = (seed: ArcSeed) => {
    if (seed.chapterNumber) return `Chapter ${seed.chapterNumber}`
    return seed.chapterTitle || "Unknown chapter"
  }

  const generateArcSeedFromChapter = async () => {
    if (!activeNote || !projectId || !user || arcSeedLoading) return
    setArcSeedLoading(true)
    setArcSeedError("")

    try {
      const chapterNumber = getNoteChapterNumber(activeNote)
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "arc_seed_extract",
          chapterContent: activeNote.content,
          chapterTitle: activeNote.title,
          chapterNumber,
          existingArcSeeds: arcSeeds,
          bibleEntries,
          brainEntries: brainEntries.filter(entry => entry.aiSummary !== "Analyzing...")
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to extract an Arc Seed")

      const seedData = data.seed || {}
      const now = Date.now()
      const nextSeed: ArcSeed = {
        id: crypto.randomUUID(),
        title: String(seedData.title || "Future thread").trim(),
        summary: String(seedData.summary || "").trim(),
        whyItMatters: String(seedData.whyItMatters || "").trim(),
        futurePayoff: String(seedData.futurePayoff || "").trim(),
        evidence: String(seedData.evidence || "").trim(),
        chapterTitle: activeNote.title || "Untitled",
        chapterId: activeNote.id,
        chapterNumber,
        relatedCharacters: Array.isArray(seedData.relatedCharacters) ? seedData.relatedCharacters : [],
        relatedEntities: Array.isArray(seedData.relatedEntities) ? seedData.relatedEntities : [],
        status: "open",
        createdAt: now,
        updatedAt: now
      }

      const existingSameChapter = arcSeeds.find(seed => seed.chapterId === activeNote.id)
      const nextList = existingSameChapter
        ? arcSeeds.map(seed => seed.id === existingSameChapter.id ? { ...nextSeed, id: existingSameChapter.id, createdAt: existingSameChapter.createdAt } : seed)
        : [nextSeed, ...arcSeeds]
      setArcSeeds(nextList)
      await saveArcSeedsLocal(projectId, nextList)
      await saveArcSeedToCloud(user.uid, projectId, existingSameChapter ? { ...nextSeed, id: existingSameChapter.id, createdAt: existingSameChapter.createdAt } : nextSeed)
      setSelectedArcSeedId(existingSameChapter?.id || nextSeed.id)
    } catch (err) {
      setArcSeedError(err instanceof Error ? err.message : "Failed to extract an Arc Seed")
    } finally {
      setArcSeedLoading(false)
    }
  }

  const updateArcSeed = async (seedId: string, updates: Partial<ArcSeed>) => {
    if (!projectId || !user) return
    const current = arcSeeds.find(seed => seed.id === seedId)
    if (!current) return
    const updatedSeed: ArcSeed = { ...current, ...updates, updatedAt: Date.now() }
    const nextList = arcSeeds.map(seed => seed.id === seedId ? updatedSeed : seed)
    setArcSeeds(nextList)
    await saveArcSeedsLocal(projectId, nextList)
    saveArcSeedToCloud(user.uid, projectId, updatedSeed)
  }

  const deleteArcSeed = async (seedId: string) => {
    if (!projectId || !user) return
    const nextList = arcSeeds.filter(seed => seed.id !== seedId)
    setArcSeeds(nextList)
    setSelectedArcSeedId(current => current === seedId ? null : current)
    await saveArcSeedsLocal(projectId, nextList)
    await deleteArcSeedFromCloud(user.uid, projectId, seedId)
  }

  const getChapterNumberFromTitle = (title?: string) => {
    const match = title?.match(/\bchapter\s*0*(\d+)\b/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  const getNoteSortValue = (note: Note) => {
    if (Number.isFinite(note.sortOrder)) return note.sortOrder as number
    return getChapterNumberFromTitle(note.title) ?? note.createdAt
  }

  const getOrderedNotesList = (noteList: Note[]) => {
    return [...noteList].sort((a, b) => b.createdAt - a.createdAt)
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

  const getChapterListDisplay = (note: Note) => {
    const chapterNumber = getNoteChapterNumber(note)
    const rawTitle = note.title?.trim() || "Untitled"
    const titleWithoutChapterNumber = rawTitle
      .replace(/^\s*chapter\s*0*\d+\s*(?:[-:–—]\s*)?/i, "")
      .trim()

    return {
      chapterNumber: chapterNumber ?? "?",
      title: titleWithoutChapterNumber || rawTitle || "Untitled"
    }
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
        const entityName = (data.entityName || text).trim()
        const entityType = data.entityType || "unknown"
        const importance = data.importance || "minor"
        const connections = Array.isArray(data.connections) ? data.connections : []
        const parentEntityName = data.parentEntityName ? data.parentEntityName.trim() : ""
        const isSubEntity = !!data.isSubEntity

        setBrainEntries(prev => {
          const existingEntry = prev.find(e => e.id !== newEntry.id && e.entityName && e.entityName.trim().toLowerCase() === entityName.toLowerCase())
          const parentEntry = (!existingEntry && isSubEntity && parentEntityName)
            ? prev.find(e => e.id !== newEntry.id && e.entityName && e.entityName.trim().toLowerCase() === parentEntityName.toLowerCase())
            : null

          let list: BrainEntry[]
          if (existingEntry) {
            const newChapterLabel = chapterNumber ? `Chapter ${chapterNumber}` : activeNote.title || "New Chapter"
            const updatedSummary = `${existingEntry.aiSummary}\r\n\r\n***\r\n\r\n### 🔄 Update: ${newChapterLabel}\r\n${summary}`
            
            const importanceOrder: Record<string, number> = { minor: 1, major: 2, critical: 3 }
            const currentImportanceVal = importanceOrder[existingEntry.importance || 'minor'] || 1
            const newImportanceVal = importanceOrder[importance || 'minor'] || 1
            const finalImportance = (newImportanceVal > currentImportanceVal ? importance : existingEntry.importance) as BrainImportance

            const mergedConnections = Array.from(new Set([...(existingEntry.connections || []), ...connections]))

            const updatedExisting: BrainEntry = {
              ...existingEntry,
              aiSummary: updatedSummary,
              importance: finalImportance,
              connections: mergedConnections,
              updatedAt: Date.now()
            }

            const remaining = prev.filter(e => e.id !== newEntry.id && e.id !== existingEntry.id)
            list = [updatedExisting, ...remaining]

            saveBrainEntryToCloud(user.uid, projectId, updatedExisting)
            deleteBrainEntryFromCloud(user.uid, projectId, newEntry.id)
          } else if (parentEntry) {
            const newChapterLabel = chapterNumber ? `Chapter ${chapterNumber}` : activeNote.title || "New Chapter"
            const updatedSummary = `${parentEntry.aiSummary}\r\n\r\n***\r\n\r\n### 📍 Sub-Entity: ${entityName} (${newChapterLabel})\r\n${summary}`
            
            const importanceOrder: Record<string, number> = { minor: 1, major: 2, critical: 3 }
            const currentImportanceVal = importanceOrder[parentEntry.importance || 'minor'] || 1
            const newImportanceVal = importanceOrder[importance || 'minor'] || 1
            const finalImportance = (newImportanceVal > currentImportanceVal ? importance : parentEntry.importance) as BrainImportance

            const mergedConnections = Array.from(new Set([...(parentEntry.connections || []), entityName, ...connections]))

            const updatedParent: BrainEntry = {
              ...parentEntry,
              aiSummary: updatedSummary,
              importance: finalImportance,
              connections: mergedConnections,
              updatedAt: Date.now()
            }

            const remaining = prev.filter(e => e.id !== newEntry.id && e.id !== parentEntry.id)
            list = [updatedParent, ...remaining]

            saveBrainEntryToCloud(user.uid, projectId, updatedParent)
            deleteBrainEntryFromCloud(user.uid, projectId, newEntry.id)
          } else {
            const finalEntry: BrainEntry = {
              ...newEntry,
              aiSummary: summary,
              entityType,
              entityName,
              importance,
              connections,
              updatedAt: Date.now()
            }
            list = prev.map(e => e.id === newEntry.id ? finalEntry : e)
            saveBrainEntryToCloud(user.uid, projectId, finalEntry)
          }

          saveStoryBrainLocal(projectId, list)
          return list
        })
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

  const handleManualMerge = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || !user || !projectId) return
    const sourceEntry = brainEntries.find(e => e.id === sourceId)
    const targetEntry = brainEntries.find(e => e.id === targetId)
    if (!sourceEntry || !targetEntry) return

    const chapterLabel = sourceEntry.chapterNumber ? `Chapter ${sourceEntry.chapterNumber}` : sourceEntry.chapterTitle || "Unknown Chapter"
    const appendedSummary = `${targetEntry.aiSummary}\r\n\r\n***\r\n\r\n### 🔗 Manually Merged: ${sourceEntry.entityName || sourceEntry.highlightedText} (${chapterLabel})\r\n${sourceEntry.aiSummary}`

    const importanceOrder = { minor: 1, major: 2, critical: 3 }
    const targetImportanceVal = importanceOrder[targetEntry.importance || 'minor'] || 1
    const sourceImportanceVal = importanceOrder[sourceEntry.importance || 'minor'] || 1
    const finalImportance = (sourceImportanceVal > targetImportanceVal ? sourceEntry.importance : targetEntry.importance) || 'minor'

    const mergedConnections = Array.from(new Set([
      ...(targetEntry.connections || []), 
      sourceEntry.entityName || sourceEntry.highlightedText, 
      ...(sourceEntry.connections || [])
    ].filter(Boolean)))

    const updatedTarget = {
      ...targetEntry,
      aiSummary: appendedSummary,
      importance: finalImportance,
      connections: mergedConnections,
      updatedAt: Date.now()
    }

    setBrainEntries(prev => {
      const list = prev.filter(e => e.id !== sourceId && e.id !== targetId)
      const updatedList = [updatedTarget, ...list]
      saveStoryBrainLocal(projectId, updatedList)
      return updatedList
    })

    await saveBrainEntryToCloud(user.uid, projectId, updatedTarget)
    await deleteBrainEntryFromCloud(user.uid, projectId, sourceId)

    setSelectedBrainEntryId(targetId)
    setMergeTargetId("")
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

  const checkBrainConsistency = async () => {
    if (!activeNote || !projectId || consistencyLoading) return
    setConsistencyLoading(true)
    setConsistencyWarnings([])
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_consistency_check",
          chapterContent: activeNote.content,
          chapterTitle: activeNote.title,
          existingBrainEntries: brainEntries.filter(entry => entry.aiSummary !== "Analyzing...")
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to check consistency")
      setConsistencyWarnings(data.conflicts || [])
      setConsistencyCheckedNoteId(activeNote.id)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Consistency check failed")
    } finally {
      setConsistencyLoading(false)
    }
  }

  const checkTimelineConsistency = async (force?: boolean) => {
    if (!projectId || timelineCheckLoading) return

    const sortedNotes = getManuscriptNotesList(notes)
    const chapters = sortedNotes.map((note, index) => {
      const chapterNumber = getNoteChapterNumber(note) || index + 1
      const charactersAppearing = progressionProfiles
        .filter(profile => doesCharacterAppearInChapter(profile, note.content))
        .map(profile => profile.name)
      return {
        id: note.id,
        title: note.title,
        chapterNumber,
        charactersAppearing
      }
    })
    const profiles = progressionProfiles.map(profile => ({
      name: profile.name,
      history: (profile.history || []).map(h => ({
        chapterId: h.chapterId,
        chapterTitle: h.chapterTitle,
        chapterNumber: h.chapterNumber,
        levelBefore: h.levelBefore,
        levelAfter: h.levelAfter,
        realmBefore: h.realmBefore || "",
        realmAfter: h.realmAfter || "",
        stageBefore: h.stageBefore || "",
        stageAfter: h.stageAfter || "",
        summary: h.summary,
        statChanges: h.statChanges as Record<string, number>
      }))
    }))
    const bibleData = bibleEntries.map(e => ({
      name: e.name,
      category: e.category,
      content: e.content
    }))

    const fingerprint = JSON.stringify({ chapters, profiles, bibleData })
    const cacheKey = `penpad_timeline_check_${projectId}`

    if (!force) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.fingerprint === fingerprint) {
            setTimelineIssues(parsed.issues || [])
            setTimelineCheckTimestamp(parsed.timestamp || null)
            setShowTimelineCheckModal(true)
            return
          }
        } catch {}
      }
    }

    setTimelineCheckLoading(true)
    setTimelineIssues([])
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "timeline_consistency_check",
          chapters,
          profiles,
          bibleEntries: bibleData
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to check timeline consistency")
      const issues = data.issues || []
      setTimelineIssues(issues)
      setTimelineCheckTimestamp(Date.now())
      setShowTimelineCheckModal(true)
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ fingerprint, issues, timestamp: Date.now() }))
      } catch {}
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Timeline check failed")
    } finally {
      setTimelineCheckLoading(false)
    }
  }

  const fetchEntitySuggestions = async () => {
    if (!activeNote || !projectId || suggestionLoading) return
    setSuggestionLoading(true)
    setSuggestedEntities([])
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_suggest_additions",
          chapterContent: activeNote.content,
          existingBrainEntries: brainEntries.filter(entry => entry.aiSummary !== "Analyzing...")
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch suggestions")
      setSuggestedEntities(data.suggestions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setSuggestionLoading(false)
    }
  }

  const quickAddSuggestedEntity = async (suggestion: { entityName: string; entityType: BrainEntityType; importance: BrainImportance; aiSummary: string }) => {
    if (!user || !projectId || !activeNote) return
    const now = Date.now()
    const chapterNumber = getNoteChapterNumber(activeNote)
    const newEntry: BrainEntry = {
      id: crypto.randomUUID(),
      highlightedText: suggestion.entityName,
      entityName: suggestion.entityName,
      entityType: suggestion.entityType,
      importance: suggestion.importance,
      aiSummary: suggestion.aiSummary,
      chapterTitle: activeNote.title || "Untitled",
      chapterId: activeNote.id,
      ...(chapterNumber ? { chapterNumber } : {}),
      connections: [],
      createdAt: now,
      updatedAt: now
    }

    const updated = [newEntry, ...brainEntries]
    setBrainEntries(updated)
    await saveStoryBrainLocal(projectId, updated)
    saveBrainEntryToCloud(user.uid, projectId, newEntry)

    setSuggestedEntities(prev => prev.filter(s => s.entityName.toLowerCase() !== suggestion.entityName.toLowerCase()))
  }

  const generateEntityDossier = async (entityName: string, entityType: BrainEntityType) => {
    if (!user || !projectId || dossierLoading) return
    setDossierLoading(true)
    setDossierMessage("")
    try {
      const relevantEntries = brainEntries.filter(entry => 
        (entry.entityName || entry.highlightedText || "").toLowerCase() === entityName.toLowerCase()
      )
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_generate_dossier",
          entityName,
          entityType,
          brainEntries: relevantEntries
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate dossier")

      const existingEntry = bibleEntries.find(e => e.name.toLowerCase() === entityName.toLowerCase())
      if (existingEntry) {
        const updatedEntry = {
          ...existingEntry,
          content: data.dossierText,
          updatedAt: Date.now()
        }
        const updatedList = bibleEntries.map(e => e.id === existingEntry.id ? updatedEntry : e)
        setBibleEntries(updatedList)
        await saveStoryBibleLocal(projectId, updatedList)
        await saveBibleEntryToCloud(user.uid, projectId, updatedEntry)
      } else {
        const newBibleEntry = {
          id: crypto.randomUUID(),
          name: entityName,
          category: (entityType === "character" ? "character" : entityType === "place" ? "place" : entityType === "object" ? "item" : "world") as any,
          content: data.dossierText,
          groupIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        const updatedList = [newBibleEntry, ...bibleEntries]
        setBibleEntries(updatedList)
        await saveStoryBibleLocal(projectId, updatedList)
        await saveBibleEntryToCloud(user.uid, projectId, newBibleEntry)
      }
      setDossierMessage("Dossier successfully generated and saved to Story Bible!")
      setTimeout(() => setDossierMessage(""), 5000)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to compile dossier")
    } finally {
      setDossierLoading(false)
    }
  }

  const handleSaveDossierText = async (entityName: string, textContent: string) => {
    if (!user || !projectId) return
    const existingEntry = bibleEntries.find(e => e.name.toLowerCase() === entityName.toLowerCase())
    if (existingEntry) {
      const updatedEntry = {
        ...existingEntry,
        content: textContent,
        updatedAt: Date.now()
      }
      const updatedList = bibleEntries.map(e => e.id === existingEntry.id ? updatedEntry : e)
      setBibleEntries(updatedList)
      await saveStoryBibleLocal(projectId, updatedList)
      await saveBibleEntryToCloud(user.uid, projectId, updatedEntry)
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
      fetchArcSeeds()
      fetchProgressionSystem()
      fetchProgressionProfiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId])

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
  }, [activeBibleEntry?.name, activeBibleEntry?.content, activeBibleEntry?.category, activeBibleEntry?.groupIds, activeBibleEntry?.characterDetails])

  useEffect(() => {
    if (!isBibleSelectionMode || selectedBibleIds.size === 0) {
      setIsBibleGroupAddMenuOpen(false)
    }
  }, [isBibleSelectionMode, selectedBibleIds.size])

  const sanitizeFilename = (name: string): string => {
    return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'
  }

  const getChapterExportFingerprint = (note: Note) => {
    const raw = `${note.title || ""}\r\n${note.content || ""}\r\n${note.updatedAt || 0}`
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
    if (projectId) {
      saveExportHistoryLocal(projectId, nextHistory).catch(err =>
        console.error("Failed to save export history to IndexedDB:", err)
      )
    }
    setExportHistory(nextHistory)
    savedFilenamesRef.current = new Map(Object.entries(nextHistory).map(([chapterId, record]) => [chapterId, record.filename]))
    setSavedChapters(new Set(Object.keys(nextHistory)))
  }, [getExportHistoryStorageKey, projectId])

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
        if (projectId) {
          saveExportHistoryLocal(projectId, next).catch(err =>
            console.error("Failed to save export history to IndexedDB:", err)
          )
        }
        savedFilenamesRef.current = new Map(Object.entries(next).map(([chapterId, record]) => [chapterId, record.filename]))
        return next
      })
    } catch (e) {
      console.error("Failed to save chapter:", e)
    }
  }, [getExportHistoryStorageKey, projectId])
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
      return `# ${projectName}\r\n\r\n${chapters.map(note => `## ${note.title || "Untitled"}\r\n\r\n${note.content || ""}`).join("\r\n\r\n")}`
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
  ${chapters.map(note => `<section><h2>${escapeHtml(note.title || "Untitled")}</h2><p>${escapeHtml(note.content || "")}</p></section>`).join("\r\n")}
</body>
</html>`
    }

    return chapters.map(note => `${note.title || "Untitled"}\r\n${"=".repeat((note.title || "Untitled").length)}\r\n\r\n${note.content || ""}`).join("\r\n\r\n\r\n")
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
  ${(chapter.content || '').split('\r\n').map(line => line.trim() ? `<p>${escapeHtml(line)}</p>` : '').join('\r\n')}
</body>
</html>`)

          manifestItems += `    <item id="${id}" href="${fileName}" media-type="application/xhtml+xml" />\r\n`
          spineItems += `    <itemref idref="${id}" />\r\n`
          navPoints += `    <navPoint id="${id}" playOrder="${idx + 1}">
      <navLabel><text>${escapeHtml(title)}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>\r\n`
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
    { name: "Code Block", cmd: "/code", desc: "Insert Code block", action: () => applyFormatting("```\r\n", "\r\n```") },
    { name: "Focus AI assistant", cmd: "/ai", desc: "Toggle Right AI Assistant Sidebar", action: () => setShowAISidebar(prev => !prev) },
    { name: "Toggle Zen Mode", cmd: "/zen", desc: "Fullscreen Zen mode", action: () => setIsZenMode(prev => !prev) },
    { name: "Open World Bible", cmd: "/bible", desc: "Toggle World Bible Panel", action: () => { setActiveSidebarTab('bible'); setIsLeftSidebarOpen(true) } },
    { name: "Appearance Lab", cmd: "/appearance", desc: "Open Appearance Prompt Lab", action: () => { setActiveSidebarTab('appearance'); setIsLeftSidebarOpen(true) } },
    { name: "Progression", cmd: "/progress", desc: "Open Character Progression Profiles", action: () => { setActiveSidebarTab('progression'); setIsLeftSidebarOpen(true) } },
    { name: "Arc Seeds", cmd: "/arcs", desc: "Open Future Arc Seeds", action: () => { setActiveSidebarTab('arcs'); setIsLeftSidebarOpen(true) } },
    { name: "Name Forge", cmd: "/names", desc: "Generate fresh fantasy names", action: () => { setActiveSidebarTab('names'); setIsLeftSidebarOpen(true) } },
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
      const lastLineIdx = textBeforeCursor.lastIndexOf("\r\n")
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
      textarea.focus({ preventScroll: true })
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
    persistVolumes(volumes.map(volume => {
      if (volume.id === volumeId) {
        const nextOpen = !volume.isOpen
        return { ...volume, isOpen: nextOpen, updatedAt: Date.now() }
      } else {
        // If we are turning a volume ON (active), turn all other volumes OFF (inactive).
        const targetVolume = volumes.find(v => v.id === volumeId)
        const nextOpen = targetVolume ? !targetVolume.isOpen : false
        if (nextOpen) {
          return { ...volume, isOpen: false, updatedAt: Date.now() }
        }
        return volume
      }
    }))
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
    const currentTitle = volume ? volume.title : "Recovered Volume"
    const title = prompt("Rename volume:", currentTitle)
    if (title === null) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    if (volume) {
      persistVolumes(volumes.map(item =>
        item.id === volumeId ? { ...item, title: trimmedTitle, updatedAt: Date.now() } : item
      ))
    } else {
      // It's an orphan/recovered volume! Create a new volume entry for it in the volumes list.
      const now = Date.now()
      const newVol: ManuscriptVolume = {
        id: volumeId,
        title: trimmedTitle,
        isOpen: true,
        sortOrder: volumes.length > 0 ? Math.max(...volumes.map(v => v.sortOrder)) + 1 : 1,
        createdAt: now,
        updatedAt: now
      }
      persistVolumes([...volumes, newVol])
    }
  }

  const createNewNote = async (volumeId?: string | null) => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newTitle = generateChapterTitle(notes)
      const targetVolumeId = volumeId !== undefined
        ? (volumeId === UNASSIGNED_VOLUME_ID ? null : volumeId)
        : (volumes.find(volume => volume.isOpen !== false)?.id || null)
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
    arcSeeds: arcSeeds.length,
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

    const arcResults = arcSeeds
      .filter(seed =>
        seed.title.toLowerCase().includes(query) ||
        seed.summary.toLowerCase().includes(query) ||
        seed.whyItMatters.toLowerCase().includes(query) ||
        seed.futurePayoff.toLowerCase().includes(query) ||
        seed.evidence.toLowerCase().includes(query)
      )
      .slice(0, 6)
      .map(seed => ({
        id: `arc-${seed.id}`,
        source: 'arc' as SearchSource,
        title: seed.title,
        subtitle: `${getArcSeedChapterLabel(seed)} - Arc Seed`,
        preview: seed.summary || seed.futurePayoff,
        chapterId: seed.chapterId
      }))

    return [...chapterResults, ...brainResults, ...arcResults, ...loreResults].slice(0, 18)
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
    } else if (result.source === 'arc') {
      const seedId = result.id.replace(/^arc-/, "")
      setActiveSidebarTab('arcs')
      setIsLeftSidebarOpen(true)
      setArcSeedSearchQuery(result.title)
      setSelectedArcSeedId(seedId)
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

  const parseAiSummarySegments = (summaryText: string) => {
    if (!summaryText) return [];
    // Split by horizontal rule markdown separator (handles both CRLF and LF)
    const rawSegments = summaryText.split(/\r?\n*\*+\r?\n*/);
    
    return rawSegments.map((segment, index) => {
      const trimmed = segment.trim();
      if (!trimmed) return null;
      
      const headerMatch = trimmed.match(/^###\s*(.*)$/m);
      let title = "";
      let content = trimmed;
      
      if (headerMatch) {
        title = headerMatch[1].trim();
        content = trimmed.replace(/^###.*$/m, '').trim();
      } else {
        title = index === 0 ? "Initial Entry" : `Section ${index + 1}`;
      }
      
      return {
        id: `${index}`,
        title,
        content
      };
    }).filter((s): s is { id: string; title: string; content: string } => s !== null);
  };

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
  const selectedArcSeed = selectedArcSeedId
    ? arcSeeds.find(seed => seed.id === selectedArcSeedId) || null
    : null
  const openArcSeedCount = arcSeeds.filter(seed => seed.status === "open").length
  const filteredArcSeeds = arcSeeds.filter(seed => {
    const query = arcSeedSearchQuery.trim().toLowerCase()
    const matchesStatus = arcSeedStatusFilter === 'all' || seed.status === arcSeedStatusFilter
    const matchesSearch = !query ||
      seed.title.toLowerCase().includes(query) ||
      seed.summary.toLowerCase().includes(query) ||
      seed.whyItMatters.toLowerCase().includes(query) ||
      seed.futurePayoff.toLowerCase().includes(query) ||
      seed.evidence.toLowerCase().includes(query) ||
      seed.chapterTitle.toLowerCase().includes(query) ||
      (seed.relatedCharacters || []).some(name => name.toLowerCase().includes(query)) ||
      (seed.relatedEntities || []).some(name => name.toLowerCase().includes(query))
    return matchesStatus && matchesSearch
  })

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
                placeholder="Search chapters, Brain Map, Arc Seeds, and lore..."
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
                  <span>Search across chapters, Brain Map entries, Arc Seeds, and story bible lore.</span>
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
          {activeNote && (
            <button
              className={`btn-buffer ${bufferStatus}`}
              onClick={handleSendToBuffer}
              disabled={isBuffering}
              title={
                bufferStatus === 'success'
                  ? "Sent to ChapterBuffer!"
                  : bufferStatus === 'error'
                  ? "Failed to send to ChapterBuffer"
                  : "Send current chapter to ChapterBuffer"
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 10px',
                height: '32px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: bufferStatus === 'success' ? '#10B981' : bufferStatus === 'error' ? '#EF4444' : 'var(--text-secondary)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s',
                cursor: isBuffering ? 'not-allowed' : 'pointer'
              }}
            >
              {isBuffering ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Buffering...</span>
                </>
              ) : bufferStatus === 'success' ? (
                <>
                  <Check size={14} />
                  <span>Buffered!</span>
                </>
              ) : bufferStatus === 'error' ? (
                <>
                  <AlertCircle size={14} />
                  <span>Failed</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send to Buffer</span>
                </>
              )}
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => setShowGlobalSearch(true)}
            title="Search manuscript, Brain Map, Arc Seeds, and lore"
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
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'names' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'names' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('names')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Name Forge"
              >
                <Wand2 size={20} />
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
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'arcs' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'arcs' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('arcs')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Arc Seeds"
              >
                <History size={20} />
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
                {filteredNotes.map(note => {
                  const chapterDisplay = getChapterListDisplay(note)
                  return (
                    <div 
                      key={note.id}
                      className={`chapter-item ${note.id === activeNoteId ? 'active' : ''}`}
                      onClick={() => {
                        setActiveNoteId(note.id)
                        setShowChapterDrawer(false)
                      }}
                    >
                      <span className="chapter-number-card" aria-label={`Chapter ${chapterDisplay.chapterNumber}`}>
                        {chapterDisplay.chapterNumber}
                      </span>
                      <span className="chapter-title-wrap">
                        <span className="chapter-title">{chapterDisplay.title}</span>
                      </span>
                    </div>
                  )
                })}
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
                    <div className="linked-folder-info" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                        <span className="folder-name" title={dirHandle.name}>📁 {dirHandle.name}</span>
                        {dirPermission === 'granted' ? (
                          <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: 'bold' }}>Connected</span>
                        ) : (
                          <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 'bold' }}>Disconnected</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.45rem', width: '100%' }}>
                        {dirPermission !== 'granted' && (
                          <button 
                            className="btn-reconnect-folder" 
                            onClick={reconnectFolder}
                            disabled={isReconnecting}
                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold', background: isReconnecting ? 'var(--surface-hover)' : 'var(--primary)', color: 'white', border: 0, borderRadius: 'var(--radius-sm)', cursor: isReconnecting ? 'not-allowed' : 'pointer', transition: 'var(--transition)', opacity: isReconnecting ? 0.7 : 1 }}
                          >
                            {isReconnecting ? '⏳ Connecting...' : '🔗 Reconnect'}
                          </button>
                        )}
                        <button 
                          className="btn-disconnect-folder" 
                          onClick={disconnectFolder} 
                          title="Unlink folder"
                          style={{ flex: 1, textAlign: 'center', padding: '0.25rem 0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >
                          Disconnect
                        </button>
                      </div>
                      {reconnectError && dirPermission !== 'granted' && (
                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#f87171', lineHeight: '1.4', padding: '0.3rem 0.4rem', background: 'rgba(239,68,68,0.07)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.15)' }}>
                          {reconnectError}
                        </p>
                      )}
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
                            onClick={() => renameVolume(group.id)}
                            title="Rename volume"
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
                          <button
                            type="button"
                            className="volume-add-chapter"
                            onClick={() => renameVolume(group.id)}
                            title="Rename volume"
                          >
                            <Edit3 size={12} />
                          </button>
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
                              const chapterDisplay = getChapterListDisplay(note)
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
                                    null
                                  )}
                                  <span className="chapter-number-card" aria-label={`Chapter ${chapterDisplay.chapterNumber}`}>
                                    {chapterDisplay.chapterNumber}
                                  </span>
                                  <span className="chapter-title-wrap">
                                    <span className="chapter-title">{chapterDisplay.title}</span>
                                  </span>
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
                        saveCurrentEntryFormConfig(appearanceSelectedEntryId)
                        const newId = e.target.value || null
                        setAppearanceSelectedEntryId(newId)
                        loadEntryFormConfig(newId)
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

                  {/* #4: Custom style + dropdown */}
                  <div className="ai-form-field">
                    <label>Visual Style</label>
                    <select
                      className="ai-select"
                      value={appearanceCustomStyle ? "__custom__" : appearanceStyle}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") return
                        setAppearanceCustomStyle("")
                        setAppearanceStyle(e.target.value)
                      }}
                      disabled={appearanceLoading}
                    >
                      <option value="cinematic fantasy character concept art">Cinematic fantasy concept art</option>
                      <option value="anime key visual, high detail">Anime key visual</option>
                      <option value="dark xianxia character design sheet">Dark xianxia design sheet</option>
                      <option value="realistic film character design">Realistic film character design</option>
                      <option value="game-ready creature concept art">Game-ready creature concept art</option>
                      <option value="__custom__">Custom style (type below)...</option>
                    </select>
                    <input
                      className="ai-input"
                      style={{ marginTop: "0.4rem" }}
                      value={appearanceCustomStyle}
                      onChange={(e) => setAppearanceCustomStyle(e.target.value)}
                      placeholder="e.g. watercolor portrait, cyberpunk noir illustration..."
                      disabled={appearanceLoading}
                    />
                  </div>

                  {/* #1: Customizable form labels + #5: Form toggles */}
                  <div className="ai-form-field">
                    <label>
                      Forms
                      <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginLeft: "0.4rem", fontWeight: 400 }}>
                        (edit labels, toggle enabled)
                      </span>
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {appearanceFormKeys.map((formKey, idx) => (
                        <div key={formKey} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <input
                            type="checkbox"
                            checked={appearanceFormEnabled[formKey] !== false}
                            onChange={() => setAppearanceFormEnabled(prev => ({ ...prev, [formKey]: !(prev[formKey] !== false) }))}
                            disabled={appearanceLoading}
                            title="Toggle this form"
                          />
                          <input
                            className="ai-input"
                            style={{ flex: 1, fontSize: "0.72rem", minHeight: "28px" }}
                            value={appearanceFormLabels[formKey] || ""}
                            onChange={(e) => setAppearanceFormLabels(prev => ({ ...prev, [formKey]: e.target.value }))}
                            placeholder="Form label..."
                            disabled={appearanceLoading}
                          />
                          <button
                            className="btn-ai-sub btn-ai-secondary"
                            style={{ flexShrink: 0, minHeight: "26px", fontSize: "0.65rem", padding: "0.2rem 0.4rem" }}
                            onClick={() => {
                              const newKeys = [...appearanceFormKeys]
                              newKeys.splice(idx, 1)
                              setAppearanceFormKeys(newKeys)
                              setAppearanceFormLabels(prev => { const n = { ...prev }; delete n[formKey]; return n })
                              setAppearanceFormEnabled(prev => { const n = { ...prev }; delete n[formKey]; return n })
                              setAppearanceFormDescriptions(prev => { const n = { ...prev }; delete n[formKey]; return n })
                            }}
                            disabled={appearanceLoading}
                            title="Remove form"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <input
                          className="ai-input"
                          style={{ flex: 1, fontSize: "0.72rem", minHeight: "28px" }}
                          value={appearanceAddFormKey}
                          onChange={(e) => setAppearanceAddFormKey(e.target.value.replace(/\s+/g, "_"))}
                          placeholder="New form key (e.g. shadowForm)"
                        />
                        <button
                          className="btn-ai-sub btn-ai-primary"
                          style={{ flexShrink: 0, minHeight: "26px", fontSize: "0.65rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => {
                            const key = appearanceAddFormKey.trim()
                            if (!key || appearanceFormKeys.includes(key)) return
                            setAppearanceFormKeys(prev => [...prev, key])
                            setAppearanceFormLabels(prev => ({ ...prev, [key]: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim() }))
                            setAppearanceFormEnabled(prev => ({ ...prev, [key]: true }))
                            setAppearanceAddFormKey("")
                          }}
                          disabled={appearanceLoading || !appearanceAddFormKey.trim()}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* #2: Manual form description inputs */}
                  {appearanceFormKeys.filter(k => appearanceFormEnabled[k] !== false).length > 0 && (
                    <div className="ai-form-field">
                      <label>
                        Form Descriptions
                        <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginLeft: "0.4rem", fontWeight: 400 }}>
                          (optional — leave blank for AI to infer)
                        </span>
                      </label>
                      {appearanceFormKeys.filter(k => appearanceFormEnabled[k] !== false).map(formKey => (
                        <div key={formKey} style={{ marginBottom: "0.35rem" }}>
                          <small style={{ color: "var(--text-dim)", fontSize: "0.65rem", display: "block", marginBottom: "0.15rem" }}>
                            {appearanceFormLabels[formKey] || formKey}
                          </small>
                          <textarea
                            className="ai-textarea appearance-textarea compact"
                            value={appearanceFormDescriptions[formKey] || ""}
                            onChange={(e) => setAppearanceFormDescriptions(prev => ({ ...prev, [formKey]: e.target.value }))}
                            placeholder={`Describe ${appearanceFormLabels[formKey] || formKey} appearance, attire, and distinguishing traits...`}
                            disabled={appearanceLoading}
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* #10: Per-form negative prompts toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={appearancePerFormNegative}
                      onChange={() => setAppearancePerFormNegative(prev => !prev)}
                      disabled={appearanceLoading}
                    />
                    Generate per-form negative prompts
                  </label>

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

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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

                    {/* #9: Batch generate */}
                    {bibleEntries.length > 0 && (
                      <details style={{ fontSize: "0.72rem" }}>
                        <summary style={{ cursor: "pointer", color: "var(--text-dim)", padding: "0.25rem 0" }}>
                          Batch generate for multiple entries
                        </summary>
                        <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            {bibleEntries.map(entry => (
                              <label key={entry.id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={appearanceBatchEntryIds.includes(entry.id)}
                                  onChange={() => {
                                    setAppearanceBatchEntryIds(prev =>
                                      prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id]
                                    )
                                  }}
                                  disabled={appearanceBatchLoading}
                                />
                                <span>{entry.name}</span>
                                <span style={{ color: "var(--text-dim)", fontSize: "0.6rem" }}>({entry.category})</span>
                              </label>
                            ))}
                          </div>
                          <button
                            className="btn-ai-sub btn-ai-primary"
                            style={{ fontSize: "0.7rem", minHeight: "28px" }}
                            onClick={async () => {
                              if (appearanceBatchEntryIds.length === 0) return
                              setAppearanceBatchLoading(true)
                              setAppearanceError("")
                              for (const id of appearanceBatchEntryIds) {
                                await handleGenerateAppearancePrompts(id)
                                await new Promise(r => setTimeout(r, 500))
                              }
                              setAppearanceBatchLoading(false)
                            }}
                            disabled={appearanceBatchLoading || appearanceBatchEntryIds.length === 0}
                          >
                            {appearanceBatchLoading ? "Generating batch..." : `Generate for ${appearanceBatchEntryIds.length} entries`}
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                </div>

                {appearanceResult && (
                  <div className="appearance-results">
                    {typeof appearanceResult.overview === "string" && appearanceResult.overview && (
                      <div className="appearance-overview">
                        <span>Visual Core</span>
                        <p>{appearanceResult.overview}</p>
                      </div>
                    )}

                    {Object.entries(appearanceResult.prompts || {}).map(([formKey, rawPrompt]) => {
                      const promptText = typeof rawPrompt === "string" ? rawPrompt : ""
                      if (!promptText) return null
                      const label = appearanceFormLabels[formKey] || formKey.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
                      const rawFormNegPrompt = appearanceResult.negativePrompts?.[formKey]
                      const formNegPrompt = typeof rawFormNegPrompt === "string" ? rawFormNegPrompt : ""
                      return (
                        <div className="appearance-prompt-card" key={formKey}>
                          <div className="appearance-prompt-header">
                            <strong>{label}</strong>
                            <div style={{ display: "flex", gap: "0.3rem" }}>
                              {/* #3: Regenerate single form */}
                              <button
                                className="btn-ai-sub btn-ai-secondary"
                                style={{ fontSize: "0.65rem", padding: "0.2rem 0.4rem", minHeight: "24px" }}
                                onClick={() => handleRegenerateSingleForm(formKey)}
                                disabled={appearanceGeneratingForm === formKey}
                                title="Regenerate this form only"
                              >
                                {appearanceGeneratingForm === formKey ? <Loader2 size={10} className="spin" /> : <RefreshCw size={10} />}
                                Regen
                              </button>
                              <button
                                className="btn-ai-sub btn-ai-secondary"
                                onClick={() => copyAppearanceText(formKey, promptText)}
                              >
                                <Copy size={12} />
                                {appearanceCopiedKey === formKey ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </div>
                          <p>{promptText}</p>
                          {formNegPrompt && (
                            <div style={{ marginTop: "0.35rem", padding: "0.35rem", background: "rgba(0,0,0,0.12)", borderRadius: "var(--radius-sm)", fontSize: "0.72rem" }}>
                              <small style={{ color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
                                Negative Prompt
                              </small>
                              <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)" }}>{formNegPrompt}</p>
                            </div>
                          )}
                          {/* #6: Image preview button (requires IMAGE_GEN_API_KEY env var to work) */}
                          <div style={{ marginTop: "0.4rem" }}>
                            <button
                              className="btn-ai-sub btn-ai-primary"
                              style={{ fontSize: "0.65rem", minHeight: "24px" }}
                              onClick={async () => {
                                setAppearanceImageGenerating(formKey)
                                setAppearanceError("")
                                try {
                                  const res = await fetch("/api/generate-image", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ prompt: promptText, negativePrompt: formNegPrompt || appearanceResult.negativePrompt || "" })
                                  })
                                  const data = await res.json()
                                  if (data.imageUrl) {
                                    setAppearanceGeneratedImages(prev => ({ ...prev, [formKey]: data.imageUrl }))
                                  } else if (data.error) {
                                    setAppearanceError(data.error)
                                  }
                                } catch {}
                                setAppearanceImageGenerating(null)
                              }}
                              disabled={appearanceImageGenerating === formKey}
                            >
                              {appearanceImageGenerating === formKey ? <Loader2 size={10} className="spin" /> : <ImageIcon size={10} />}
                              {appearanceGeneratedImages[formKey] ? "Re-generate Image" : "Preview"}
                            </button>
                            {appearanceGeneratedImages[formKey] && (
                              <div style={{ marginTop: "0.35rem" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={appearanceGeneratedImages[formKey]}
                                  alt={label}
                                  style={{ width: "100%", borderRadius: "var(--radius-sm)", maxHeight: "200px", objectFit: "cover" }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {typeof appearanceResult.negativePrompt === "string" && appearanceResult.negativePrompt && (
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
                  <button
                    className="progression-library-card"
                    onClick={() => {
                      setShowProgressionTemplateModal(true)
                      setIsProgressionCultivationImportOpen(true)
                    }}
                  >
                    <div>
                      <FileText size={15} />
                      <span>Cultivation</span>
                    </div>
                    <strong>{progressionSystem.realms.length}</strong>
                    <p>{progressionSystem.cultivationGuide ? "Stage guide saved for AI updates" : "Upload TXT stages for AI updates"}</p>
                  </button>
                  <button className="progression-library-card" onClick={() => checkTimelineConsistency()} disabled={timelineCheckLoading}>
                    <div>
                      {timelineCheckLoading ? <Loader2 className="spin" size={15} /> : <ShieldAlert size={15} />}
                      <span>Timeline</span>
                    </div>
                    <strong>{timelineIssues.length}</strong>
                    <p>{timelineCheckLoading ? "Analyzing..." : timelineIssues.length > 0 ? `${timelineIssues.length} issue${timelineIssues.length > 1 ? "s" : ""} found` : "Check timeline for plot holes"}</p>
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
                            getProgressionTemplateCardsForProfile().map((templateCard, cardIndex) => {
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

                              const isLoreCard = templateCard.id === "template-lore" || templateCard.label.toLowerCase() === "lore" || templateCard.sourceKey.toLowerCase() === "notes" || templateCard.sourceKey.toLowerCase() === "lore";

                              return (
                                <div 
                                  key={templateCard.id} 
                                  className={`progression-template-display-card color-${templateCard.color || getProgressionCardColor(cardIndex, templateCard.type)} ${isLoreCard ? 'clickable' : ''}`}
                                  onClick={isLoreCard ? () => setShowLoreHistoryModal(true) : undefined}
                                >
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

                <div className="bible-premium-actions">
                  <button className="bible-premium-action" onClick={() => setActiveBiblePopup("extract")} title="Extract canon from the active chapter">
                    <Sparkles size={13} />
                    <span>Extract</span>
                    {bibleExtractionSuggestions.length > 0 && <strong>{bibleExtractionSuggestions.length}</strong>}
                  </button>
                  <button className="bible-premium-action" onClick={() => setActiveBiblePopup("canon")} title="Check the active chapter against Story Bible canon">
                    <ShieldAlert size={13} />
                    <span>Canon</span>
                    {bibleCanonConflicts.length > 0 && <strong>{bibleCanonConflicts.length}</strong>}
                  </button>
                  <button className="bible-premium-action" onClick={() => setActiveBiblePopup("timeline")} title="View chapter-aware Bible facts">
                    <History size={13} />
                    <span>Timeline</span>
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
                    const timelineCount = getBibleTimelineFacts(entry).length
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
                        {timelineCount > 0 && (
                          <span className="bible-entry-timeline-count">{timelineCount} facts</span>
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

            {/* TAB: NAME FORGE */}
            {activeSidebarTab === 'names' && (
              <div className="sidebar-tab-content name-forge-panel fade-in">
                <div className="name-forge-header">
                  <div>
                    <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Name Forge</span>
                    <p>Generate fresh fantasy names that avoid your World Bible.</p>
                  </div>
                  <span>{bibleEntries.length} saved</span>
                </div>

                <div className="name-forge-controls">
                  {[
                    { key: "category" as const, label: "Type", value: NAME_CATEGORY_OPTIONS.find(option => option.value === nameCategory)?.label || "Character" },
                    { key: "style" as const, label: "Style", value: NAME_STYLE_OPTIONS.find(option => option.value === nameStyle)?.label || "Wild Fantasy" },
                    { key: "style2" as const, label: "Mashup", value: nameStyle2 ? (NAME_STYLE_OPTIONS.find(option => option.value === nameStyle2)?.label || "Wild Fantasy") : "None" },
                    { key: "gender" as const, label: "Gender", value: NAME_GENDER_OPTIONS.find(option => option.value === nameGender)?.label || "Any" },
                    { key: "structure" as const, label: "Shape", value: NAME_STRUCTURE_OPTIONS.find(option => option.value === nameStructure)?.label || "Any Structure" },
                    { key: "tone" as const, label: "Tone", value: NAME_TONE_OPTIONS.find(option => option.value === nameTone)?.label || "Memorable" }
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className="name-picker-card"
                      onClick={() => setActiveNamePicker(item.key)}
                    >
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <ChevronDown size={13} />
                    </button>
                  ))}
                  {/* Collapsible custom prompt */}
                  <div className="name-collapsible-card" onClick={() => setShowNamePrompt(!showNamePrompt)}>
                    <div className="name-collapsible-header">
                      <span>{showNamePrompt ? "▾" : "▸"} Direction {nameCustomPrompt ? "✓" : ""}</span>
                      {!showNamePrompt && nameCustomPrompt && (
                        <small className="name-collapsible-preview">{nameCustomPrompt.slice(0, 50)}{nameCustomPrompt.length > 50 ? "…" : ""}</small>
                      )}
                    </div>
                    {showNamePrompt && (
                      <textarea
                        value={nameCustomPrompt}
                        onChange={(e) => setNameCustomPrompt(e.target.value)}
                        placeholder="Optional direction: desert elf princess, demon duke, thunder beast, sword sect elder..."
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    )}
                  </div>
                  {/* Collapsible syllable bank */}
                  <div className="name-collapsible-card" onClick={() => setShowNameSyllables(!showNameSyllables)}>
                    <div className="name-collapsible-header">
                      <span>{showNameSyllables ? "▾" : "▸"} Syllables {nameSyllableBank ? "✓" : ""}</span>
                      {!showNameSyllables && nameSyllableBank && (
                        <small className="name-collapsible-preview">{nameSyllableBank.slice(0, 50)}{nameSyllableBank.length > 50 ? "…" : ""}</small>
                      )}
                    </div>
                    {showNameSyllables && (
                      <textarea
                        value={nameSyllableBank}
                        onChange={(e) => setNameSyllableBank(e.target.value)}
                        placeholder="Custom syllables to include (comma-separated): zen, kai, lun, vra, this, mar..."
                        rows={2}
                        className="name-syllable-input"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="name-forge-actions-row">
                  <button
                    type="button"
                    className="name-forge-generate-btn"
                    onClick={() => generateNameOptions(false)}
                    disabled={nameGenerateLoading}
                  >
                    {nameGenerateLoading ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
                    {nameGenerateLoading ? "Forging..." : generatedNames.length > 0 ? "Reroll 5 Names" : "Generate 5 Names"}
                  </button>
                  {generatedNames.length > 0 && (
                    <button
                      type="button"
                      className="btn-ai-sub"
                      onClick={() => generateNameOptions(true)}
                      disabled={nameGenerateLoading}
                    >
                      {nameGenerateLoading ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                      Generate More
                    </button>
                  )}
                </div>

                {nameGenerateError && <div className="arc-seed-error">{nameGenerateError}</div>}

                {/* Batch actions bar */}
                {generatedNames.length > 0 && (
                  <div className="name-batch-actions">
                    <label className="name-batch-toggle">
                      <input
                        type="checkbox"
                        checked={selectedForBatch.size === generatedNames.length}
                        onChange={() => {
                          if (selectedForBatch.size === generatedNames.length) {
                            setSelectedForBatch(new Set())
                          } else {
                            setSelectedForBatch(new Set(generatedNames.map((_, i) => i)))
                          }
                        }}
                      />
                      Select all
                    </label>
                    {selectedForBatch.size > 0 && (
                      <button type="button" className="btn-ai-sub btn-ai-primary btn-sm" onClick={batchAddToBible}>
                        Add {selectedForBatch.size} to Bible
                      </button>
                    )}
                  </div>
                )}

                <div className="name-results-list">
                  {generatedNames.length === 0 && !nameGenerateLoading ? (
                    <div className="empty-state-text compact">No names generated yet.</div>
                  ) : generatedNames.map((option, idx) => (
                    <div key={`${option.name}-${idx}`} className="name-result-card">
                      <div className="name-result-card-header">
                        <label className="name-batch-checkbox" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedForBatch.has(idx)}
                            onChange={() => toggleBatchSelect(idx)}
                          />
                        </label>
                        <div className="name-result-main">
                          <small>{option.category} - {option.structure || nameStructure}</small>
                          <strong>{option.name}</strong>
                          <p>{option.meaning || option.vibe || option.bibleContent}</p>
                        </div>
                      </div>
                      <div className="name-result-meta">
                        {option.raceOrOrigin && <span>{option.raceOrOrigin}</span>}
                        {option.pronunciation && <span>{option.pronunciation}</span>}
                      </div>
                      <div className="name-result-actions">
                        <button
                          type="button"
                          className="btn-ai-sub btn-ai-primary"
                          onClick={() => acceptGeneratedName(option)}
                          disabled={acceptedNameId === normalizeNameForCompare(option.name)}
                        >
                          {acceptedNameId === normalizeNameForCompare(option.name) ? "Added" : "Add to Bible"}
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub"
                          onClick={() => {
                            setLoreEditorDraft(option)
                            setShowLoreEditor(true)
                          }}
                          title="Add with lore editor"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub"
                          onClick={(e) => insertNameAtCursor(e, option.name)}
                          title="Insert at cursor in editor"
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub"
                          onClick={() => addToShortlist(option)}
                          disabled={nameShortlist.some(n => normalizeNameForCompare(n.name) === normalizeNameForCompare(option.name))}
                          title="Save to shortlist"
                        >
                          <Bookmark size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-ai-sub"
                          onClick={() => generateNameVariants(option)}
                          disabled={nameVariantLoading}
                          title="Generate variants"
                        >
                          {nameVariantLoading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shortlist section */}
                {nameShortlist.length > 0 && (
                  <div className="name-shortlist-section">
                    <div className="name-shortlist-header">
                      <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Shortlist ({nameShortlist.length})</span>
                      <button className="btn-ai-sub btn-sm" onClick={() => setNameShortlist([])}>Clear</button>
                    </div>
                    {nameShortlist.map(option => (
                      <div key={option.name} className="name-shortlist-item">
                        <strong>{option.name}</strong>
                        <small>{option.category}</small>
                        <div className="name-shortlist-actions">
                          <button
                            className="btn-ai-sub btn-ai-primary btn-sm"
                            onClick={() => {
                              acceptGeneratedName(option)
                              removeFromShortlist(option.name)
                            }}
                          >Add</button>
                          <button
                            className="btn-ai-sub btn-sm"
                            onClick={() => removeFromShortlist(option.name)}
                          ><X size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lore Editor Modal */}
                {showLoreEditor && loreEditorDraft && (
                  <div className="name-picker-popover-overlay" onClick={() => { setShowLoreEditor(false); setLoreEditorDraft(null) }}>
                    <div className="name-picker-popover glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                      <div className="name-picker-popover-header">
                        <strong>Add Lore: {loreEditorDraft.name}</strong>
                        <button type="button" onClick={() => { setShowLoreEditor(false); setLoreEditorDraft(null) }} title="Close">
                          <X size={16} />
                        </button>
                      </div>
                      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <p style={{ fontSize: 12, color: "var(--dim)", margin: 0 }}>
                          {loreEditorDraft.meaning || loreEditorDraft.vibe || "No description yet."}
                        </p>
                        <button
                          className="btn-ai-sub btn-ai-primary"
                          onClick={acceptGeneratedNameWithLore}
                        >
                          <Check size={14} /> Save to Bible
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeNamePicker && (
                  <div className="name-picker-popover-overlay" onClick={() => setActiveNamePicker(null)}>
                    <div className="name-picker-popover glass" onClick={(e) => e.stopPropagation()}>
                      <div className="name-picker-popover-header">
                        <strong>
                          {activeNamePicker === "category" ? "Choose Type" :
                           activeNamePicker === "style" ? "Choose Style" :
                           activeNamePicker === "style2" ? "Choose Mashup Style (optional)" :
                           activeNamePicker === "gender" ? "Choose Gender" :
                           activeNamePicker === "structure" ? "Choose Shape" : "Choose Tone"}
                        </strong>
                        <button type="button" onClick={() => setActiveNamePicker(null)} title="Close">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="name-picker-options">
                        {(activeNamePicker === "category" ? NAME_CATEGORY_OPTIONS :
                          activeNamePicker === "style" ? NAME_STYLE_OPTIONS :
                          activeNamePicker === "style2" ? [{ value: "", label: "None (single style)", hint: "No mashup" }, ...nameStyle2Options] :
                          activeNamePicker === "gender" ? NAME_GENDER_OPTIONS :
                          activeNamePicker === "structure" ? NAME_STRUCTURE_OPTIONS :
                          NAME_TONE_OPTIONS).map(option => {
                            const isActive =
                              (activeNamePicker === "category" && option.value === nameCategory) ||
                              (activeNamePicker === "style" && option.value === nameStyle) ||
                              (activeNamePicker === "style2" && option.value === nameStyle2) ||
                              (activeNamePicker === "gender" && option.value === nameGender) ||
                              (activeNamePicker === "structure" && option.value === nameStructure) ||
                              (activeNamePicker === "tone" && option.value === nameTone)
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`name-picker-option ${isActive ? "active" : ""}`}
                                onClick={() => {
                                  if (activeNamePicker === "category") setNameCategory(option.value as BibleEntry["category"])
                                  else if (activeNamePicker === "style") setNameStyle(option.value)
                                  else if (activeNamePicker === "style2") setNameStyle2(option.value)
                                  else if (activeNamePicker === "gender") setNameGender(option.value)
                                  else if (activeNamePicker === "structure") setNameStructure(option.value)
                                  else if (activeNamePicker === "tone") setNameTone(option.value)
                                  setActiveNamePicker(null)
                                }}
                              >
                                <span>{option.label}</span>
                                <small>{option.hint}</small>
                                {isActive && <Check size={14} />}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}
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
                <div className="brain-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem', flexShrink: 0 }}>
                  <span className="section-title text-xs font-bold uppercase tracking-wider text-dim" style={{ marginBottom: 0 }}>Brain Map</span>
                  <button
                    className="brain-graph-btn glass-light"
                    onClick={() => setShowBrainGraph(true)}
                    title="Open Interactive Visual Graph"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--surface-border)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Network size={11} />
                    <span>View Graph</span>
                  </button>
                </div>

                {/* Compact Quick Action Badges */}
                <div className="brain-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginBottom: '0.75rem', flexShrink: 0 }}>
                  <button
                    className="brain-action-card glass-light"
                    onClick={() => setActiveBrainPopup('ask')}
                    title="Ask Brain Map"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 0.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--surface-border)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <MessageSquare size={14} />
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ask Brain</span>
                  </button>

                  <button
                    className="brain-action-card glass-light"
                    onClick={() => setActiveBrainPopup('suggestions')}
                    title="Suggested Lore Additions"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 0.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--surface-border)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      position: 'relative'
                    }}
                  >
                    <Sparkles size={14} style={{ color: '#c084fc' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggestions</span>
                    {suggestedEntities.length > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: 'var(--primary)',
                        color: 'white',
                        fontSize: '0.55rem',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 6px var(--primary)'
                      }}>{suggestedEntities.length}</span>
                    )}
                  </button>

                  <button
                    className="brain-action-card glass-light"
                    onClick={() => setActiveBrainPopup('continuity')}
                    title="Lore Continuity Checker"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 0.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--surface-border)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      position: 'relative'
                    }}
                  >
                    <ShieldAlert size={14} style={{ color: '#fbbf24' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Continuity</span>
                    {consistencyWarnings.length > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.55rem',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 6px #ef4444'
                      }}>{consistencyWarnings.length}</span>
                    )}
                  </button>

                </div>

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
                                {(() => {
                                  const updateCount = (entry.aiSummary.match(/### 🔄 Update:/g) || []).length
                                  if (updateCount > 0) {
                                    return (
                                      <span className="brain-connection-count" style={{ color: '#c084fc', marginLeft: '0.4rem' }}>
                                        <RefreshCw size={10} />
                                        {updateCount} update{updateCount === 1 ? '' : 's'}
                                      </span>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                              <button 
                                className="btn-delete-chapter brain-card-delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const confirmed = window.confirm("Delete this Brain Map entry? This cannot be undone.")
                                  if (confirmed) deleteBrainEntry(entry.id)
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

            {/* TAB: ARC SEEDS */}
            {activeSidebarTab === 'arcs' && (
              <div className="sidebar-tab-content arc-seeds-page fade-in">
                <div className="arc-seeds-page-header">
                  <div>
                    <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Arc Seeds</span>
                    <p>Future threads captured from completed chapters.</p>
                  </div>
                  <button
                    className="btn-new arc-seed-generate-btn"
                    onClick={generateArcSeedFromChapter}
                    disabled={arcSeedLoading || !activeNote}
                    title="Extract one future arc seed from the active chapter"
                  >
                    {arcSeedLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    {arcSeedLoading ? "Scanning..." : "Scan Chapter"}
                  </button>
                </div>

                {arcSeedError && <div className="arc-seed-error">{arcSeedError}</div>}

                <div className="arc-seed-stat-grid">
                  <div className="arc-seed-stat-card">
                    <small>All Seeds</small>
                    <strong>{arcSeeds.length}</strong>
                  </div>
                  <div className="arc-seed-stat-card active">
                    <small>Open</small>
                    <strong>{openArcSeedCount}</strong>
                  </div>
                  <div className="arc-seed-stat-card">
                    <small>Developing</small>
                    <strong>{arcSeeds.filter(seed => seed.status === "developing").length}</strong>
                  </div>
                </div>

                <div className="arc-seed-toolbar">
                  <div className="search-bar">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search arc seeds..."
                      value={arcSeedSearchQuery}
                      onChange={(e) => setArcSeedSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <select
                    value={arcSeedStatusFilter}
                    onChange={(e) => setArcSeedStatusFilter(e.target.value as ArcSeedStatus | 'all')}
                    className="brain-type-filter"
                  >
                    <option value="all">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="developing">Developing</option>
                    <option value="paid_off">Paid Off</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>

                <div className="arc-seeds-panel">
                  <div className="arc-seeds-header">
                    <div>
                      <strong>Saved Arc Seeds</strong>
                      <span>{filteredArcSeeds.length} shown</span>
                    </div>
                    <em>{openArcSeedCount} open</em>
                  </div>
                  <div className="arc-seeds-list arc-seeds-page-list">
                    {filteredArcSeeds.length === 0 ? (
                      <div className="empty-state-text compact">
                        {arcSeeds.length === 0 ? "No Arc Seeds yet." : "No Arc Seeds match this filter."}
                      </div>
                    ) : filteredArcSeeds.map(seed => (
                      <button
                        key={seed.id}
                        type="button"
                        className={`arc-seed-card status-${seed.status}`}
                        onClick={() => setSelectedArcSeedId(seed.id)}
                      >
                        <div>
                          <small>{getArcSeedChapterLabel(seed)}</small>
                          <strong>{seed.title}</strong>
                          <p>{seed.summary || seed.futurePayoff}</p>
                        </div>
                        <span>{seed.status.replace("_", " ")}</span>
                      </button>
                    ))}
                  </div>
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
                    <button className="fmt-btn" onClick={() => applyFormatting("```\r\n", "\r\n```")} title="Code Block">
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
                <span>{activeBibleEntry.category === "character" || activeBibleEntry.category === "beast" ? "Character Details" : "Edit Lore Entry"}</span>
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

              {(activeBibleEntry.category === "character" || activeBibleEntry.category === "beast") && (() => {
                const details = getBibleCharacterDetails(activeBibleEntry)
                const hasChapterLooks = details.chapterAppearances.length > 0
                const latestLook = hasChapterLooks ? details.chapterAppearances[details.chapterAppearances.length - 1] : null
                const hasAnyDetail = details.appearance || details.hair || details.eyes || details.body || details.attire || details.distinguishingFeatures || latestLook
                return (
                  <div className="ai-form-field">
                    <label>Character Details</label>

                    {/* Key Appearance Details summary card — shows at a glance when clicking a Bible name */}
                    {hasAnyDetail && (
                      <div className="character-detail-summary">
                        <div className="character-detail-summary-header">
                          <span>Key Appearance Details</span>
                          {latestLook && <span className="appearance-chapter-chip">{getBibleFactChapterLabel(latestLook)}</span>}
                        </div>
                        <div className="character-detail-summary-grid">
                          {details.appearance && (
                            <div className="character-detail-summary-item full">
                              <small>Overall</small>
                              <p>{details.appearance}</p>
                            </div>
                          )}
                          {details.hair && (
                            <div className="character-detail-summary-item">
                              <small>Hair</small>
                              <p>{details.hair}</p>
                            </div>
                          )}
                          {details.eyes && (
                            <div className="character-detail-summary-item">
                              <small>Eyes</small>
                              <p>{details.eyes}</p>
                            </div>
                          )}
                          {details.body && (
                            <div className="character-detail-summary-item">
                              <small>Build</small>
                              <p>{details.body}</p>
                            </div>
                          )}
                          {details.attire && (
                            <div className="character-detail-summary-item">
                              <small>Attire</small>
                              <p>{details.attire}</p>
                            </div>
                          )}
                          {details.distinguishingFeatures && (
                            <div className="character-detail-summary-item full">
                              <small>Distinguishing Features</small>
                              <p>{details.distinguishingFeatures}</p>
                            </div>
                          )}
                          {latestLook && (latestLook.appearance || latestLook.hair || latestLook.eyes || latestLook.attire || latestLook.body || latestLook.distinguishingFeatures) && (
                            <div className="character-detail-summary-item full">
                              <small>Latest Chapter Appearance</small>
                              <p>
                                {[latestLook.appearance, latestLook.hair, latestLook.eyes, latestLook.body, latestLook.attire, latestLook.distinguishingFeatures].filter(Boolean).join(" — ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="character-detail-panel">
                      <label>
                        <small>Overall Look</small>
                        <textarea
                          value={details.appearance}
                          onChange={(e) => updateActiveBibleCharacterDetails({ appearance: e.target.value })}
                          placeholder="Face, aura, silhouette, general visual impression..."
                          className="ai-textarea compact"
                        />
                      </label>
                      <div className="character-detail-grid">
                        <label>
                          <small>Hair</small>
                          <input className="ai-input" value={details.hair} onChange={(e) => updateActiveBibleCharacterDetails({ hair: e.target.value })} placeholder="Black curls, silver braid..." />
                        </label>
                        <label>
                          <small>Eyes</small>
                          <input className="ai-input" value={details.eyes} onChange={(e) => updateActiveBibleCharacterDetails({ eyes: e.target.value })} placeholder="Gold, violet, tired..." />
                        </label>
                        <label>
                          <small>Build / Body</small>
                          <input className="ai-input" value={details.body} onChange={(e) => updateActiveBibleCharacterDetails({ body: e.target.value })} placeholder="Tall, wiry, scarred..." />
                        </label>
                        <label>
                          <small>Attire</small>
                          <input className="ai-input" value={details.attire} onChange={(e) => updateActiveBibleCharacterDetails({ attire: e.target.value })} placeholder="Robes, armor, uniform..." />
                        </label>
                      </div>
                      <label>
                        <small>Distinguishing Features</small>
                        <textarea
                          value={details.distinguishingFeatures}
                          onChange={(e) => updateActiveBibleCharacterDetails({ distinguishingFeatures: e.target.value })}
                          placeholder="Scars, tattoos, accessories, posture, aura..."
                          className="ai-textarea compact"
                        />
                      </label>
                    </div>

                    <div className="character-detail-history">
                      <div className="character-detail-history-header">
                        <strong>Chapter Appearance Memory</strong>
                        <span>{hasChapterLooks ? `${details.chapterAppearances.length} saved` : "No appearance notes yet"}</span>
                      </div>
                      {!hasChapterLooks ? (
                        <span className="empty-state-text compact">No chapter-specific appearance notes yet.</span>
                      ) : details.chapterAppearances.map((fact, factIdx) => {
                        const prevFact = factIdx > 0 ? details.chapterAppearances[factIdx - 1] : null
                        const diffs: string[] = []
                        if (prevFact) {
                          if (fact.hair && fact.hair !== prevFact.hair) diffs.push(`hair: ${prevFact.hair || "?"} → ${fact.hair}`)
                          if (fact.eyes && fact.eyes !== prevFact.eyes) diffs.push(`eyes: ${prevFact.eyes || "?"} → ${fact.eyes}`)
                          if (fact.attire && fact.attire !== prevFact.attire) diffs.push(`attire: ${prevFact.attire || "?"} → ${fact.attire}`)
                          if (fact.body && fact.body !== prevFact.body) diffs.push(`body: ${prevFact.body || "?"} → ${fact.body}`)
                          if (fact.distinguishingFeatures && fact.distinguishingFeatures !== prevFact.distinguishingFeatures) diffs.push(`features: changed`)
                        }
                        return (
                          <div className="bible-timeline-fact" key={fact.id}>
                            <div>
                              <strong>{getBibleFactChapterLabel(fact)}</strong>
                              {(fact.hair || fact.eyes || fact.attire) && <em>{[fact.hair, fact.eyes, fact.attire].filter(Boolean).slice(0, 2).join(" / ")}</em>}
                            </div>
                            <p>{fact.summary}</p>
                            {fact.evidence && <small>&ldquo;{fact.evidence}&rdquo;</small>}
                            {diffs.length > 0 && (
                              <div style={{ marginTop: "0.3rem", padding: "0.25rem 0.4rem", background: "rgba(251,191,36,0.08)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem" }}>
                                <small style={{ color: "var(--yellow-500)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.04em" }}>Changes from previous chapter</small>
                                <ul style={{ margin: "0.15rem 0 0", paddingLeft: "1rem", color: "var(--text-secondary)" }}>
                                  {diffs.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <div className="ai-form-field">
                <label>Timeline Facts</label>
                <div className="bible-timeline-panel">
                  {getBibleTimelineFacts(activeBibleEntry).length === 0 ? (
                    <span className="empty-state-text compact">No chapter-specific facts yet. Use Extract from the World Bible panel to add them.</span>
                  ) : getBibleTimelineFacts(activeBibleEntry).map(fact => (
                    <div className="bible-timeline-fact" key={fact.id}>
                      <div>
                        <strong>{getBibleFactChapterLabel(fact)}</strong>
                        {fact.status && <em>{fact.status}</em>}
                      </div>
                      <p>{fact.summary}</p>
                      {fact.evidence && <small>&ldquo;{fact.evidence}&rdquo;</small>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="ai-form-field flex-1 flex flex-col min-h-[300px]">
                <label>{activeBibleEntry.category === "character" || activeBibleEntry.category === "beast" ? "Reference Notes" : "Notes & Descriptions"}</label>
                <textarea 
                  value={activeBibleEntry.content}
                  onChange={(e) => updateActiveBibleEntry({ content: e.target.value })}
                  placeholder={activeBibleEntry.category === "character" || activeBibleEntry.category === "beast" ? "Biography, personality, relationships, role, and non-visual lore..." : "Write biography, characteristics, locations details, and lore notes..."}
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

        {selectedArcSeed && (
          <div className="modal-overlay" onClick={() => setSelectedArcSeedId(null)}>
            <div className="modal arc-seed-detail-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header brain-detail-header">
                <div>
                  <h2 className="modal-title">Arc Seed</h2>
                  <p className="modal-description">{getArcSeedChapterLabel(selectedArcSeed)} - {selectedArcSeed.chapterTitle || "Untitled"}</p>
                </div>
                <button className="btn-close-ai" onClick={() => setSelectedArcSeedId(null)} title="Close"><X size={16} /></button>
              </div>

              <div className="arc-seed-detail-body">
                <label className="ai-form-field">
                  <span>Seed Title</span>
                  <input
                    className="ai-input"
                    value={selectedArcSeed.title}
                    onChange={(e) => updateArcSeed(selectedArcSeed.id, { title: e.target.value })}
                  />
                </label>

                <label className="ai-form-field">
                  <span>Status</span>
                  <select
                    className="ai-select"
                    value={selectedArcSeed.status}
                    onChange={(e) => updateArcSeed(selectedArcSeed.id, { status: e.target.value as ArcSeedStatus })}
                  >
                    <option value="open">Open</option>
                    <option value="developing">Developing</option>
                    <option value="paid_off">Paid Off</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </label>

                <label className="ai-form-field">
                  <span>What Happened</span>
                  <textarea
                    className="ai-textarea compact"
                    value={selectedArcSeed.summary}
                    onChange={(e) => updateArcSeed(selectedArcSeed.id, { summary: e.target.value })}
                  />
                </label>

                <label className="ai-form-field">
                  <span>Why It Matters</span>
                  <textarea
                    className="ai-textarea compact"
                    value={selectedArcSeed.whyItMatters}
                    onChange={(e) => updateArcSeed(selectedArcSeed.id, { whyItMatters: e.target.value })}
                  />
                </label>

                <label className="ai-form-field">
                  <span>Possible Future Payoff</span>
                  <textarea
                    className="ai-textarea compact"
                    value={selectedArcSeed.futurePayoff}
                    onChange={(e) => updateArcSeed(selectedArcSeed.id, { futurePayoff: e.target.value })}
                  />
                </label>

                {(selectedArcSeed.relatedCharacters?.length || selectedArcSeed.relatedEntities?.length) ? (
                  <div className="arc-seed-chip-row">
                    {[...(selectedArcSeed.relatedCharacters || []), ...(selectedArcSeed.relatedEntities || [])].slice(0, 10).map(item => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}

                <div className="brain-detail-section">
                  <span className="brain-detail-label">Chapter Evidence</span>
                  <div className="brain-detail-summary">
                    {selectedArcSeed.evidence || "No direct evidence saved."}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn btn-ghost danger-text"
                  onClick={() => {
                    const confirmed = window.confirm("Delete this Arc Seed? This cannot be undone.")
                    if (confirmed) deleteArcSeed(selectedArcSeed.id)
                  }}
                >
                  Delete
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedArcSeedId(null)}>Done</button>
              </div>
            </div>
          </div>
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
                <span className="brain-detail-label">AI Analysis History</span>
                {selectedBrainEntry.aiSummary === "Analyzing..." ? (
                  <div className="brain-detail-summary">
                    <span className="brain-loading">
                      <Loader2 size={14} className="spin" />
                      Analyzing...
                    </span>
                  </div>
                ) : (
                  <div className="brain-segments-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem', marginTop: '0.4rem' }}>
                    {parseAiSummarySegments(selectedBrainEntry.aiSummary).map((seg) => (
                      <div 
                        key={seg.id} 
                        className="brain-segment-card"
                        onClick={() => setSelectedSegment(seg)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--surface-border)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          minHeight: '80px',
                          textAlign: 'left'
                        }}
                      >
                        <strong style={{ fontSize: '0.74rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {seg.title.includes('Update') || seg.title.includes('🔄') ? <RefreshCw size={10} /> : seg.title.includes('Sub-Entity') || seg.title.includes('📍') ? <MapPin size={10} /> : seg.title.includes('Merged') || seg.title.includes('🔗') ? <Link2 size={10} /> : <FileText size={10} />}
                          {seg.title}
                        </strong>
                        <p style={{ 
                          fontSize: '0.7rem', 
                          color: 'var(--text-secondary)', 
                          margin: 0,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.4'
                        }}>
                          {seg.content.replace(/[#*`\n]/g, ' ').trim()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(selectedBrainEntry.connections || []).length > 0 && (
                <div className="brain-detail-section">
                  <span className="brain-detail-label">Connections</span>
                  <div className="brain-connection-list">
                    {selectedBrainEntry.connections?.map(connection => (
                      <div 
                        key={connection} 
                        className="brain-connection-item clickable"
                        style={{ cursor: 'pointer', opacity: 0.85, transition: 'opacity 0.2s' }}
                        onClick={() => {
                          const found = brainEntries.find(e => e.entityName && e.entityName.trim().toLowerCase() === connection.trim().toLowerCase());
                          if (found) {
                            setSelectedBrainEntryId(found.id);
                          } else {
                            const foundAlt = brainEntries.find(e => e.highlightedText && e.highlightedText.trim().toLowerCase() === connection.trim().toLowerCase());
                            if (foundAlt) {
                              setSelectedBrainEntryId(foundAlt.id);
                            }
                          }
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                      >
                        <Link2 size={12} />
                        <span style={{ textDecoration: 'underline', color: 'var(--text-accent)' }}>{connection}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="brain-detail-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%', borderTop: '1px solid var(--surface-border)', paddingTop: '0.85rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1, minWidth: '200px' }}>
                  <select 
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    style={{ 
                      flex: 1, 
                      fontSize: '0.74rem', 
                      padding: '0.4rem 0.5rem', 
                      background: 'rgba(255,255,255,0.04)', 
                      border: '1px solid var(--surface-border)', 
                      borderRadius: 'var(--radius-md)', 
                      color: 'var(--text-primary)',
                      outline: 'none',
                      minWidth: '120px'
                    }}
                  >
                    <option value="" style={{ background: '#0a0a0f' }}>-- Merge Into --</option>
                    {brainEntries
                      .filter(e => e.id !== selectedBrainEntry.id)
                      .sort((a, b) => (a.entityName || a.highlightedText || '').localeCompare(b.entityName || b.highlightedText || ''))
                      .map(e => (
                        <option key={e.id} value={e.id} style={{ background: '#0a0a0f' }}>
                          {e.entityName || e.highlightedText} ({e.entityType || 'unknown'})
                        </option>
                      ))
                    }
                  </select>
                  <button
                    className="btn-ai-sub btn-ai-secondary"
                    disabled={!mergeTargetId}
                    onClick={() => handleManualMerge(selectedBrainEntry.id, mergeTargetId)}
                    style={{ 
                      fontSize: '0.72rem', 
                      padding: '0.42rem 0.8rem', 
                      whiteSpace: 'nowrap', 
                      cursor: mergeTargetId ? 'pointer' : 'not-allowed',
                      opacity: mergeTargetId ? 1 : 0.5
                    }}
                  >
                    Merge Into
                  </button>
                </div>
                <button
                  className="btn-ai-sub btn-ai-secondary danger-text"
                  onClick={() => {
                    const confirmed = window.confirm("Delete this Brain Map entry? This cannot be undone.")
                    if (confirmed) deleteBrainEntry(selectedBrainEntry.id)
                  }}
                  style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.42rem 0.8rem', 
                    whiteSpace: 'nowrap',
                    marginLeft: 'auto'
                  }}
                >
                  <Trash2 size={13} style={{ marginRight: '0.25rem' }} />
                  Delete Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedBrainEntity && (() => {
          const linkedBibleEntry = bibleEntries.find(e => e.name.toLowerCase() === selectedBrainEntity.name.toLowerCase());
          return (
            <div className="modal-overlay" onClick={() => { setSelectedBrainEntityName(null); setIsEditingDossier(false); }}>
              <div className="modal brain-detail-modal brain-entity-modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '860px', width: '90vw' }}>
                <div className="modal-header brain-detail-header">
                  <div>
                    <h2 className="modal-title">{selectedBrainEntity.name}</h2>
                    <p className="modal-description">
                      {getBrainTypeLabel(selectedBrainEntity.type)} dossier - {selectedBrainEntity.entries.length} occurrence{selectedBrainEntity.entries.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    className="btn-close-ai"
                    onClick={() => { setSelectedBrainEntityName(null); setIsEditingDossier(false); }}
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="brain-detail-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
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
                  {dossierMessage && (
                    <span className="dossier-success-msg" style={{ fontSize: '0.72rem', color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>{dossierMessage}</span>
                  )}
                </div>

                <div className="dossier-split-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginTop: '0.75rem', maxHeight: '520px', overflow: 'hidden' }}>
                  {/* Left Column: Story Bible Dossier Bio */}
                  <div className="dossier-left-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid var(--surface-border)', paddingRight: '1.25rem' }}>
                    <div className="dossier-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="brain-detail-label" style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Story Bible Profile</span>
                      <div className="dossier-action-buttons" style={{ display: 'flex', gap: '0.35rem' }}>
                        {linkedBibleEntry ? (
                          <>
                            {isEditingDossier ? (
                              <button
                                className="btn-ai-sub btn-ai-secondary"
                                onClick={() => {
                                  handleSaveDossierText(selectedBrainEntity.name, dossierEditText);
                                  setIsEditingDossier(false);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                <Check size={11} /> Save
                              </button>
                            ) : (
                              <button
                                className="btn-ai-sub btn-ai-secondary"
                                onClick={() => {
                                  setIsEditingDossier(true);
                                  setDossierEditText(linkedBibleEntry.content || "");
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                <Edit3 size={11} /> Edit
                              </button>
                            )}
                            <button
                              className="btn-ai-sub btn-ai-secondary"
                              onClick={() => generateEntityDossier(selectedBrainEntity.name, selectedBrainEntity.type)}
                              disabled={dossierLoading}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', cursor: 'pointer' }}
                            >
                              {dossierLoading ? <Loader2 size={11} className="spin" /> : <Wand2 size={11} />}
                              AI Re-Write
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn-ai-sub btn-ai-secondary text-accent"
                            onClick={() => generateEntityDossier(selectedBrainEntity.name, selectedBrainEntity.type)}
                            disabled={dossierLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', cursor: 'pointer', color: '#c084fc' }}
                          >
                            {dossierLoading ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />}
                            Generate AI Dossier
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="dossier-content-area" style={{ flex: 1, overflowY: 'auto', background: 'rgba(0, 0, 0, 0.16)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', padding: '0.75rem', minHeight: '300px' }}>
                      {isEditingDossier ? (
                        <textarea
                          className="dossier-textarea"
                          value={dossierEditText}
                          onChange={(e) => setDossierEditText(e.target.value)}
                          style={{ width: '100%', height: '100%', minHeight: '280px', background: 'transparent', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', lineHeight: '1.5', resize: 'none' }}
                        />
                      ) : linkedBibleEntry ? (
                        <div className="dossier-markdown-view" style={{ fontSize: '0.82rem', lineHeight: '1.55', color: 'var(--text-secondary)' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{linkedBibleEntry.content || "_No content written yet._"}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="dossier-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          <p>No canon dossier exists yet for this entity. Click &quot;Generate AI Dossier&quot; to compile one from mentions across your manuscript.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Occurrence Timeline */}
                  <div className="dossier-right-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span className="brain-detail-label" style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Occurrence Timeline</span>
                    <div className="occurrence-timeline-wrapper" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.4rem', position: 'relative' }}>
                      <div className="vertical-timeline-line" style={{ position: 'absolute', left: '7px', top: '5px', bottom: '5px', width: '2px', background: 'var(--surface-border)' }}></div>
                      <div className="occurrence-timeline-items" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedBrainEntity.entries
                          .slice()
                          .sort((a, b) => (getBrainEntryChapterNumber(a) || 9999) - (getBrainEntryChapterNumber(b) || 9999))
                          .map((entry) => (
                            <div key={entry.id} className="timeline-node-item" style={{ display: 'flex', gap: '0.75rem', position: 'relative', paddingLeft: '1.25rem' }}>
                              <div className="timeline-marker" style={{ position: 'absolute', left: '4px', top: '10px' }}>
                                <span className={`timeline-marker-dot importance-${getBrainEntryImportance(entry)}`} style={{
                                  display: 'block',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: getBrainEntryImportance(entry) === 'critical' ? '#ef4444' : getBrainEntryImportance(entry) === 'major' ? '#a855f7' : '#94a3b8',
                                  boxShadow: getBrainEntryImportance(entry) === 'critical' ? '0 0 6px #ef4444' : 'none'
                                }}></span>
                              </div>
                              <button
                                className="timeline-node-card glass-light"
                                onClick={() => {
                                  setSelectedBrainEntityName(null);
                                  setSelectedBrainEntryId(entry.id);
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.3rem',
                                  width: '100%',
                                  padding: '0.55rem 0.65rem',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--surface-border)',
                                  background: 'rgba(255,255,255,0.03)',
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                <div className="timeline-node-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.64rem', color: 'var(--text-dim)' }}>
                                  <span className="brain-chapter-badge" style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 5px', borderRadius: '3px' }}>{getBrainEntryChapterLabel(entry)}</span>
                                  <span className={`brain-importance-badge importance-${getBrainEntryImportance(entry)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <Star size={8} />
                                    {getBrainEntryImportance(entry)}
                                  </span>
                                </div>
                                <div className="timeline-node-card-highlight" style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                                  &ldquo;{entry.highlightedText}&rdquo;
                                </div>
                                <div className="timeline-node-card-summary" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                                  {entry.aiSummary.replace(/[#*`\n]/g, ' ').substring(0, 100).trim()}...
                                </div>
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <BrainGraphModalComponent
          isOpen={showBrainGraph}
          onClose={() => setShowBrainGraph(false)}
          brainEntityGroups={brainEntityGroups}
          onSelectEntity={(name) => setSelectedBrainEntityName(name)}
          bibleEntries={bibleEntries}
        />

        {selectedSegment && (
          <div className="modal-overlay" onClick={() => setSelectedSegment(null)} style={{ zIndex: 130 }}>
            <div className="modal brain-detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '90vw' }}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">{selectedSegment.title}</h2>
                  <p className="modal-description">AI analysis details for this entry event.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setSelectedSegment(null)} title="Close"><X size={16}/></button>
              </div>
              <div className="brain-markdown-view scrollbar" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedSegment.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* DEDICATED POPUP MODALS FOR BRAIN ACTIONS */}
        {activeBrainPopup === 'ask' && (
          <div className="modal-overlay" onClick={() => setActiveBrainPopup(null)} style={{ zIndex: 120 }}>
            <div className="modal brain-action-modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90vw' }}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Ask Brain Map</h2>
                  <p className="modal-description">Query your manuscript&apos;s lore database.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBrainPopup(null)} title="Close"><X size={16} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', margin: '0.85rem 0 0.25rem' }}>
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
                  style={{ width: '100%', minHeight: '90px', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button
                  className="brain-ask-button"
                  onClick={askBrainMap}
                  disabled={brainAskLoading || !brainAskQuestion.trim()}
                  style={{ height: '34px', background: 'var(--primary)', border: 0, borderRadius: 'var(--radius-sm)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  {brainAskLoading ? <Loader2 size={13} className="spin" /> : <MessageSquare size={13} />}
                  Ask Question
                </button>
                
                {(brainAskAnswer || brainAskError) && (
                  <div className={`brain-ask-answer brain-markdown-view ${brainAskError ? 'error' : ''}`} style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.16)', padding: '0.75rem', borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto' }}>
                    {brainAskError ? brainAskError : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{brainAskAnswer}</ReactMarkdown>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBrainPopup === 'suggestions' && (
          <div className="modal-overlay" onClick={() => setActiveBrainPopup(null)} style={{ zIndex: 120 }}>
            <div className="modal brain-action-modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '90vw' }}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Suggested Lore Additions</h2>
                  <p className="modal-description">Scan active draft to find characters, items, or locations to add.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBrainPopup(null)} title="Close"><X size={16} /></button>
              </div>
              
              <div style={{ margin: '0.85rem 0 0.25rem' }}>
                <button
                  className="btn-ai-sub btn-ai-secondary"
                  onClick={fetchEntitySuggestions}
                  disabled={suggestionLoading || !activeNote}
                  style={{ width: '100%', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem', cursor: 'pointer' }}
                >
                  {suggestionLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                  Scan Draft for Entities
                </button>
                
                {suggestedEntities.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    <p className="suggested-subtitle" style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Click a chip to import it into your Brain Map:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {suggestedEntities.map((sug, i) => (
                        <button
                          key={i}
                          className="suggested-chip"
                          onClick={() => quickAddSuggestedEntity(sug)}
                          title={`Add "${sug.entityName}" - ${sug.aiSummary}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '16px',
                            border: '1px solid var(--surface-border)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                        >
                          <span>+ {sug.entityName}</span>
                          <small className={`type-${sug.entityType}`} style={{ textTransform: 'uppercase', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.2)' }}>{sug.entityType}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  !suggestionLoading && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      Click &quot;Scan Draft for Entities&quot; to check your active chapter draft.
                    </div>
                  )
                )}
                {suggestionLoading && (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    <Loader2 size={16} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                    Analyzing chapter draft and looking for new entities...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBrainPopup === 'continuity' && (
          <div className="modal-overlay" onClick={() => setActiveBrainPopup(null)} style={{ zIndex: 120 }}>
            <div className="modal brain-action-modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '90vw' }}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Continuity Tracker</h2>
                  <p className="modal-description">Audit active draft against Brain Map entries to spot conflicts.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBrainPopup(null)} title="Close"><X size={16} /></button>
              </div>
              
              <div style={{ margin: '0.85rem 0 0.25rem' }}>
                <button
                  className="btn-ai-sub btn-ai-secondary"
                  onClick={checkBrainConsistency}
                  disabled={consistencyLoading || !activeNote}
                  style={{ width: '100%', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem', cursor: 'pointer' }}
                >
                  {consistencyLoading ? <Loader2 size={13} className="spin" /> : <ShieldAlert size={13} />}
                  Audit Active Draft
                </button>
                
                {consistencyCheckedNoteId === activeNote?.id ? (
                  <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {consistencyWarnings.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', textAlign: 'center', color: '#10b981' }}>
                        <CheckCircle2 size={32} style={{ marginBottom: '0.5rem' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>All Clean!</span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>No continuity conflicts detected in this chapter.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Consistency conflicts detected in this chapter draft:</p>
                        {consistencyWarnings.map((warning, i) => (
                          <div key={i} className={`consistency-warning-card severity-${warning.severity}`} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            padding: '0.65rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: warning.severity === 'critical' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                            background: warning.severity === 'critical' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                            color: warning.severity === 'critical' ? '#f87171' : '#fbbf24',
                            fontSize: '0.78rem'
                          }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div className="warning-text">
                              <strong style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '0.72rem', display: 'block', marginBottom: '0.15rem' }}>{warning.entityName} ({warning.severity})</strong>
                              <span style={{ lineHeight: '1.45' }}>{warning.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  !consistencyLoading && (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      Click &quot;Audit Active Draft&quot; to analyze your draft for character/lore conflicts.
                    </div>
                  )
                )}
                
                {consistencyLoading && (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    <Loader2 size={16} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                    Auditing chapter continuity against Brain Map...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBiblePopup === 'extract' && (
          <div className="modal-overlay" onClick={() => setActiveBiblePopup(null)} style={{ zIndex: 120 }}>
            <div className="modal bible-action-modal glass" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Auto-Extract From Chapter</h2>
                  <p className="modal-description">Scan the active chapter for new canon, then approve what enters the Story Bible.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBiblePopup(null)} title="Close"><X size={16} /></button>
              </div>
              <button
                className="btn-ai-sub btn-ai-primary bible-action-run"
                onClick={scanChapterForBibleSuggestions}
                disabled={bibleExtractLoading || !activeNote}
              >
                {bibleExtractLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                Scan Active Chapter
              </button>
              <div className="bible-action-list">
                {bibleExtractionSuggestions.length === 0 && !bibleExtractLoading ? (
                  <div className="empty-state-text">No suggestions yet. Run a scan to find canon-worthy facts.</div>
                ) : bibleExtractionSuggestions.map((suggestion, index) => (
                  <div className="bible-suggestion-card" key={`${suggestion.entryName}-${index}`}>
                    <div className="bible-suggestion-head">
                      <strong>{suggestion.entryName}</strong>
                      <span>{suggestion.category}</span>
                    </div>
                    <p>{suggestion.summary}</p>
                    {suggestion.characterDetails && (
                      <div className="bible-suggestion-appearance">
                        {[
                          suggestion.characterDetails.appearance,
                          suggestion.characterDetails.hair,
                          suggestion.characterDetails.eyes,
                          suggestion.characterDetails.body,
                          suggestion.characterDetails.attire,
                          suggestion.characterDetails.distinguishingFeatures,
                          suggestion.characterDetails.chapterAppearance?.appearance,
                          suggestion.characterDetails.chapterAppearance?.hair,
                          suggestion.characterDetails.chapterAppearance?.eyes,
                          suggestion.characterDetails.chapterAppearance?.attire
                        ]
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((detail, detailIndex) => (
                            <span key={`${suggestion.entryName}-appearance-${detailIndex}`}>{detail}</span>
                          ))}
                      </div>
                    )}
                    {suggestion.timelineFact?.evidence && <small>&ldquo;{suggestion.timelineFact.evidence}&rdquo;</small>}
                    <button className="btn-ai-sub btn-ai-secondary" onClick={() => approveBibleExtractionSuggestion(suggestion)}>
                      <Check size={12} />
                      Approve to Bible
                    </button>
                  </div>
                ))}
                {bibleExtractLoading && (
                  <div className="empty-state-text">
                    <Loader2 size={16} className="spin" />
                    Scanning chapter for Bible additions...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBiblePopup === 'canon' && (
          <div className="modal-overlay" onClick={() => setActiveBiblePopup(null)} style={{ zIndex: 120 }}>
            <div className="modal bible-action-modal glass" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Canon Consistency Checker</h2>
                  <p className="modal-description">Audit the active chapter against Story Bible notes and timeline facts.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBiblePopup(null)} title="Close"><X size={16} /></button>
              </div>
              <button
                className="btn-ai-sub btn-ai-primary bible-action-run"
                onClick={checkBibleCanonConsistency}
                disabled={bibleCanonLoading || !activeNote}
              >
                {bibleCanonLoading ? <Loader2 size={13} className="spin" /> : <ShieldAlert size={13} />}
                Check Active Chapter
              </button>
              <div className="bible-action-list">
                {bibleCanonCheckedNoteId === activeNote?.id && bibleCanonConflicts.length === 0 && !bibleCanonLoading ? (
                  <div className="bible-clean-state">
                    <CheckCircle2 size={28} />
                    <strong>Canon looks clean.</strong>
                    <span>No Story Bible contradictions were detected in this chapter.</span>
                  </div>
                ) : bibleCanonConflicts.map((conflict, index) => (
                  <div className={`bible-conflict-card severity-${conflict.severity}`} key={`${conflict.entryName}-${index}`}>
                    <div>
                      <AlertTriangle size={14} />
                      <strong>{conflict.entryName}</strong>
                      <span>{conflict.severity}</span>
                    </div>
                    <p>{conflict.message}</p>
                    {conflict.chapterEvidence && <small>Chapter: &ldquo;{conflict.chapterEvidence}&rdquo;</small>}
                    {conflict.bibleEvidence && <small>Bible: &ldquo;{conflict.bibleEvidence}&rdquo;</small>}
                    {conflict.suggestedFix && <em>{conflict.suggestedFix}</em>}
                  </div>
                ))}
                {bibleCanonCheckedNoteId !== activeNote?.id && !bibleCanonLoading && bibleCanonConflicts.length === 0 && (
                  <div className="empty-state-text">Run a canon check to compare this chapter with the Story Bible.</div>
                )}
                {bibleCanonLoading && (
                  <div className="empty-state-text">
                    <Loader2 size={16} className="spin" />
                    Checking canon against Story Bible...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBiblePopup === 'timeline' && (
          <div className="modal-overlay" onClick={() => setActiveBiblePopup(null)} style={{ zIndex: 120 }}>
            <div className="modal bible-action-modal glass" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Timeline-Aware Bible</h2>
                  <p className="modal-description">Chapter-specific canon facts across all Story Bible entries.</p>
                </div>
                <button className="btn-close-ai" onClick={() => setActiveBiblePopup(null)} title="Close"><X size={16} /></button>
              </div>
              <div className="bible-action-list">
                {bibleEntries.flatMap(entry => getBibleTimelineFacts(entry).map(fact => ({ entry, fact }))).length === 0 ? (
                  <div className="empty-state-text">No timeline facts yet. Use Auto-Extract From Chapter to create them.</div>
                ) : bibleEntries
                  .flatMap(entry => getBibleTimelineFacts(entry).map(fact => ({ entry, fact })))
                  .sort((a, b) => Number(a.fact.chapterNumber || 0) - Number(b.fact.chapterNumber || 0))
                  .map(({ entry, fact }) => (
                    <button
                      className="bible-timeline-row"
                      key={`${entry.id}-${fact.id}`}
                      onClick={() => {
                        setActiveBibleEntryId(entry.id)
                        setIsBibleDrawerOpen(true)
                        setActiveBiblePopup(null)
                      }}
                    >
                      <span>{getBibleFactChapterLabel(fact)}</span>
                      <strong>{entry.name}</strong>
                      <p>{fact.summary}</p>
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
                      <span>Bloodline</span>
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {}).Bloodline || ""} onChange={(e) => setProgressionDraftCustomField("Bloodline", e.target.value)} placeholder="Ancient Phoenix Bloodline" />
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {})["Bloodline Rank"] || ""} onChange={(e) => setProgressionDraftCustomField("Bloodline Rank", e.target.value)} placeholder="Supreme / Celestial" />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Affinity</span>
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {})["Affinity Names"] || ""} onChange={(e) => setProgressionDraftCustomField("Affinity Names", e.target.value)} placeholder="Fire, Ice, Void" />
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {})["Affinity Rank"] || ""} onChange={(e) => setProgressionDraftCustomField("Affinity Rank", e.target.value)} placeholder="Fire (High), Ice (Celestial), Void (Supreme)" />
                    </div>
                    <div className="progression-profile-edit-card">
                      <span>Class</span>
                      <input className="ai-input" value={progressionEditProfileDraft.className || ""} onChange={(e) => setProgressionDraftField("className", e.target.value)} placeholder="Main class" />
                      <input className="ai-input" value={(progressionEditProfileDraft.customFields || {})["Secondary Class"] || ""} onChange={(e) => setProgressionDraftCustomField("Secondary Class", e.target.value)} placeholder="Secondary class" />
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
                      .filter(fieldName => !["Affiliation", "Bloodline", "Bloodline Rank", "Bloodline Grade", "Affinity", "Affinity Names", "Affinity Rank", "Affinity Grade", "Rank", "Secondary Class", "Race"].includes(fieldName) && (progressionEditProfileDraft.customFields || {})[fieldName])
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

        {showLoreHistoryModal && selectedProgressionProfile && (
          <div className="modal-overlay" onClick={() => setShowLoreHistoryModal(false)}>
            <div className="modal progression-lore-history-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "550px" }}>
              <div className="modal-header">
                <h2 className="modal-title">Lore History</h2>
                <p className="modal-description">Captured timeline of growth and events for <strong>{selectedProgressionProfile.name}</strong>.</p>
              </div>
              <div className="progression-lore-modal-list scrollbar" style={{ maxHeight: "350px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem", margin: "1rem 0", paddingRight: "0.25rem" }}>
                {(() => {
                  const loreEntries = selectedProgressionProfile.loreEntries || []
                  const listToShow = loreEntries.length > 0
                    ? [...loreEntries].sort((a, b) => b.timestamp - a.timestamp)
                    : []

                  if (listToShow.length === 0) {
                    return <div className="empty-state-text">No lore notes recorded yet.</div>
                  }

                  return listToShow.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="progression-lore-history-entry" 
                      style={{ 
                        padding: "0.85rem", 
                        background: "rgba(255, 255, 255, 0.03)", 
                        border: "1px solid rgba(255, 255, 255, 0.06)", 
                        borderRadius: "var(--radius-md)" 
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--indigo-400)", fontWeight: 600 }}>
                          {entry.chapterNumber !== undefined && entry.chapterNumber !== null
                            ? `Chapter ${entry.chapterNumber}${entry.chapterTitle ? `: ${entry.chapterTitle}` : ""}`
                            : entry.chapterTitle
                            ? entry.chapterTitle
                            : "Manual Profile Entry"}
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>
                            {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            className="btn-icon btn-icon-sm"
                            onClick={() => {
                              if (!window.confirm("Delete this lore entry?")) return
                              updateProgressionProfile(selectedProgressionProfile.id, (profile) => ({
                                ...profile,
                                loreEntries: (profile.loreEntries || []).filter(e => e.id !== entry.id),
                                updatedAt: Date.now()
                              }))
                            }}
                            title="Delete lore entry"
                            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "2px", fontSize: "0.85rem", lineHeight: 1, opacity: 0.5, transition: "opacity 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                          >✕</button>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.82rem", lineHeight: "1.4", color: "var(--text-main)", whiteSpace: "pre-wrap", margin: 0 }}>
                        {entry.text}
                      </p>
                    </div>
                  ))
                })()}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowLoreHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showTimelineCheckModal && (
          <div className="modal-overlay" onClick={() => setShowTimelineCheckModal(false)}>
            <div className="modal progression-template-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px" }}>
              <div className="modal-header">
                <h2 className="modal-title">Timeline Consistency Check</h2>
                <p className="modal-description">
                  {timelineIssues.length > 0
                    ? `Found ${timelineIssues.length} potential issue${timelineIssues.length > 1 ? "s" : ""} across the manuscript.`
                    : "No timeline issues detected. Your story is consistent."}
                  {timelineCheckTimestamp && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", display: "block", marginTop: "0.25rem" }}>
                      Last checked: {new Date(timelineCheckTimestamp).toLocaleString()} — cached results shown unless data changed
                    </span>
                  )}
                </p>
              </div>
              <div className="progression-template-modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
                {timelineIssues.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>
                    <CheckCircle2 size={32} style={{ color: "var(--green-500)", marginBottom: "0.75rem" }} />
                    <p>All clear! Character progression timelines are consistent across all chapters.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {timelineIssues.map((issue, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "0.85rem",
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${issue.severity === "critical" ? "rgba(239,68,68,0.3)" : "rgba(234,179,8,0.3)"}`,
                          borderRadius: "var(--radius-md)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <AlertTriangle size={14} color={issue.severity === "critical" ? "var(--red-500)" : "var(--yellow-500)"} />
                            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{issue.characterName}</span>
                            <span style={{
                              fontSize: "0.65rem",
                              padding: "1px 6px",
                              borderRadius: "var(--radius-sm)",
                              background: issue.severity === "critical" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                              color: issue.severity === "critical" ? "var(--red-500)" : "var(--yellow-500)"
                            }}>
                              {issue.severity}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "capitalize" }}>
                            {issue.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", margin: "0 0 0.4rem 0", color: "var(--text-main)" }}>{issue.message}</p>
                        {issue.chaptersInvolved.length > 0 && (
                          <small style={{ color: "var(--indigo-400)", fontSize: "0.7rem" }}>
                            Chapters: {issue.chaptersInvolved.join(", ")}
                          </small>
                        )}
                        <p style={{ fontSize: "0.75rem", margin: "0.3rem 0 0 0", color: "var(--text-dim)", fontStyle: "italic" }}>
                          Suggestion: {issue.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowTimelineCheckModal(false)}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowTimelineCheckModal(false)
                    setTimeout(() => checkTimelineConsistency(true), 100)
                  }}
                  disabled={timelineCheckLoading}
                >
                  {timelineCheckLoading ? <><Loader2 className="spin" size={14} /> Checking...</> : "Re-check (force)"}
                </button>
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
                <div className="progression-template-mode-switch">
                  <button
                    type="button"
                    className={!progressionSystem.useCustomJsonTemplate ? "active" : ""}
                    onClick={() => persistProgressionSystem({
                      ...progressionSystem,
                      useCustomJsonTemplate: false
                    })}
                  >
                    <Layers size={13} />
                    Visual Cards
                  </button>
                  <button
                    type="button"
                    className={progressionSystem.useCustomJsonTemplate ? "active" : ""}
                    onClick={() => persistProgressionSystem({
                      ...progressionSystem,
                      useCustomJsonTemplate: true
                    })}
                  >
                    <Code size={13} />
                    JSON Builder
                  </button>
                </div>

                {progressionSystem.useCustomJsonTemplate ? (
                  <div className="json-template-editor-section">
                    {(() => {
                      let parsedTemplate: Record<string, any> = {}
                      let parseError = ""
                      try {
                        const parsed = progressionSystem.customJsonTemplate ? JSON.parse(progressionSystem.customJsonTemplate) : {}
                        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                          parsedTemplate = parsed
                        } else {
                          parseError = "Template must be a JSON object."
                        }
                      } catch (err) {
                        parseError = (err as Error).message
                      }
                      const orderedKeys = getOrderedJsonTemplateKeys(parsedTemplate)

                      return (
                        <>
                          <div className="progression-json-builder-panel">
                            <div className="progression-template-header">
                              <div>
                                <strong>Guided JSON Status Builder</strong>
                                <span>Add status cards and fields visually. PenPad keeps the starter JSON and card order in sync.</span>
                              </div>
                              <button
                                type="button"
                                className="btn-ai-sub btn-ai-primary"
                                onClick={convertProgressionCardsToJsonTemplate}
                              >
                                <RefreshCw size={12} />
                                Build From Current Cards
                              </button>
                            </div>

                            {parseError ? (
                              <div className="json-validation-error progression-json-builder-warning">
                                <AlertCircle size={13} />
                                Invalid JSON preview: {parseError}
                              </div>
                            ) : (
                              <div className="json-validation-success progression-json-builder-warning">
                                <Check size={13} />
                                {orderedKeys.length} JSON status cards ready: {orderedKeys.join(", ") || "none yet"}
                              </div>
                            )}

                            <div className="progression-json-builder-list">
                              {orderedKeys.length === 0 ? (
                                <div className="empty-state-text compact">No JSON cards yet. Add one below or convert the current visual template.</div>
                              ) : orderedKeys.map((key, index) => {
                                const value = parsedTemplate[key]
                                const fieldKind = getJsonTemplateFieldKind(value)
                                const objectValue = fieldKind === "object" ? value as Record<string, any> : {}
                                const listValue = fieldKind === "list" ? value as any[] : []

                                return (
                                  <div className="progression-json-builder-card" key={key}>
                                    <div className="progression-json-builder-row">
                                      <label>
                                        <span>Card Key</span>
                                        <input
                                          className="ai-input"
                                          defaultValue={key}
                                          onBlur={(e) => renameJsonTemplateField(key, e.target.value)}
                                          placeholder="cultivationRealm"
                                        />
                                      </label>
                                      <label>
                                        <span>Value Type</span>
                                        <select
                                          className="ai-select"
                                          value={fieldKind}
                                          onChange={(e) => updateJsonTemplateFieldKind(key, e.target.value as ProgressionJsonTemplateFieldKind)}
                                        >
                                          <option value="text">Text</option>
                                          <option value="number">Number</option>
                                          <option value="boolean">Toggle</option>
                                          <option value="list">List</option>
                                          <option value="object">Grouped Fields</option>
                                        </select>
                                      </label>
                                      <div className="progression-json-card-actions">
                                        <button type="button" className="btn-icon-mini" onClick={() => reorderJsonTemplateField(key, "up")} disabled={index === 0} title="Move up">
                                          <ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                                        </button>
                                        <button type="button" className="btn-icon-mini" onClick={() => reorderJsonTemplateField(key, "down")} disabled={index === orderedKeys.length - 1} title="Move down">
                                          <ChevronDown size={12} />
                                        </button>
                                        <button type="button" className="btn-icon-mini danger" onClick={() => removeJsonTemplateField(key)} title="Remove JSON card">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {fieldKind === "text" && (
                                      <label className="progression-json-wide-input">
                                        <span>Starter Value</span>
                                        <input
                                          className="ai-input"
                                          value={String(value || "")}
                                          onChange={(e) => updateJsonTemplatePrimitiveValue(key, e.target.value, "text")}
                                          placeholder="Mortal, Warrior, Human..."
                                        />
                                      </label>
                                    )}

                                    {fieldKind === "number" && (
                                      <label className="progression-json-wide-input">
                                        <span>Starter Number</span>
                                        <input
                                          className="ai-input"
                                          type="number"
                                          value={Number(value) || 0}
                                          onChange={(e) => updateJsonTemplatePrimitiveValue(key, e.target.value, "number")}
                                        />
                                      </label>
                                    )}

                                    {fieldKind === "boolean" && (
                                      <label className="progression-json-toggle-row">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(value)}
                                          onChange={(e) => updateJsonTemplatePrimitiveValue(key, e.target.checked, "boolean")}
                                        />
                                        <span>Default to enabled/true</span>
                                      </label>
                                    )}

                                    {fieldKind === "object" && (
                                      <div className="progression-json-nested-editor">
                                        {Object.keys(objectValue).length === 0 ? (
                                          <div className="empty-state-text compact">No grouped fields yet.</div>
                                        ) : Object.keys(objectValue).map(fieldKey => (
                                          <div className="progression-json-nested-row" key={`${key}-${fieldKey}`}>
                                            <input
                                              className="ai-input"
                                              defaultValue={fieldKey}
                                              onBlur={(e) => renameJsonTemplateObjectField(key, fieldKey, e.target.value)}
                                              placeholder="realm"
                                            />
                                            <input
                                              className="ai-input"
                                              value={typeof objectValue[fieldKey] === "object" ? JSON.stringify(objectValue[fieldKey]) : String(objectValue[fieldKey] ?? "")}
                                              onChange={(e) => updateJsonTemplateObjectValue(key, fieldKey, e.target.value)}
                                              placeholder="Body Tempering"
                                            />
                                            <button type="button" className="btn-icon-mini danger" onClick={() => removeJsonTemplateObjectField(key, fieldKey)} title="Remove grouped field">
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        ))}
                                        <button type="button" className="btn-ai-sub btn-ai-secondary progression-add-field-inline" onClick={() => addJsonTemplateObjectField(key)}>
                                          <Plus size={12} />
                                          Add Grouped Field
                                        </button>
                                      </div>
                                    )}

                                    {fieldKind === "list" && (
                                      <div className="progression-json-nested-editor">
                                        {listValue.length === 0 ? (
                                          <div className="empty-state-text compact">No list items yet.</div>
                                        ) : listValue.map((item, itemIndex) => (
                                          <div className="progression-json-list-row" key={`${key}-${itemIndex}`}>
                                            <input
                                              className="ai-input"
                                              value={typeof item === "object" ? JSON.stringify(item) : String(item ?? "")}
                                              onChange={(e) => updateJsonTemplateListItem(key, itemIndex, e.target.value)}
                                              placeholder="Slash, Fire affinity, Seven Stars Sect..."
                                            />
                                            <button type="button" className="btn-icon-mini danger" onClick={() => removeJsonTemplateListItem(key, itemIndex)} title="Remove list item">
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        ))}
                                        <button type="button" className="btn-ai-sub btn-ai-secondary progression-add-field-inline" onClick={() => addJsonTemplateListItem(key)}>
                                          <Plus size={12} />
                                          Add List Item
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            <div className="progression-json-add-row">
                              <input
                                className="ai-input"
                                value={progressionJsonNewKey}
                                onChange={(e) => setProgressionJsonNewKey(e.target.value)}
                                placeholder="New card key, e.g. weapon, cultivation, resources"
                              />
                              <select
                                className="ai-select"
                                value={progressionJsonNewKind}
                                onChange={(e) => setProgressionJsonNewKind(e.target.value as ProgressionJsonTemplateFieldKind)}
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="boolean">Toggle</option>
                                <option value="list">List</option>
                                <option value="object">Grouped Fields</option>
                              </select>
                              <button type="button" className="btn-ai-sub btn-ai-primary" onClick={addJsonTemplateField}>
                                <Plus size={12} />
                                Add JSON Card
                              </button>
                            </div>
                          </div>

                          <details className="progression-json-raw-preview">
                            <summary>Raw JSON preview</summary>
                            <textarea
                              className="ai-textarea progression-json-template-textarea font-mono text-sm scrollbar"
                              value={progressionSystem.customJsonTemplate || ""}
                              onChange={(e) => {
                                const nextVal = e.target.value
                                let parsedKeys: string[] = []
                                try {
                                  const parsed = JSON.parse(nextVal)
                                  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                                    parsedKeys = Object.keys(parsed)
                                  }
                                } catch {}
                                persistProgressionSystem({
                                  ...progressionSystem,
                                  customJsonTemplate: nextVal,
                                  jsonCardOrder: parsedKeys.length > 0 ? parsedKeys : progressionSystem.jsonCardOrder
                                })
                              }}
                              placeholder={`{\r\n  "class": "Warrior",\r\n  "cultivation": {\r\n    "realm": "Body Tempering"\r\n  }\r\n}`}
                              rows={8}
                            />
                          </details>
                        </>
                      )
                    })()}

                    {renderCultivationImportPanel()}

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
                        className="btn-ai-sub btn-ai-primary"
                        onClick={convertProgressionCardsToJsonTemplate}
                        type="button"
                      >
                        <RefreshCw size={12} />
                        Convert Cards to JSON
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
                    {renderCultivationImportPanel()}
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
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: hoveredLorePosition.top,
              left: hoveredLorePosition.left,
              transform: 'translate(-50%, -100%)',
              zIndex: 400,
              pointerEvents: 'auto',
              cursor: 'default'
            }}
          >
            <div className="hover-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
              <span className={`category-badge ${hoveredLore.category}`}>
                {hoveredLore.category === 'character' ? '👤 Person' : 
                 hoveredLore.category === 'beast' ? '🐾 Beast' : 
                 hoveredLore.category === 'place' ? '📍 Place' : '🗺️ World'}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredLore(null);
                  setHoveredLorePosition(null);
                }}
                style={{ background: 'transparent', border: 0, color: 'var(--text-dim)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                <X size={12} />
              </button>
            </div>
            <h4 className="hover-card-title" style={{ margin: '0.25rem 0 0.4rem', fontSize: '0.95rem' }}>{hoveredLore.name}</h4>
            
            {Array.isArray(hoveredLore.groupIds) && hoveredLore.groupIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' }}>
                {hoveredLore.groupIds.map(gid => {
                  const g = bibleGroups.find(group => group.id === gid);
                  if (!g) return null;
                  return (
                    <span key={gid} style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>
                      {g.name}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="hover-card-body scrollbar" style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {hoveredLore.content ? (
                <div className="brain-markdown-view" style={{ fontSize: '0.74rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{hoveredLore.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="no-info" style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-dim)' }}>No biography or notes entered yet.</p>
              )}
            </div>

            <div className="hover-card-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.5rem' }}>
              <button
                className="btn-ai-sub btn-ai-secondary"
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredLore(null);
                  setHoveredLorePosition(null);
                  setActiveSidebarTab('bible');
                  setIsLeftSidebarOpen(true);
                  setActiveBibleEntryId(hoveredLore.id);
                  setIsBibleDrawerOpen(true);
                }}
              >
                Edit Entry
              </button>
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

        .bible-premium-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          margin-bottom: 0.75rem;
        }

        .bible-premium-action {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.55rem 0.45rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.055);
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .bible-premium-action span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bible-premium-action strong {
          min-width: 1.15rem;
          height: 1.15rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(45, 212, 191, 0.16);
          color: rgb(94, 234, 212);
          font-size: 0.65rem;
        }

        .bible-premium-action:hover {
          border-color: rgba(20, 184, 166, 0.38);
          background: rgba(20, 184, 166, 0.1);
          color: var(--text-primary);
        }

        .name-forge-panel {
          display: flex;
          flex-direction: column;
          gap: 0.62rem;
        }

        .name-forge-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.7rem;
        }

        .name-forge-header p {
          margin: 0.15rem 0 0;
          color: var(--text-dim);
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .name-forge-header > span {
          flex-shrink: 0;
          padding: 0.25rem 0.45rem;
          border: 1px solid rgba(168, 85, 247, 0.22);
          border-radius: var(--radius-sm);
          color: #d8b4fe;
          background: rgba(168, 85, 247, 0.08);
          font-size: 0.66rem;
          font-weight: 800;
        }

        .name-forge-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .name-picker-card {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          min-height: 42px;
          padding: 0.42rem 0.5rem;
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: var(--radius-sm);
          background: rgba(168, 85, 247, 0.055);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition);
          text-align: left;
        }

        .name-picker-card:hover {
          border-color: rgba(168, 85, 247, 0.42);
          background: rgba(168, 85, 247, 0.11);
        }

        .name-picker-card span {
          flex-shrink: 0;
          color: #c084fc;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .name-picker-card strong {
          min-width: 0;
          flex: 1;
          color: var(--text-primary);
          font-size: 0.76rem;
          line-height: 1.15;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .name-picker-card svg {
          flex-shrink: 0;
          color: var(--text-dim);
        }

        .name-forge-controls textarea {
          grid-column: 1 / -1;
          width: 100%;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.18);
          color: var(--text-primary);
          font-size: 0.78rem;
          outline: none;
          resize: vertical;
          min-height: 66px;
          padding: 0.5rem;
          line-height: 1.4;
        }

        .name-collapsible-card {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: var(--radius-sm);
          background: rgba(168, 85, 247, 0.04);
          cursor: pointer;
          transition: var(--transition);
          min-height: 32px;
        }
        .name-collapsible-card:hover {
          border-color: rgba(168, 85, 247, 0.3);
          background: rgba(168, 85, 247, 0.07);
        }
        .name-collapsible-header {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.5rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: #c084fc;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          user-select: none;
        }
        .name-collapsible-preview {
          color: var(--text-dim);
          font-weight: 400;
          text-transform: none;
          letter-spacing: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .name-collapsible-card textarea {
          border-top: 1px solid rgba(168, 85, 247, 0.12);
          border-radius: 0 0 var(--radius-sm) var(--radius-sm);
          min-height: 52px;
        }

        .name-forge-generate-btn {
          width: 100%;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          border: 1px solid rgba(168, 85, 247, 0.28);
          border-radius: var(--radius-md);
          background: rgba(168, 85, 247, 0.12);
          color: #f3e8ff;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .name-forge-generate-btn:hover:not(:disabled) {
          border-color: rgba(168, 85, 247, 0.5);
          background: rgba(168, 85, 247, 0.18);
        }

        .name-forge-generate-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .name-results-list {
          display: flex;
          flex-direction: column;
          gap: 0.46rem;
          overflow-y: auto;
          padding-right: 0.1rem;
        }

        .name-result-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.52rem;
          padding: 0.58rem 0.62rem;
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .name-result-main {
          display: flex;
          flex-direction: column;
          gap: 0.22rem;
          min-width: 0;
        }

        .name-result-main small {
          color: #c084fc;
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .name-result-main strong {
          color: var(--text-primary);
          font-family: var(--font-outfit);
          font-size: 0.98rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .name-result-main p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.7rem;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .name-result-meta {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.28rem;
        }

        .name-result-meta span {
          padding: 0.22rem 0.4rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          font-size: 0.62rem;
          font-weight: 700;
        }

        .name-result-card .btn-ai-sub {
          min-height: 30px;
          padding: 0.35rem 0.62rem;
          white-space: nowrap;
        }

        .name-picker-popover-overlay {
          position: fixed;
          inset: 0;
          z-index: 650;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
        }

        .name-picker-popover {
          width: min(92vw, 420px);
          max-height: min(74vh, 560px);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.95rem;
          border: 1px solid rgba(168, 85, 247, 0.28);
          border-radius: var(--radius-md);
          background: rgba(15, 15, 20, 0.97);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.42);
        }

        .name-picker-popover-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .name-picker-popover-header strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .name-picker-popover-header button {
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.35rem;
          display: inline-flex;
        }

        .name-picker-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.48rem;
          overflow-y: auto;
          padding-right: 0.1rem;
        }

        .name-picker-option {
          min-height: 62px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.18rem 0.45rem;
          align-items: center;
          padding: 0.55rem 0.62rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .name-picker-option:hover,
        .name-picker-option.active {
          border-color: rgba(168, 85, 247, 0.45);
          background: rgba(168, 85, 247, 0.1);
        }

        .name-picker-option span {
          font-size: 0.78rem;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .name-picker-option small {
          grid-column: 1 / -1;
          color: var(--text-dim);
          font-size: 0.66rem;
          line-height: 1.25;
        }

        .name-picker-option svg {
          color: #c084fc;
        }

        .name-forge-actions-row {
          display: flex;
          gap: 0.45rem;
          align-items: stretch;
        }
        .name-forge-actions-row .name-forge-generate-btn {
          flex: 1;
        }
        .name-forge-actions-row .btn-ai-sub {
          flex-shrink: 0;
          min-height: 36px;
          padding: 0.35rem 0.7rem;
          font-size: 0.72rem;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
        .name-syllable-input {
          grid-column: 1 / -1;
          width: 100%;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.12);
          color: var(--text-dim);
          font-size: 0.72rem;
          outline: none;
          resize: vertical;
          min-height: 40px;
          padding: 0.4rem 0.5rem;
          line-height: 1.35;
        }
        .name-syllable-input:focus {
          color: var(--text-primary);
          border-color: rgba(168, 85, 247, 0.35);
        }
        .name-batch-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.45rem;
        }
        .name-batch-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.32rem;
          color: var(--text-dim);
          font-size: 0.7rem;
          cursor: pointer;
          user-select: none;
        }
        .name-batch-toggle input[type="checkbox"] {
          accent-color: #a855f7;
        }
        .name-batch-checkbox {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }
        .name-batch-checkbox input[type="checkbox"] {
          accent-color: #a855f7;
          width: 14px;
          height: 14px;
          cursor: pointer;
        }
        .name-result-card-header {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          grid-column: 1 / -1;
        }
        .name-result-card-header .name-result-main {
          flex: 1;
        }
        .name-result-actions {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin-top: 0.1rem;
        }
        .name-result-actions .btn-ai-sub {
          min-height: 26px;
          padding: 0.2rem 0.5rem;
          font-size: 0.66rem;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .btn-sm {
          min-height: 26px !important;
          padding: 0.2rem 0.5rem !important;
          font-size: 0.66rem !important;
        }
        .name-shortlist-section {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          border-top: 1px solid rgba(168, 85, 247, 0.15);
          padding-top: 0.6rem;
          margin-top: 0.2rem;
        }
        .name-shortlist-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .name-shortlist-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.45rem;
          padding: 0.35rem 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.025);
        }
        .name-shortlist-item strong {
          font-size: 0.82rem;
          color: var(--text-primary);
        }
        .name-shortlist-item small {
          color: var(--text-dim);
          font-size: 0.62rem;
          text-transform: uppercase;
        }
        .name-shortlist-actions {
          display: flex;
          gap: 0.3rem;
          flex-shrink: 0;
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
          width: 320px;
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
          overflow-x: hidden;
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
          gap: 0.5rem;
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
          gap: 0.65rem;
          min-height: 58px;
          padding: 0.55rem 0.7rem 0.55rem 0.55rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012)),
            var(--surface-raised);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
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
          border-color: var(--primary);
          color: var(--text-primary);
        }

        .chapter-item:hover {
          background:
            linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(255, 255, 255, 0.018)),
            var(--surface-hover);
          color: var(--text-primary);
          border-color: var(--primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .chapter-item.active {
          background:
            linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(236, 72, 153, 0.045)),
            var(--primary-light);
          border-color: var(--primary);
          color: var(--primary-hover);
          box-shadow: var(--shadow-glow);
        }

        .chapter-number-card {
          flex: 0 0 44px;
          width: 44px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            rgba(15, 23, 42, 0.42);
          color: var(--text-primary);
          font-size: 0.84rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .chapter-item:hover .chapter-number-card {
          border-color: rgba(236, 72, 153, 0.42);
          background:
            linear-gradient(180deg, rgba(236, 72, 153, 0.16), rgba(236, 72, 153, 0.055)),
            rgba(15, 23, 42, 0.58);
          color: var(--primary-hover);
        }

        .chapter-item.active .chapter-number-card {
          border-color: rgba(236, 72, 153, 0.58);
          background:
            linear-gradient(180deg, rgba(236, 72, 153, 0.24), rgba(236, 72, 153, 0.08)),
            rgba(15, 23, 42, 0.68);
          color: var(--primary-hover);
        }

        .chapter-title-wrap {
          min-width: 0;
          flex: 1 1 auto;
          display: flex;
          align-items: center;
        }

        .chapter-title {
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1.25;
          color: currentColor;
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

        .bible-entry-timeline-count {
          flex-shrink: 0;
          padding: 0.12rem 0.35rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-sm);
          color: rgb(94, 234, 212);
          background: rgba(20, 184, 166, 0.06);
          font-size: 0.62rem;
          font-weight: 800;
          white-space: nowrap;
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

        .appearance-panel details summary {
          color: var(--text-dim);
          font-size: 0.7rem;
          font-weight: 700;
        }

        .appearance-panel details summary:hover {
          color: var(--text-secondary);
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

        .progression-template-display-card.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .progression-template-display-card.clickable:hover {
          background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 26%, transparent), rgba(255, 255, 255, 0.08));
          border-color: color-mix(in srgb, var(--card-accent) 70%, transparent);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
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

        .progression-template-mode-switch {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
          padding: 0.35rem;
          margin-bottom: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-template-mode-switch button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 34px;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-dim);
          font-size: 0.75rem;
          font-weight: 900;
          cursor: pointer;
          transition: var(--transition);
        }

        .progression-template-mode-switch button:hover,
        .progression-template-mode-switch button.active {
          border-color: rgba(99, 102, 241, 0.35);
          background: rgba(99, 102, 241, 0.14);
          color: rgb(224, 231, 255);
        }

        .progression-json-builder-panel {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding: 0.75rem;
          border: 1px solid rgba(99, 102, 241, 0.24);
          border-radius: var(--radius-md);
          background: linear-gradient(145deg, rgba(99, 102, 241, 0.08), rgba(255, 255, 255, 0.025));
        }

        .progression-json-builder-warning {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.55rem;
          border-radius: var(--radius-sm);
          font-size: 0.74rem;
          font-weight: 800;
        }

        .progression-json-builder-list {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .progression-json-builder-card {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.7rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.16);
        }

        .progression-json-builder-row,
        .progression-json-add-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px auto;
          gap: 0.5rem;
          align-items: end;
        }

        .progression-json-builder-row label,
        .progression-json-wide-input {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .progression-json-builder-row label span,
        .progression-json-wide-input span {
          color: var(--text-dim);
          font-size: 0.66rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .progression-json-card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.25rem;
        }

        .progression-json-toggle-row {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .progression-json-toggle-row input {
          accent-color: var(--primary);
        }

        .progression-json-nested-editor {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 0.55rem;
          border: 1px dashed rgba(148, 163, 184, 0.18);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.025);
        }

        .progression-json-nested-row {
          display: grid;
          grid-template-columns: minmax(120px, 0.65fr) minmax(0, 1fr) 30px;
          gap: 0.4rem;
          align-items: center;
        }

        .progression-json-list-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 30px;
          gap: 0.4rem;
          align-items: center;
        }

        .progression-json-raw-preview {
          margin-top: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.025);
          overflow: hidden;
        }

        .progression-json-raw-preview summary {
          padding: 0.65rem 0.75rem;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 900;
          cursor: pointer;
        }

        .progression-json-template-textarea {
          width: 100%;
          min-height: 160px;
          padding: 0.75rem;
          border: 0;
          border-top: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 0;
          background: rgba(0, 0, 0, 0.25);
          color: #fff;
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

        .progression-cultivation-guide-preview {
          padding: 0.5rem 0.6rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          font-size: 0.74rem;
          line-height: 1.45;
          max-height: 72px;
          overflow: auto;
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
        .arc-seeds-page {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .arc-seeds-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.8rem;
          flex-shrink: 0;
        }

        .arc-seeds-page-header p {
          margin: 0.15rem 0 0;
          color: var(--text-dim);
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .arc-seed-generate-btn {
          flex-shrink: 0;
          min-height: 34px;
          white-space: nowrap;
        }

        .arc-seed-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
          flex-shrink: 0;
        }

        .arc-seed-stat-card {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.65rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .arc-seed-stat-card.active {
          border-color: rgba(20, 184, 166, 0.28);
          background: rgba(20, 184, 166, 0.065);
        }

        .arc-seed-stat-card small {
          color: var(--text-dim);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .arc-seed-stat-card strong {
          color: var(--text-primary);
          font-size: 1.12rem;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .arc-seed-toolbar {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          flex-shrink: 0;
        }

        .arc-seeds-panel {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          margin-bottom: 0.8rem;
          padding: 0.7rem;
          border: 1px solid rgba(20, 184, 166, 0.22);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.045);
        }

        .arc-seeds-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.55rem;
        }

        .arc-seeds-header div {
          display: flex;
          flex-direction: column;
          gap: 0.16rem;
        }

        .arc-seeds-header strong {
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .arc-seeds-header span,
        .arc-seeds-header em {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-style: normal;
        }

        .arc-seed-error {
          padding: 0.45rem 0.5rem;
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-sm);
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
          font-size: 0.72rem;
        }

        .arc-seeds-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .arc-seed-card {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
          padding: 0.55rem 0.6rem;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .arc-seed-card:hover {
          border-color: rgba(20, 184, 166, 0.42);
          background: rgba(20, 184, 166, 0.08);
        }

        .arc-seed-card div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.16rem;
        }

        .arc-seed-card small {
          color: #5eead4;
          font-size: 0.64rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .arc-seed-card strong {
          color: var(--text-primary);
          font-size: 0.78rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .arc-seed-card p {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.7rem;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .arc-seed-card > span {
          flex-shrink: 0;
          padding: 0.22rem 0.38rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-dim);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .arc-seed-card.status-paid_off {
          opacity: 0.72;
        }

        .arc-seed-card.status-dropped {
          opacity: 0.55;
        }

        .arc-seed-detail-modal {
          max-width: 560px;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
        }

        .arc-seed-detail-body {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .arc-seed-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .arc-seed-chip-row span {
          padding: 0.3rem 0.45rem;
          border: 1px solid rgba(20, 184, 166, 0.24);
          border-radius: var(--radius-sm);
          background: rgba(20, 184, 166, 0.08);
          color: #99f6e4;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .arc-seeds-page-list {
          overflow-y: auto;
          padding-right: 0.1rem;
        }

        .brain-markdown-view,
        .dossier-markdown-view {
          font-size: 0.82rem;
          line-height: 1.55;
          color: var(--text-secondary);
        }

        .brain-markdown-view p,
        .dossier-markdown-view p {
          margin-top: 0;
          margin-bottom: 0.65rem;
        }

        .brain-markdown-view p:last-child,
        .dossier-markdown-view p:last-child {
          margin-bottom: 0;
        }

        .brain-markdown-view strong,
        .dossier-markdown-view strong {
          color: var(--text-primary);
          font-weight: 700;
        }

        .brain-markdown-view h1, .brain-markdown-view h2, .brain-markdown-view h3,
        .dossier-markdown-view h1, .dossier-markdown-view h2, .dossier-markdown-view h3 {
          font-family: var(--font-outfit);
          color: var(--text-primary);
          font-weight: 700;
          margin-top: 0.95rem;
          margin-bottom: 0.45rem;
          line-height: 1.35;
        }

        .brain-markdown-view h1, .dossier-markdown-view h1 { font-size: 1.15rem; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.2rem; }
        .brain-markdown-view h2, .dossier-markdown-view h2 { font-size: 0.98rem; }
        .brain-markdown-view h3, .dossier-markdown-view h3 { font-size: 0.88rem; color: var(--text-dim); }

        .brain-markdown-view ul, .brain-markdown-view ol,
        .dossier-markdown-view ul, .dossier-markdown-view ol {
          padding-left: 1.15rem;
          margin-top: 0;
          margin-bottom: 0.65rem;
        }

        .brain-markdown-view li,
        .dossier-markdown-view li {
          margin-bottom: 0.3rem;
        }

        .brain-markdown-view li:last-child,
        .dossier-markdown-view li:last-child {
          margin-bottom: 0;
        }

        .brain-markdown-view table,
        .dossier-markdown-view table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.45rem;
          margin-bottom: 0.65rem;
          font-size: 0.76rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .brain-markdown-view th, .brain-markdown-view td,
        .dossier-markdown-view th, .dossier-markdown-view td {
          padding: 0.4rem 0.55rem;
          border: 1px solid var(--surface-border);
          text-align: left;
        }

        .brain-markdown-view th,
        .dossier-markdown-view th {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
          font-weight: 700;
        }

        .brain-markdown-view tr:nth-child(even),
        .dossier-markdown-view tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }

        .brain-markdown-view blockquote,
        .dossier-markdown-view blockquote {
          margin: 0 0 0.65rem 0;
          padding-left: 0.65rem;
          border-left: 3px solid var(--primary);
          color: var(--text-dim);
          font-style: italic;
        }

        .brain-markdown-view code,
        .dossier-markdown-view code {
          font-family: monospace;
          background: rgba(255, 255, 255, 0.08);
          padding: 0.08rem 0.2rem;
          border-radius: 3px;
          color: rgb(244, 114, 182);
          font-size: 0.76rem;
        }
        .brain-panel {
          display: flex;
          flex-direction: column;
        }

        /* Enhancements: suggested add chip styling */
        .suggested-chip:hover {
          border-color: rgba(168, 85, 247, 0.45) !important;
          background: rgba(168, 85, 247, 0.08) !important;
          color: var(--text-primary) !important;
        }
        .suggested-chip small.type-character { color: rgb(168, 85, 247); }
        .suggested-chip small.type-place { color: rgb(34, 197, 94); }
        .suggested-chip small.type-object { color: rgb(59, 130, 246); }
        .suggested-chip small.type-concept { color: rgb(234, 179, 8); }
        .suggested-chip small.type-event { color: rgb(249, 115, 22); }
        .suggested-chip small.type-foreshadowing { color: rgb(236, 72, 153); }

        /* Action Modals and Graph CSS Styles */
        .brain-action-modal {
          padding: 1.25rem;
          background: rgba(15, 15, 20, 0.96) !important;
          border: 1px solid rgba(168, 85, 247, 0.25) !important;
          box-shadow: 0 0 25px rgba(168, 85, 247, 0.15) !important;
        }
        .brain-action-card:hover {
          border-color: rgba(168, 85, 247, 0.4) !important;
          background: rgba(168, 85, 247, 0.08) !important;
          color: var(--text-primary) !important;
        }

        .bible-action-modal {
          width: min(92vw, 560px);
          max-height: 82vh;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1.2rem;
          background: rgba(15, 18, 20, 0.97) !important;
          border: 1px solid rgba(20, 184, 166, 0.24) !important;
          box-shadow: 0 0 28px rgba(20, 184, 166, 0.13) !important;
        }

        .bible-action-run {
          width: 100%;
          justify-content: center;
        }

        .bible-action-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          overflow-y: auto;
          padding-right: 0.15rem;
        }

        .bible-suggestion-card,
        .bible-conflict-card,
        .bible-timeline-row {
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .bible-suggestion-card,
        .bible-conflict-card {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.8rem;
        }

        .bible-suggestion-head,
        .bible-conflict-card > div {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .bible-suggestion-head strong,
        .bible-conflict-card strong,
        .bible-clean-state strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .bible-suggestion-head span,
        .bible-conflict-card span {
          margin-left: auto;
          padding: 0.12rem 0.38rem;
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.09);
          color: rgb(94, 234, 212);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .bible-suggestion-card p,
        .bible-conflict-card p,
        .bible-timeline-row p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .bible-suggestion-card small,
        .bible-conflict-card small,
        .bible-conflict-card em {
          color: var(--text-dim);
          font-size: 0.74rem;
          line-height: 1.45;
        }

        .bible-conflict-card.severity-critical {
          border-color: rgba(248, 113, 113, 0.32);
          background: rgba(248, 113, 113, 0.06);
        }

        .bible-conflict-card.severity-critical span {
          background: rgba(248, 113, 113, 0.11);
          color: rgb(252, 165, 165);
        }

        .bible-conflict-card.severity-warning {
          border-color: rgba(251, 191, 36, 0.28);
          background: rgba(251, 191, 36, 0.055);
        }

        .bible-conflict-card.severity-warning span {
          background: rgba(251, 191, 36, 0.11);
          color: rgb(253, 224, 71);
        }

        .bible-clean-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          padding: 1.5rem 1rem;
          border: 1px solid rgba(34, 197, 94, 0.22);
          border-radius: var(--radius-md);
          background: rgba(34, 197, 94, 0.055);
          color: rgb(134, 239, 172);
          text-align: center;
        }

        .bible-clean-state span {
          color: var(--text-secondary);
          font-size: 0.78rem;
        }

        .bible-timeline-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(86px, 0.55fr) minmax(110px, 0.75fr);
          gap: 0.35rem 0.65rem;
          padding: 0.72rem;
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .bible-timeline-row span {
          color: rgb(94, 234, 212);
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .bible-timeline-row strong {
          color: var(--text-primary);
          font-size: 0.82rem;
        }

        .bible-timeline-row p {
          grid-column: 1 / -1;
        }

        .bible-timeline-row:hover {
          border-color: rgba(20, 184, 166, 0.34);
          background: rgba(20, 184, 166, 0.07);
        }

        .bible-timeline-panel {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.12);
        }

        .bible-timeline-fact {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.65rem;
          border: 1px solid rgba(20, 184, 166, 0.16);
          border-radius: var(--radius-sm);
          background: rgba(20, 184, 166, 0.04);
        }

        .bible-timeline-fact div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .bible-timeline-fact strong {
          color: rgb(94, 234, 212);
          font-size: 0.72rem;
        }

        .bible-timeline-fact em {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-style: normal;
          text-transform: uppercase;
          font-weight: 800;
        }

        .bible-timeline-fact p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .bible-timeline-fact small {
          color: var(--text-dim);
          font-size: 0.72rem;
          line-height: 1.45;
        }

        .bible-suggestion-appearance {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .bible-suggestion-appearance span {
          padding: 0.28rem 0.45rem;
          border: 1px solid rgba(168, 85, 247, 0.24);
          border-radius: var(--radius-sm);
          background: rgba(168, 85, 247, 0.08);
          color: rgb(216, 180, 254);
          font-size: 0.7rem;
          font-weight: 700;
          line-height: 1.25;
        }

        .character-detail-panel {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding: 0.75rem;
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: var(--radius-md);
          background: rgba(168, 85, 247, 0.05);
        }

        .character-detail-panel label,
        .character-detail-grid label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .character-detail-panel small,
        .character-detail-grid small {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .character-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .character-detail-history {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.7rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.12);
        }

        .character-detail-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .character-detail-history-header strong {
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .character-detail-history-header span {
          color: var(--text-dim);
          font-size: 0.7rem;
          font-weight: 700;
        }

        .character-detail-summary {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.25);
          border-radius: var(--radius-md);
          background: rgba(20, 184, 166, 0.06);
          margin-bottom: 0.65rem;
        }

        .character-detail-summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .character-detail-summary-header span {
          color: var(--teal-400, #2dd4bf);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .character-detail-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .character-detail-summary-item {
          padding: 0.4rem 0.5rem;
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.15);
        }

        .character-detail-summary-item.full {
          grid-column: 1 / -1;
        }

        .character-detail-summary-item small {
          color: var(--text-dim);
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .character-detail-summary-item p {
          margin: 0.15rem 0 0;
          color: var(--text-main);
          font-size: 0.78rem;
          line-height: 1.45;
        }

        @media (max-width: 720px) {
          .character-detail-grid {
            grid-template-columns: 1fr;
          }
          .character-detail-summary-grid {
            grid-template-columns: 1fr;
          }
        }
        
        /* Graph Modal CSS styles */
        .graph-modal-overlay {
          background: rgba(4, 4, 6, 0.88) !important;
        }
        .brain-graph-modal {
          max-width: 960px !important;
          width: 95vw !important;
          height: 88vh !important;
          max-height: 800px !important;
          display: flex;
          flex-direction: column;
          overflow: hidden !important;
          border: 1px solid rgba(168, 85, 247, 0.25) !important;
          box-shadow: 0 0 30px rgba(168, 85, 247, 0.18) !important;
        }
        .brain-graph-header {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--surface-border);
        }
        .graph-controls {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .graph-controls button {
          padding: 0.35rem 0.65rem;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
        }
        .graph-workspace-wrapper {
          flex: 1;
          display: flex;
          position: relative;
          height: calc(100% - 60px);
          background: rgba(0, 0, 0, 0.22);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .graph-legend {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(10, 10, 15, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.65rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          z-index: 10;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .legend-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .legend-color.type-character { background: #a855f7; }
        .legend-color.type-place { background: #22c55e; }
        .legend-color.type-object { background: #3b82f6; }
        .legend-color.type-concept { background: #eab308; }
        .legend-color.type-event { background: #f97316; }
        .legend-color.type-foreshadowing { background: #ec4899; }
        .legend-label {
          font-size: 0.68rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .graph-svg-container {
          width: 100%;
          height: 100%;
        }
        .graph-link-line {
          stroke: rgba(168, 85, 247, 0.25);
          stroke-width: 1.5px;
          stroke-dasharray: 4, 3;
        }
        .graph-node-circle {
          stroke-width: 1.5px;
          cursor: pointer;
          transition: r 0.2s, stroke-width 0.2s;
        }
        .graph-node-circle:hover {
          stroke-width: 3px;
        }
        .graph-node-circle.type-character {
          fill: rgba(168, 85, 247, 0.16);
          stroke: #c084fc;
        }
        .graph-node-circle.type-place {
          fill: rgba(34, 197, 94, 0.16);
          stroke: #4ade80;
        }
        .graph-node-circle.type-object {
          fill: rgba(59, 130, 246, 0.16);
          stroke: #60a5fa;
        }
        .graph-node-circle.type-concept {
          fill: rgba(234, 179, 8, 0.16);
          stroke: #fde047;
        }
        .graph-node-circle.type-event {
          fill: rgba(249, 115, 22, 0.16);
          stroke: #fb923c;
        }
        .graph-node-circle.type-foreshadowing {
          fill: rgba(236, 72, 153, 0.16);
          stroke: #f472b6;
        }
        .graph-node-group:hover .graph-node-circle {
          r: 35px;
        }
        .graph-node-icon-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          opacity: 0.85;
        }
        .graph-node-label {
          font-size: 0.72rem;
          font-weight: 800;
          fill: rgb(241, 245, 249);
          stroke: rgb(15, 15, 18);
          stroke-width: 2.5px;
          paint-order: stroke fill;
        }
        .dossier-textarea:focus {
          box-shadow: none !important;
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
          overflow-x: hidden;
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
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.2s, visibility 0.2s;
        }

        .brain-entry-card:hover .brain-card-delete {
          opacity: 0.6;
          visibility: visible;
          pointer-events: auto;
        }

        .brain-entry-card .brain-card-delete:hover {
          opacity: 1;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
        }

        .brain-segment-card {
          border: 1px solid var(--surface-border);
          background: rgba(255, 255, 255, 0.03);
          transition: var(--transition);
        }

        .brain-segment-card:hover {
          border-color: rgba(168, 85, 247, 0.35) !important;
          background: rgba(168, 85, 247, 0.05) !important;
          transform: translateY(-1px);
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
          .progression-json-builder-row,
          .progression-json-add-row,
          .progression-json-nested-row {
            grid-template-columns: 1fr;
          }
          .progression-json-card-actions {
            justify-content: flex-start;
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


// --- BRAIN GRAPH COMPONENT ---
interface GraphNode {
  id: string;
  name: string;
  type: BrainEntityType;
  importance: BrainImportance;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  latestSummary?: string;
  entriesCount?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface BrainGraphModalComponentProps {
  isOpen: boolean;
  onClose: () => void;
  brainEntityGroups: any[];
  onSelectEntity: (name: string) => void;
  bibleEntries?: any[];
}

const BrainGraphModalComponent: React.FC<BrainGraphModalComponentProps> = ({
  isOpen,
  onClose,
  brainEntityGroups,
  onSelectEntity,
  bibleEntries = []
}) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);

  const draggingNodeIdRef = useRef<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);

  const selectedGraphNode = selectedGraphNodeId 
    ? nodes.find(n => n.id === selectedGraphNodeId) || null
    : null;

  useEffect(() => {
    if (!isOpen) return;

    const initialNodes: GraphNode[] = brainEntityGroups.map((group, idx) => {
      const importanceScore = group.criticalCount > 0 ? 32 : group.entries.some((e: any) => e.importance === 'major') ? 24 : 18;
      const size = Math.min(50, importanceScore + Math.sqrt(group.entries.length) * 1.8);
      
      const angle = (idx / brainEntityGroups.length) * 2 * Math.PI;
      const radius = Math.min(270, brainEntityGroups.length * 16 + 70);

      // Get the latest entry's summary
      const sortedEntries = group.entries.slice().sort((a: any, b: any) => b.updatedAt - a.updatedAt);
      const latestSummary = sortedEntries[0]?.aiSummary || "";
      
      return {
        id: group.name,
        name: group.name,
        type: group.type || 'unknown',
        importance: group.criticalCount > 0 ? 'critical' : group.entries.some((e: any) => e.importance === 'major') ? 'major' : 'minor',
        x: 480 + Math.cos(angle) * radius,
        y: 330 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        size,
        latestSummary,
        entriesCount: group.entries.length
      };
    });

    const initialLinks: GraphLink[] = [];
    const nameSet = new Set(brainEntityGroups.map(g => g.name.toLowerCase()));

    brainEntityGroups.forEach(group => {
      group.entries.forEach((entry: any) => {
        if (Array.isArray(entry.connections)) {
          entry.connections.forEach((conn: string) => {
            const targetName = conn.trim();
            if (targetName && targetName.toLowerCase() !== group.name.toLowerCase() && nameSet.has(targetName.toLowerCase())) {
              const canonTarget = brainEntityGroups.find(g => g.name.toLowerCase() === targetName.toLowerCase())?.name;
              if (canonTarget) {
                const linkKey = [group.name, canonTarget].sort().join("->");
                if (!initialLinks.some(l => [l.source, l.target].sort().join("->") === linkKey)) {
                  initialLinks.push({ source: group.name, target: canonTarget });
                }
              }
            }
          });
        }
      });
    });

    setNodes(initialNodes);
    setLinks(initialLinks);
    nodesRef.current = initialNodes;

    let active = true;

    const runSimulation = () => {
      if (!active) return;

      const currentNodes = nodesRef.current;

      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const dx = currentNodes[j].x - currentNodes[i].x;
          const dy = currentNodes[j].y - currentNodes[i].y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          if (dist < 360) {
            const force = (currentNodes[i].size * currentNodes[j].size * 12) / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            currentNodes[i].vx -= fx;
            currentNodes[i].vy -= fy;
            currentNodes[j].vx += fx;
            currentNodes[j].vy += fy;
          }
        }
      }

      initialLinks.forEach(link => {
        const sourceNode = currentNodes.find(n => n.id === link.source);
        const targetNode = currentNodes.find(n => n.id === link.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const k = 0.05;
          const force = (dist - 160) * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          sourceNode.vx += fx;
          sourceNode.vy += fy;
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      });

      const centerX = 480;
      const centerY = 330;
      currentNodes.forEach(node => {
        if (node.id === draggingNodeIdRef.current) return;

        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.vx += dx * 0.008;
        node.vy += dy * 0.008;

        node.vx *= 0.82;
        node.vy *= 0.82;

        node.x += node.vx;
        node.y += node.vy;

        node.x = Math.max(node.size + 30, Math.min(930 - node.size - 30, node.x));
        node.y = Math.max(node.size + 30, Math.min(630 - node.size - 30, node.y));
      });

      setNodes([...currentNodes]);
      requestAnimationFrame(runSimulation);
    };

    const animationId = requestAnimationFrame(runSimulation);
    return () => {
      active = false;
      cancelAnimationFrame(animationId);
    };
  }, [isOpen, brainEntityGroups]);

  if (!isOpen) return null;

  const handleNodeMouseDown = (e: React.MouseEvent, node: any) => {
    e.stopPropagation();
    draggingNodeIdRef.current = node.id;
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (draggingNodeIdRef.current) {
      const mouseX = (e.clientX - rect.left - pan.x) / scale;
      const mouseY = (e.clientY - rect.top - pan.y) / scale;

      const draggedNode = nodesRef.current.find(n => n.id === draggingNodeIdRef.current);
      if (draggedNode) {
        draggedNode.x = mouseX;
        draggedNode.y = mouseY;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
        setNodes([...nodesRef.current]);
      }
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleSvgMouseUp = () => {
    draggingNodeIdRef.current = null;
    setIsPanning(false);
  };

  const handleSvgWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    const newScale = Math.max(0.4, Math.min(2.5, scale * zoomFactor));
    setScale(newScale);
  };

  const resetViewport = () => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  };

  const renderIcon = (type: string, size: number) => {
    switch (type) {
      case 'character': return <User size={size} />;
      case 'place': return <MapPin size={size} />;
      case 'object': return <Package size={size} />;
      case 'concept': return <Globe size={size} />;
      case 'event': return <PawPrint size={size} />;
      case 'foreshadowing': return <Sparkles size={size} />;
      default: return <BrainCircuit size={size} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'character': return 'Character';
      case 'place': return 'Location';
      case 'object': return 'Item';
      case 'concept': return 'Concept';
      case 'event': return 'Event';
      case 'foreshadowing': return 'Foreshadowing';
    }
  };

  const matchingBibleEntry = selectedGraphNode 
    ? bibleEntries?.find(e => e.name.toLowerCase() === selectedGraphNode.name.toLowerCase())
    : null;
  const displaySummaryContent = matchingBibleEntry?.content || selectedGraphNode?.latestSummary || "No description or AI analysis details available.";

  return (
    <div className="modal-overlay graph-modal-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div className="modal brain-graph-modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px', width: '95vw', height: '88vh', maxHeight: '800px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="modal-header brain-graph-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
          <div>
            <h2 className="modal-title">Interactive Brain Map Graph</h2>
            <p className="modal-description">Drag nodes to explore connections. Scroll to zoom, drag background to pan.</p>
          </div>
          <div className="graph-controls-panel" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} title="Zoom In" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--surface-border)', color: '#c084fc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>+</button>
            <button onClick={() => setScale(s => Math.max(0.4, s - 0.1))} title="Zoom Out" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--surface-border)', color: '#c084fc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>-</button>
            <button onClick={resetViewport} style={{ padding: '0 0.75rem', height: '32px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 'bold', cursor: 'pointer' }}>Reset View</button>
            <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
          </div>
        </div>

        <div className="graph-workspace-wrapper" style={{ flex: 1, display: 'flex', position: 'relative', height: 'calc(100% - 60px)', background: '#0a0a0f', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {/* Horizontal Legend at Bottom */}
          <div className="graph-legend-horizontal" style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '0.45rem 1rem', display: 'flex', gap: '0.85rem', zIndex: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['character', 'place', 'object', 'concept', 'event', 'foreshadowing'].map(type => (
              <div key={type} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                <span className="legend-color" style={{ display: 'block', width: '8px', height: '8px', borderRadius: '50%', background: type === 'character' ? '#a855f7' : type === 'place' ? '#22c55e' : type === 'object' ? '#3b82f6' : type === 'concept' ? '#eab308' : type === 'event' ? '#f97316' : '#ec4899' }}></span>
                <span style={{ textTransform: 'capitalize' }}>{getTypeLabel(type)}</span>
              </div>
            ))}
          </div>

          <div className="graph-svg-container" style={{ width: '100%', height: '100%' }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 960 660"
              onMouseMove={handleSvgMouseMove}
              onMouseDown={(e) => {
                handleSvgMouseDown(e);
                setSelectedGraphNodeId(null);
              }}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onWheel={handleSvgWheel}
              style={{ cursor: isPanning ? 'grabbing' : draggingNodeIdRef.current ? 'grabbing' : 'grab' }}
            >
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
                </pattern>
              </defs>

              <rect width="100%" height="100%" fill="url(#graph-grid)" />

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                {links.map((link, idx) => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;
                  return (
                    <line
                      key={idx}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      className="graph-link-line"
                    />
                  );
                })}

                {nodes.map(node => (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="graph-node-group"
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGraphNodeId(node.id);
                    }}
                    onDoubleClick={() => {
                      onSelectEntity(node.name);
                      onClose();
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={node.size}
                      className={`graph-node-circle type-${node.type} importance-${node.importance}`}
                      filter="url(#glow)"
                    />
                    <foreignObject
                      x={-node.size * 0.6}
                      y={-node.size * 0.6}
                      width={node.size * 1.2}
                      height={node.size * 1.2}
                      style={{ pointerEvents: 'none' }}
                    >
                      <div className="graph-node-icon-wrapper">
                        {renderIcon(node.type, node.size * 0.75)}
                      </div>
                    </foreignObject>
                    <text
                      y={node.size + 14}
                      textAnchor="middle"
                      className="graph-node-label"
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        fill: '#f8fafc',
                        stroke: '#08080c',
                        strokeWidth: '4px',
                        strokeLinejoin: 'round',
                        paintOrder: 'stroke fill',
                        pointerEvents: 'none'
                      }}
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          </div>

          {selectedGraphNode && (
            <div className="graph-node-preview-panel glass fade-in" style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '290px',
              maxHeight: 'calc(100% - 30px)',
              background: 'rgba(10, 10, 15, 0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              zIndex: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`brain-type-badge type-${selectedGraphNode.type}`} style={{ fontSize: '0.64rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  {renderIcon(selectedGraphNode.type, 11)}
                  {getTypeLabel(selectedGraphNode.type)}
                </span>
                <button 
                  onClick={() => setSelectedGraphNodeId(null)}
                  style={{ background: 'transparent', border: 0, color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  <X size={14} />
                </button>
              </div>
              
              <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedGraphNode.name}</h3>
              
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span className={`brain-importance-badge importance-${selectedGraphNode.importance}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                  <Star size={9} />
                  {selectedGraphNode.importance}
                </span>
                <span>•</span>
                <span>{selectedGraphNode.entriesCount} occurrence{selectedGraphNode.entriesCount === 1 ? '' : 's'}</span>
              </div>
              
              <div className="brain-markdown-view scrollbar" style={{ flex: 1, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.5', overflowY: 'auto', borderTop: '1px solid var(--surface-border)', paddingTop: '0.65rem', marginTop: '0.2rem', paddingRight: '0.2rem' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displaySummaryContent}</ReactMarkdown>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.45rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem', flexShrink: 0 }}>
                <button
                  onClick={() => {
                    onSelectEntity(selectedGraphNode.name);
                    onClose();
                  }}
                  className="btn-ai-sub btn-ai-secondary"
                  style={{ flex: 1, fontSize: '0.7rem', padding: '0.45rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }}
                >
                  <BookOpen size={12} />
                  Open Bible Dossier
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
