/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

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
  prompts?: Record<string, string>
  consistencyNotes?: string[]
  negativePrompt?: string
  negativePrompts?: Record<string, string>
  characterDetails?: {
    appearance?: string
    hair?: string
    eyes?: string
    body?: string
    height?: string
    age?: string
    attire?: string
    distinguishingFeatures?: string
    weapon?: string
  }
  inferredCategory?: string
  inferredName?: string
  formLabels?: Record<string, string>
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
    chapterId?: string
    chapterTitle?: string
    chapterNumber?: number | null
    mentionCount?: number
    characterDetails?: {
      appearance?: string
      attire?: string
      hair?: string
      eyes?: string
      body?: string
      height?: string
      age?: string
      distinguishingFeatures?: string
      weapon?: string
      chapterAppearance?: {
        summary?: string
        evidence?: string
        appearance?: string
        attire?: string
        hair?: string
        eyes?: string
        body?: string
        height?: string
        age?: string
        distinguishingFeatures?: string
        weapon?: string
      }
    }
    timelineFact?: {
      summary?: string
      evidence?: string
      status?: string
    }
  }>
}
type BibleExtractCharacterDetails = NonNullable<NonNullable<BibleExtractResponse["suggestions"]>[number]["characterDetails"]>

type ArcSeedExtractResponse = {
  seed?: {
    title?: string
    summary?: string
    whyItMatters?: string
    futurePayoff?: string
    evidence?: string
    relatedCharacters?: string[]
    relatedEntities?: string[]
  }
}

type NameGenerateResponse = {
  names?: Array<{
    name?: string
    category?: "character" | "beast" | "world" | "place" | "item"
    style?: string
    raceOrOrigin?: string
    structure?: string
    meaning?: string
    pronunciation?: string
    vibe?: string
    bibleContent?: string
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

function parseJsonValue<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function normalizeNameForCompare(name: string): string {
  try {
    return name.normalize("NFKC").toLocaleLowerCase().replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), "")
  } catch {
    return name.toLocaleLowerCase().replace(/\s+/g, "")
  }
}

function buildFallbackNameOptions(body: Record<string, any>) {
  const style = String(body.nameStyle || "fantasy").toLowerCase()
  const style2 = String(body.nameStyle2 || "").toLowerCase()
  const category = ["character", "beast", "world", "place", "item"].includes(String(body.nameCategory)) ? String(body.nameCategory) : "character"
  const structure = String(body.nameStructure || "any").toLowerCase()
  const tone = String(body.nameTone || "memorable")
  const prompt = String(body.customPrompt || "")
  const requestedCount = Math.min(Math.max(1, Number(body.count) || 5), 20)
  const existing = new Set(
    Array.isArray(body.bibleEntries)
      ? body.bibleEntries.map((entry: any) => normalizeNameForCompare(String(entry?.name || ""))).filter(Boolean)
      : []
  )
  const seed = (Date.now() + style.length * 13 + category.length * 17 + structure.length * 19 + prompt.length * 23) % 997

  const banks: Record<string, { family: string[]; given: string[]; middle: string[]; epithet: string[]; origin: string }> = {
    chinese: {
      family: ["Shen", "Liang", "Wei", "Jiang", "Luo", "Yun", "Mo", "Han"],
      given: ["Qingxuan", "Moye", "Zhenyu", "Lianhua", "Ruyin", "Xiaofeng", "Yueshen", "Ninghai"],
      middle: ["Silent", "Cloud", "Jade", "Night", "Crimson", "Hidden"],
      epithet: ["Shadow Lotus", "Moon Blade", "Silent Meridian", "Jade Warden"],
      origin: "Chinese-inspired cultivation"
    },
    japanese: {
      family: ["Kurogane", "Tsukihara", "Minazuki", "Akamori", "Shiranui", "Yorozu"],
      given: ["Renka", "Mitsuo", "Sayori", "Kaito", "Hotaru", "Yukina", "Reiha"],
      middle: ["Nocturne", "Ember", "Mist", "Iron", "Moon"],
      epithet: ["Foxfire", "Moon-Edge", "Ashen Shrine", "Mist Oath"],
      origin: "Japanese-inspired fantasy"
    },
    korean: {
      family: ["Kim", "Park", "Choi", "Yoon", "Seo", "Jang", "Baek"],
      given: ["Hyejin", "Minjun", "Sooyoung", "Jaehwan", "Eunji", "Donghyun", "Nayoung"],
      middle: ["Morning", "Silk", "Crystal", "Autumn", "Star"],
      epithet: ["Morning Lotus", "Silk Veil", "Autumn Frost", "Star Singer"],
      origin: "Korean-inspired fantasy"
    },
    elven: {
      family: ["Aeltharyn", "Vaeloria", "Sylmareth", "Elarion", "Thalanis"],
      given: ["Liora", "Faelith", "Aerendyl", "Nymeriel", "Caelion", "Vaelis"],
      middle: ["Star", "Willow", "Dawn", "Silver", "Thorn"],
      epithet: ["Starbloom", "Moonwoven", "Dusk Harp", "Silverleaf"],
      origin: "Elven"
    },
    demonic: {
      family: ["Varkhazar", "Maldrake", "Zorveth", "Ashkhael", "Drazhkul"],
      given: ["Kaelrix", "Veyrath", "Nocthara", "Azrul", "Morvayne", "Xalreth"],
      middle: ["Blood", "Abyss", "Cinder", "Ruin", "Horn"],
      epithet: ["Oathbreaker", "Black Pyre", "Dread Crown", "Hellscar"],
      origin: "Demonic"
    },
    beast: {
      family: ["Ironmane", "Thunderclaw", "Voidscale", "Moonfang", "Ashhorn", "Stormhide"],
      given: ["Ravok", "Kryll", "Zhara", "Mawren", "Skoruun", "Velk"],
      middle: ["Feral", "Ancient", "Howling", "Scaled", "Dire"],
      epithet: ["World-Eater", "Night Prowler", "Storm Tusker", "Sky Rend"],
      origin: "Beast or monster"
    },
    cultivation: {
      family: ["Azure Peak", "Ninefold", "Crimson Crane", "Void Lotus", "Heaven-Severing"],
      given: ["Sect", "Pavilion", "Palace", "Valley", "Hall", "Sanctum"],
      middle: ["Inner", "Hidden", "Elder", "Celestial", "Forbidden"],
      epithet: ["Sword Oath", "Dragon Meridian", "Soul Furnace", "Cloud Tribulation"],
      origin: "Cultivation world"
    },
    noble: {
      family: ["Vance", "Ashwick", "Montgrave", "Sterling", "Fairwyn", "Highmere"],
      given: ["Alistair", "Seraphina", "Julian", "Cordelia", "Percival", "Lavinia"],
      middle: ["Duke", "Lord", "Lady", "Baron", "Count", "Sir"],
      epithet: ["Iron Duke", "Crimson Baron", "Silver Lady", "High Warden"],
      origin: "Noble house"
    },
    divine: {
      family: ["Seraphyne", "Aurelion", "Solmara", "Elyndra", "Vauntiel"],
      given: ["Orison", "Celest", "Halo", "Lumin", "Astrael", "Vespera"],
      middle: ["Radiant", "Dawn", "Oracle", "Crown", "Star"],
      epithet: ["Sun-Crowned", "Heaven's Witness", "Dawn Herald", "Star Vow"],
      origin: "Divine or celestial"
    },
    grimdark: {
      family: ["Graves", "Blackthorn", "Murkwood", "Ravencroft", "Sorrowfeld"],
      given: ["Malek", "Vorlag", "Grenda", "Threx", "Morrik", "Sable"],
      middle: ["Rust", "Ash", "Bone", "Slag", "Grief"],
      epithet: ["Bone Carver", "Ash Lord", "Rust Prince", "Grief Walker"],
      origin: "Grimdark"
    },
    fantasy: {
      family: ["Veylan", "Draven", "Mireholt", "Sablemere", "Asterion", "Kyr Vale"],
      given: ["Kaelen", "Mirae", "Thorne", "Seren", "Vael", "Nyra", "Corvin"],
      middle: ["Ash", "Rune", "Storm", "Vale", "Night", "Ember"],
      epithet: ["Glass Blade", "Runebound", "Storm-Touched", "Ashen Star"],
      origin: "Invented fantasy"
    },
    viking: {
      family: ["Ironsson", "Stormveig", "Bjornolf", "Hildebrand", "Ragnarsen"],
      given: ["Eirik", "Sigrid", "Ulfgar", "Freydis", "Bjorn", "Astrid", "Rollo"],
      middle: ["Ice", "Sea", "Wolf", "Thunder", "Shield"],
      epithet: ["Sea Wolf", "Ice Cleaver", "Thunder Helm", "Shield Maiden"],
      origin: "Viking / Norse saga"
    },
    slavic: {
      family: ["Zarubin", "Morozov", "Kovalenko", "Sokoloff", "Dragomir"],
      given: ["Dobromir", "Vesna", "Zoran", "Mila", "Radovan", "Svetlana", "Boris"],
      middle: ["Winter", "Forest", "Mountain", "Sun", "Star"],
      epithet: ["Night Watch", "Winter Wolf", "Forest Tsar", "Sun Dancer"],
      origin: "Slavic fairy-tale"
    },
    celtic: {
      family: ["O'Morain", "MacBride", "Driscoll", "Kavanagh", "O'Shea"],
      given: ["Aisling", "Cormac", "Saoirse", "Finnian", "Brigid", "Torin", "Niamh"],
      middle: ["Mist", "Oak", "Stone", "Dew", "Raven"],
      epithet: ["Mist Walker", "Oak Heart", "Stone Singer", "Raven Call"],
      origin: "Celtic druidic"
    },
    egyptian: {
      family: ["Amun-Ra", "Nebtnet", "Setepka", "Ankhu", "Meresger"],
      given: ["Khenemet", "Neferu", "Senmut", "Hatshepsut", "Amenhotep", "Isis"],
      middle: ["Sun", "Nile", "Gold", "Scarab", "Lotus"],
      epithet: ["Sun of Ra", "Nile Guardian", "Golden Mask", "Lotus Crown"],
      origin: "Ancient Egyptian"
    },
    mesoamerican: {
      family: ["Chimal", "Coyotl", "Quetzal", "Ichtaca", "Xochitl"],
      given: ["Cuauhtli", "Xochitl", "Tlalli", "Citlali", "Yolotli", "Ollin"],
      middle: ["Jaguar", "Feather", "Sun", "Rain", "Flower"],
      epithet: ["Jaguar Claw", "Feather Serpent", "Sun Priest", "Flower Warrior"],
      origin: "Mesoamerican empire"
    },
    arabian: {
      family: ["Al-Rashid", "Ibn Khalid", "Al-Nassar", "Qadir", "Zahiri"],
      given: ["Farid", "Jasmina", "Tariq", "Layla", "Samir", "Zahra", "Nasir"],
      middle: ["Sand", "Silk", "Star", "Moon", "Rose"],
      epithet: ["Sand Dancer", "Silk Voice", "Star Seeker", "Moon Knight"],
      origin: "Arabian / Persian nights"
    },
    hindi: {
      family: ["Devaraja", "Mahajan", "Chandran", "Rathore", "Sharma"],
      given: ["Arjun", "Priya", "Vikram", "Ananya", "Rohan", "Kavya", "Dhruv"],
      middle: ["Golden", "Lotus", "Thunder", "Peacock", "Diamond"],
      epithet: ["Golden Lotus", "Thunder Bolt", "Peacock Prince", "Diamond Soul"],
      origin: "Indian epic mythology"
    },
    greek: {
      family: ["Aetos", "Damianos", "Kypris", "Theron", "Kallistratos"],
      given: ["Cassandra", "Leonidas", "Thalia", "Damon", "Iris", "Orion", "Phaedra"],
      middle: ["Bronze", "Marble", "Ivory", "Laurel", "Oracle"],
      epithet: ["Bronze Spear", "Oracle Voice", "Laurel Crown", "Marble Gaze"],
      origin: "Greco-Roman myth"
    },
    steampunk: {
      family: ["Brasswick", "Gearson", "Copperfield", "Steamlock", "Piston"],
      given: ["Cogsworth", "Ember", "Tankard", "Pipette", "Ratchet", "Meridian"],
      middle: ["Brass", "Iron", "Steam", "Copper", "Gear"],
      epithet: ["Steam Baron", "Brass Cog", "Copper Knight", "Gear Master"],
      origin: "Steampunk world"
    },
    cyberpunk: {
      family: ["Neon", "Ox-Gen", "Zero-Code", "Amphere", "Circuit"],
      given: ["Kai-7", "Ryn", "Nyx", "Vex", "Glitch", "Pixel", "Data"],
      middle: ["Neon", "Chrome", "Shadow", "Digital", "Void"],
      epithet: ["Neon Runner", "Chrome Ghost", "Data Warden", "Shadow Hacker"],
      origin: "Cyberpunk future"
    },
    celestial: {
      family: ["Stardust", "Nebula", "Cosmos", "Orion", "Lunaris"],
      given: ["Nova", "Astrid", "Sol", "Luna", "Orion", "Vega", "Cygnus"],
      middle: ["Star", "Moon", "Solar", "Void", "Nebula"],
      epithet: ["Star Forge", "Moon Walker", "Nebula Heart", "Solar Flame"],
      origin: "Celestial / cosmic"
    },
    elemental: {
      family: ["Flamestrike", "Deepwell", "Stoneheart", "Stormborn", "Ashfall"],
      given: ["Ignis", "Aqua", "Terra", "Ventus", "Cinder", "Glacier", "Zephyr"],
      middle: ["Fire", "Water", "Earth", "Wind", "Storm"],
      epithet: ["Flame Tongue", "Tide Lord", "Earth Shaker", "Storm Eye"],
      origin: "Elemental force"
    },
    fey: {
      family: ["Glimmerdew", "Thistlewhim", "Moonshade", "Brightfern", "Dustwillow"],
      given: ["Twilight", "Fizzle", "Mimosa", "Thorn", "Petal", "Riddle", "Wisp"],
      middle: ["Dew", "Gossamer", "Trick", "Moss", "Bloom"],
      epithet: ["Dew Drinker", "Trick Weaver", "Gossamer Wing", "Bloom Dancer"],
      origin: "Fey / Faerie realm"
    },
    undead: {
      family: ["Gravebone", "Blackwood", "Cryptheart", "Fellmoss", "Skullfen"],
      given: ["Marrow", "Barrow", "Lich", "Wraith", "Bane", "Sorrow", "Dirge"],
      middle: ["Bone", "Frost", "Barrow", "Grave", "Soul"],
      epithet: ["Bone Lord", "Grave Whisper", "Frost Lich", "Soul Reaper"],
      origin: "Undead / Lich"
    },
    dwarf: {
      family: ["Stonehelm", "Ironbeard", "Deepforged", "Hammerfell", "Goldvein"],
      given: ["Durin", "Borin", "Thrain", "Gimla", "Morga", "Torvi", "Balin"],
      middle: ["Stone", "Gold", "Iron", "Deep", "Anvil"],
      epithet: ["Stone Hammer", "Gold Seeker", "Iron Lord", "Deep Miner"],
      origin: "Dwarven mountain"
    },
    void: {
      family: ["Abyssal", "Nullvoid", "Eldritch", "Beyond", "Unspoken"],
      given: ["Xul", "Vor", "Nyarl", "C'thon", "Yog", "Azath", "Mog"],
      middle: ["Void", "Abyss", "Elder", "Alien", "Dark"],
      epithet: ["Void Speaker", "Elder Whisper", "Abyss Gate", "Dark Star"],
      origin: "Void / Abyss / Eldritch"
    },
    african: {
      family: ["Mwangi", "Okonkwo", "Nkosi", "Diallo", "Kenyatta", "Okafor", "Mensah"],
      given: ["Zuri", "Kwame", "Amara", "Chidi", "Nala", "Kofi", "Sefu", "Ayana", "Jabari", "Zola"],
      middle: ["Lion", "Drum", "Savanna", "River", "Gold"],
      epithet: ["Lion Heart", "Drum Keeper", "Savanna Walker", "River Spirit"],
      origin: "African-inspired"
    },
    polynesian: {
      family: ["Tane", "Moana", "Atea", "Tangaroa", "Rongo", "Hina"],
      given: ["Maui", "Lani", "Keala", "Nalani", "Kanoa", "Leilani", "Ikaika", "Makani"],
      middle: ["Wave", "Star", "Coral", "Tide", "Breeze"],
      epithet: ["Wave Rider", "Star Navigator", "Coral Dancer", "Tide Caller"],
      origin: "Polynesian / Oceanic"
    },
    mongolian: {
      family: ["Khatun", "Batu", "Temur", "Altan", "Khoshuud", "Borjigin"],
      given: ["Temujin", "Sukh", "Altan", "Sarnai", "Borte", "Toghrul", "Khasar"],
      middle: ["Steppe", "Sky", "Iron", "Gold", "Wind"],
      epithet: ["Steppe Wolf", "Sky Rider", "Iron Bow", "Golden Horde"],
      origin: "Mongolian / Steppe"
    },
    tibetan: {
      family: ["Lhamo", "Tenzin", "Dorje", "Norbu", "Tsering", "Wangmo", "Gyatso"],
      given: ["Tenzin", "Kelsang", "Yangchen", "Sonam", "Chodak", "Pema", "Jigme"],
      middle: ["Snow", "Lotus", "Diamond", "Silk", "Coral"],
      epithet: ["Snow Lion", "Lotus Heart", "Diamond Crown", "Silk Prayer"],
      origin: "Tibetan / Himalayan"
    },
    roman: {
      family: ["Aurelius", "Cassius", "Julius", "Flavius", "Claudius", "Cornelius"],
      given: ["Marcus", "Octavia", "Lucius", "Cassia", "Tiberius", "Livia", "Gaius"],
      middle: ["Maximus", "Augustus", "Felix", "Primus", "Magnus"],
      epithet: ["Iron Eagle", "Golden Shield", "Silver Spear", "Bronze Helm"],
      origin: "Roman / Latin"
    },
    lovecraftian: {
      family: ["Yuggoth", "R'lyeh", "Carcosa", "Kadath", "Ulthar"],
      given: ["Nyarl", "C'thon", "Yog", "Azath", "Mog", "Dagon", "Hastur"],
      middle: ["Void", "Elder", "Ward", "Star", "Gate"],
      epithet: ["Void Whisperer", "Elder Dream", "Star Spawn", "Gate Opener"],
      origin: "Lovecraftian / Cosmic Horror"
    },
    gothic: {
      family: ["Von Hellsing", "Darkmoor", "Ravencroft", "Blackwood", "Morthrain"],
      given: ["Victor", "Isabella", "Mortimer", "Lilith", "Sebastian", "Ophelia", "Caspian"],
      middle: ["Dark", "Crimson", "Ivory", "Shadow", "Fallen"],
      epithet: ["Crimson Duke", "Shadow Count", "Ivory Lady", "Dark Prince"],
      origin: "Gothic / Dark Romantic"
    },
    pirate: {
      family: ["Blackthorn", "Silverfin", "Ravensail", "Ironhook", "Seaborne", "Dreadwater"],
      given: ["Captain", "Morgan", "Isla", "Redbeard", "Calico", "Anne", "Bartholomew"],
      middle: ["Sea", "Crow", "Gold", "Storm", "Salt"],
      epithet: ["Dread Captain", "Sea Wolf", "Gold Tooth", "Storm Chaser"],
      origin: "Pirate / Swashbuckler"
    },
    western: {
      family: ["Cassidy", "Dalton", "Wilder", "McCready", "Hickok", "James"],
      given: ["Wyatt", "Daisy", "Jesse", "Annie", "Doc", "Belle", "Sundance"],
      middle: ["Dust", "Iron", "Silver", "Rust", "Canyon"],
      epithet: ["Silver Sheriff", "Dust Rider", "Iron Marshal", "Canyon Ghost"],
      origin: "Western / Frontier"
    },
    postapocalyptic: {
      family: ["Ashford", "Wasteland", "Rust", "Survival", "Broken", "Cinder"],
      given: ["Wren", "Rex", "Nova", "Tank", "Ash", "Rust", "Vega", "Kestrel"],
      middle: ["Rust", "Bone", "Scrap", "Ash", "Waste"],
      epithet: ["Ash Walker", "Rust Lord", "Scrap Merchant", "Waste Warden"],
      origin: "Post-Apocalyptic wasteland"
    },
    biopunk: {
      family: ["Gen-7", "Helix", "Chimera", "Splice", "Cortex", "Mycelia"],
      given: ["Xyla", "Kai", "Vira", "Nyx", "Echo", "Zyme", "Clade", "Rune"],
      middle: ["Gene", "Spine", "Toxin", "Spore", "Synth"],
      epithet: ["Gene Weaver", "Spine Drifter", "Toxin Bloom", "Synth Soul"],
      origin: "Bio-Punk genetic future"
    },
    clockwork: {
      family: ["Brassheart", "Cogsworth", "Pendulum", "Gearspring", "Mainspring"],
      given: ["Tick", "Tock", "Gearhart", "Copper", "Ratchet", "Piston", "Meridian"],
      middle: ["Brass", "Cog", "Steam", "Gear", "Spring"],
      epithet: ["Brass Sentinel", "Cog Master", "Steam Prophet", "Gear Saint"],
      origin: "Clockwork / Automaton"
    },
    tropical: {
      family: ["Lani", "Moana", "Kahuna", "Nalu", "Makani", "Aina"],
      given: ["Kai", "Leilani", "Koa", "Nalani", "Ikaika", "Mana", "Lono", "Pua"],
      middle: ["Sun", "Wave", "Tide", "Coral", "Palm"],
      epithet: ["Sun Dancer", "Wave Rider", "Tide Walker", "Coral Heart"],
      origin: "Tropical / Island"
    },
    arctic: {
      family: ["Icevein", "Frostheart", "Snowfeld", "Glacier", "Winterborn", "Hoarfrost"],
      given: ["Bjorn", "Yuki", "Lumi", "Frost", "Eira", "Ulf", "Neve", "Tundra"],
      middle: ["Ice", "Snow", "Frost", "Glacier", "Winter"],
      epithet: ["Ice Walker", "Snow Hunter", "Frost Giant", "Glacier King"],
      origin: "Arctic / Frozen"
    },
    desert: {
      family: ["Dustwalker", "Sandstorm", "Oasis", "Scorch", "Mirage", "Sahara"],
      given: ["Zephyr", "Sirocco", "Amber", "Dune", "Sahara", "Oasis", "Ember", "Khamsin"],
      middle: ["Sand", "Sun", "Dust", "Mirage", "Heat"],
      epithet: ["Sand Viper", "Sun Scarab", "Dust Prophet", "Mirage Walker"],
      origin: "Desert / Sand"
    },
    forest: {
      family: ["Mossheart", "Greenwood", "Fernshade", "Oakenshield", "Thornwood", "Wildfern"],
      given: ["Bramble", "Rowan", "Hazel", "Sylvan", "Ivy", "Oakley", "Fern", "Hawthorn"],
      middle: ["Leaf", "Root", "Moss", "Bark", "Petal"],
      epithet: ["Leaf Walker", "Root Keeper", "Moss Crown", "Bark Guardian"],
      origin: "Forest / Woodland"
    },
    swamp: {
      family: ["Grimwater", "Blackmire", "Fogbottom", "Rotwood", "Bogfeld"],
      given: ["Mire", "Fen", "Slough", "Marsh", "Tanner", "Wisp", "Bayou"],
      middle: ["Mud", "Bog", "Mist", "Rot", "Fen"],
      epithet: ["Mud Crawler", "Bog Witch", "Mist Hermit", "Fen Serpent"],
      origin: "Swamp / Bog"
    },
    angelic: {
      family: ["Seraphyne", "Aurelion", "Celestine", "Luminara", "Virtue"],
      given: ["Raphael", "Cassiel", "Uriel", "Seraphina", "Michael", "Gabriel", "Ariel"],
      middle: ["Light", "Wing", "Halo", "Grace", "Glory"],
      epithet: ["Light Bringer", "Winged Guardian", "Halo Bearer", "Graceful Dawn"],
      origin: "Angelic / Seraphic"
    }
  }

  const primaryBank = banks[style] || banks[category === "beast" ? "beast" : "fantasy"]
  const secondaryBank = style2 && banks[style2] ? banks[style2] : null
  const selected = secondaryBank
    ? {
        family: [...primaryBank.family.slice(0, 4), ...secondaryBank.family.slice(0, 4)],
        given: [...primaryBank.given.slice(0, 4), ...secondaryBank.given.slice(0, 4)],
        middle: [...primaryBank.middle.slice(0, 3), ...secondaryBank.middle.slice(0, 3)],
        epithet: [...primaryBank.epithet.slice(0, 2), ...secondaryBank.epithet.slice(0, 2)],
        origin: `${primaryBank.origin} blended with ${secondaryBank.origin}`
      }
    : primaryBank

  const pick = (items: string[], offset: number) => items[(seed + offset) % items.length]
  const makeBase = (offset: number) => {
    if (category === "beast") return `${pick(banks.beast.family, offset)} ${pick(banks.beast.given, offset + 3)}`
    if (category === "world") return `${pick(selected.family, offset)} ${pick(["Sect", "Clan", "Court", "Pavilion", "Order", "Dominion"], offset + 2)}`
    if (category === "place") return `${pick(selected.epithet, offset)} ${pick(["Vale", "Citadel", "Sanctum", "Grove", "Pass", "Harbor"], offset + 4)}`
    if (category === "item") return `${pick(selected.epithet, offset)} ${pick(["Blade", "Mirror", "Crown", "Seal", "Talisman", "Codex"], offset + 5)}`
    if (structure === "single") return pick(selected.given, offset)
    if (structure === "triple") return `${pick(selected.family, offset)} ${pick(selected.middle, offset + 2)} ${pick(selected.given, offset + 4)}`
    if (structure === "clan") return `${pick(selected.family, offset)} Clan`
    if (structure === "title") return `The ${pick(selected.epithet, offset)}`
    if (structure === "epithet") return `${pick(selected.given, offset)}, ${pick(selected.epithet, offset + 2)}`
    return `${pick(selected.family, offset)} ${pick(selected.given, offset + 3)}`
  }

  const options: Array<{
    name: string
    category: string
    style: string
    raceOrOrigin: string
    structure: string
    meaning: string
    pronunciation: string
    vibe: string
    bibleContent: string
  }> = []
  for (let offset = 0; options.length < requestedCount && offset < 200; offset += 1) {
    const name = makeBase(offset)
    const normalized = normalizeNameForCompare(name)
    if (!normalized || existing.has(normalized) || options.some(option => normalizeNameForCompare(option.name) === normalized)) continue
    options.push({
      name,
      category,
      style: style || "fantasy",
      raceOrOrigin: selected.origin,
      structure: structure || "any",
      meaning: `A ${tone} ${category} name shaped for ${selected.origin}${prompt ? `; inspired by ${prompt.slice(0, 80)}` : ""}.`,
      pronunciation: "",
      vibe: tone,
      bibleContent: `${name} is a generated ${category} name from Name Forge. It was created in a ${style || "fantasy"} style with a ${tone} tone.`
    })
  }
  return options
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

async function generateWithGroq(systemInstruction: string, userPrompt: string, jsonMode: boolean, temperatureOverride?: number) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Groq API key is not configured on the server. Please add GROQ_API_KEY to your environment.")
  }

  const temperature = temperatureOverride !== undefined ? temperatureOverride : (jsonMode ? 0.15 : 0.7)

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
      temperature,
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

async function generateWithGemini(systemInstruction: string, userPrompt: string, jsonMode: boolean, temperatureOverride?: number) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error("Gemini API key is not configured on the server. Please add GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your environment.")
  }

  const temperature = temperatureOverride !== undefined ? temperatureOverride : (jsonMode ? 0.2 : 0.8)
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash"

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature,
      maxOutputTokens: jsonMode ? 8192 : 4096,
    }
  })

  const result = await model.generateContent(userPrompt)
  const text = result.response.text()

  if (!text || typeof text !== "string") {
    throw new Error("Gemini returned an empty response.")
  }
  return text
}

// Maps user-facing style labels to image-generator quality modifier tokens
const APPEARANCE_STYLE_MODIFIERS: Record<string, string> = {
  "cinematic fantasy character concept art": "cinematic fantasy concept art, highly detailed, dramatic lighting, volumetric fog, artstation trending, sharp focus, 8k resolution, professional illustration",
  "anime": "anime style, vibrant colors, clean line art, cel shading, dynamic pose, expressive eyes, studio quality, 4k, detailed background",
  "dark fantasy": "dark fantasy concept art, gritty atmosphere, ominous lighting, oil painting style, dramatic chiaroscuro, highly detailed, artstation, 8k",
  "watercolor": "watercolor illustration, soft edges, painterly style, flowing color washes, delicate linework, storybook quality, dreamy atmosphere",
  "realistic portrait": "ultra-realistic portrait, photorealistic rendering, subsurface scattering, detailed skin texture, professional photography lighting, 8k, sharp focus",
  "concept art": "character concept art, turnaround sheet, multiple views, clean lines, flat color blocking, professional game art style, artstation",
  "comic book": "comic book style, bold outlines, dynamic pose, inked illustration, vibrant flat colors, action pose, Marvel/DC style",
  "oil painting": "oil painting, classical portrait style, rich color saturation, visible brushstrokes, master painter quality, museum-quality artwork",
  "chibi": "chibi style, super deformed, big expressive eyes, small body, cute proportions, pastel colors, kawaii aesthetic"
}

function expandAppearanceStyle(style: string): string {
  if (!style) return "cinematic fantasy concept art, highly detailed, dramatic lighting, artstation trending, 8k resolution"
  const normalized = style.trim().toLowerCase()
  for (const [key, expansion] of Object.entries(APPEARANCE_STYLE_MODIFIERS)) {
    if (normalized.includes(key) || key.includes(normalized)) return expansion
  }
  // Fallback: append generic quality boosters to whatever the user typed
  return `${style}, highly detailed, professional quality, artstation trending, sharp focus, 8k`
}

function extractKnownAppearanceDetails(loreContent: string): string {
  if (!loreContent) return ""
  // Look for structured appearance sections commonly written by the AI Bible Extract
  const lines: string[] = []
  const hairMatch = loreContent.match(/\b(?:hair|fur)\b[^.\n]{0,120}/i)
  const eyeMatch = loreContent.match(/\beyes?\b[^.\n]{0,120}/i)
  const faceMatch = loreContent.match(/\b(?:face|facial|jaw|cheek|brow|nose|lips|mouth|expression|smile|eyes? shape|handsome|beautiful|sharp features)\b[^.\n]{0,130}/i)
  const attireMatch = loreContent.match(/\b(?:wear(?:s|ing)?|cloth(?:es|ing)|robe|armor|attire|dress(?:es)?|outfit)\b[^.\n]{0,150}/i)
  const bodyMatch = loreContent.match(/\b(?:build|stature|height|tall|muscular|slender|lithe|stocky|frame|figure|physique)\b[^.\n]{0,120}/i)
  const skinMatch = loreContent.match(/\b(?:skin|complexion|scales?|hide|fur color)\b[^.\n]{0,120}/i)
  const weaponMatch = loreContent.match(/\b(?:weapon|sword|blade|axe|bow|staff|dagger|spear|hammer|gun|rifle|wand|orb|shield|clutched|wielded|holding|gripped|drew|drawing|nocked)\b[^.\n]{0,150}/i)
  if (hairMatch) lines.push(`- Hair/Fur: ${hairMatch[0].trim()}`)
  if (eyeMatch) lines.push(`- Eyes: ${eyeMatch[0].trim()}`)
  if (faceMatch) lines.push(`- Face/Expression: ${faceMatch[0].trim()}`)
  if (skinMatch) lines.push(`- Skin/Scales: ${skinMatch[0].trim()}`)
  if (bodyMatch) lines.push(`- Build: ${bodyMatch[0].trim()}`)
  if (attireMatch) lines.push(`- Attire: ${attireMatch[0].trim()}`)
  if (weaponMatch) lines.push(`- Weapon/Held Item: ${weaponMatch[0].trim()}`)
  return lines.length > 0 ? lines.join("\n") : ""
}

function formatKnownCharacterDetails(details: unknown, activeChapterNumber?: number): string {
  if (!details || typeof details !== "object") return ""

  const record = details as Record<string, unknown>
  const lines: string[] = []
  const addField = (label: string, key: string) => {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      lines.push(`- ${label}: ${value.trim()}`)
    }
  }

  addField("Overall appearance", "appearance")
  addField("Hair/Fur", "hair")
  addField("Eyes", "eyes")
  addField("Body/Silhouette", "body")
  addField("Height", "height")
  addField("Age", "age")
  addField("Attire", "attire")
  addField("Weapon/Held Item", "weapon")
  addField("Distinguishing features", "distinguishingFeatures")

  const chapterAppearances = Array.isArray(record.chapterAppearances)
    ? record.chapterAppearances.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : []

  if (chapterAppearances.length > 0) {
    const exactChapter = Number.isFinite(activeChapterNumber)
      ? chapterAppearances.filter(item => Number(item.chapterNumber) === Number(activeChapterNumber))
      : []
    const recentChapters = chapterAppearances.slice(-3)
    const prioritized = [...exactChapter, ...recentChapters].filter((item, index, array) => {
      const id = String(item.id || `${item.chapterNumber || ""}-${item.summary || ""}`)
      return array.findIndex(other => String(other.id || `${other.chapterNumber || ""}-${other.summary || ""}`) === id) === index
    })

    prioritized.forEach(item => {
      const chapterLabel = item.chapterNumber ? `Chapter ${item.chapterNumber}` : item.chapterTitle || "Chapter appearance"
      const detailsLine = [
        item.summary,
        item.appearance,
        item.hair,
        item.eyes,
        item.body,
        item.height,
        item.age,
        item.attire,
        item.weapon,
        item.distinguishingFeatures,
        item.evidence ? `evidence: ${item.evidence}` : ""
      ].filter(value => typeof value === "string" && value.trim()).join("; ")

      if (detailsLine) {
        lines.push(`- ${chapterLabel}: ${detailsLine}`)
      }
    })
  }

  return lines.join("\n")
}

function countPromptWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function expandShortAppearancePrompt(prompt: string, formKey: string): string {
  if (countPromptWords(prompt) >= 145) return prompt

  const normalizedKey = formKey.toLowerCase()
  const formSpecific = normalizedKey.includes("beast")
    ? "For this beast form: 100% beast. Full animal anatomy, natural beast stance (typically quadrupedal), complete beast head, body covered in fur/scales/hide, tail, no humanoid posture or features."
    : normalizedKey.includes("demi")
      ? "For this demi-human form: 50-80% beast / 20-50% human. MUST have: upright posture, humanoid torso, human-like arms with hands, beast or partially beast head (animal ears/muzzle/snout or full beast head on human body), beast legs, retained tail, retained fur or scales on most of the body, significantly larger than humans."
      : "For this humanoid form: the character must appear as a clean, predominantly human humanoid. Only include tails, wings, horns, fur, scales, animal ears, claws or other non-human traits if they are explicitly described in the chapter or lore for the humanoid form. Do not add or retain them by default."

  return `${prompt} Full head-to-toe composition, complete visual design with face, silhouette, skin or surface texture, clothing or natural covering, accessories, posture, atmosphere, and surrounding environment all clearly readable. ${formSpecific} Preserve every explicit trait from the chapter, Story Bible, and user notes while adding coherent secondary details that fit the scene mood, power level, social status, materials, lighting, and background.`
}

const APPEARANCE_FACE_TERMS = /\b(face|facial|jaw|cheekbones?|cheeks?|brows?|eyebrows?|eyes?|nose|mouth|lips?|expression|scar|markings?|tattoos?|skin|complexion|muzzle|snout|beak|fangs?)\b/i
const APPEARANCE_POSE_TERMS = /\b(pose|posture|stance|standing|crouch(?:ed|ing)?|prowling|kneeling|leaning|walking|running|leaping|gripping|holding|wielding|gesture|three-quarter|profile|turned|shoulders?|limbs?|claws?|paws?)\b/i

function getStringHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function cleanFaceShape(faceShape: string, hasEyes: boolean): string {
  if (!hasEyes) return faceShape
  return faceShape
    .replace(/,\s*wide-set eyes\b/i, "")
    .replace(/\bwide-set eyes,\s*/i, "")
    .replace(/\band\s+wide,\s+expressive\s+eyes\b/i, "")
    .replace(/,\s*and\s+wide,\s+expressive\s+eyes\b/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getDistinctAppearanceDirective(trimmedPrompt: string, formKey: string, label: string, index: number, totalForms: number, entryCategory: string, characterName: string = "", race?: string): string {
  const normalizedKey = formKey.toLowerCase()
  const safeLabel = label || formKey
  const nameHash = getStringHash(characterName || safeLabel)

  if (entryCategory === "beast" && normalizedKey.includes("beast") && !normalizedKey.includes("demi")) {
    return `Distinct face and pose for ${safeLabel}: Ensure the pose is a dynamic or majestic beast stance (such as coiling, lunging, soaring, swimming, or crouching) that directly captures the creature's class (e.g., serpentine coiling for a Leviathan, wing-spreading for a Phoenix) and matches the action and environmental intensity of the active chapter. The face must be 100% bestial and non-human (e.g. razor-fanged jaws, scales, horns, or a draconic snout), reflecting the scene's danger level (feral and aggressive if in battle, majestic and wise if calm).`
  }

  if (normalizedKey.includes("demi")) {
    return `Distinct face and pose for ${safeLabel}: Pose the demi-human in an upright, two-legged stance with human-like arms and chest, but with beastly lower legs, claws, tail, and body coverage (fur, scales, or feathers). The face must be a highly stylized, high-quality hybrid blending recognizable humanoid features (eyes, expression) with beastly details (horns, ears, facial markings, fangs, or fine scales). Ensure the pose, elemental aura, and expression perfectly capture the energy, speed, combat readiness, or spellcasting intensity of the active chapter.`
  }

  if (normalizedKey.includes("human") || normalizedKey.includes("humanoid")) {
    const humanPoses = [
      "upright three-quarter character stance with a deliberate hand gesture, dynamic hand sign, or aura interaction",
      "relaxed, side-profile pose with one hand resting on their belt, head turned towards the viewer with an enigmatic expression",
      "dynamic spellcasting stance with arms outstretched, hands glowing with magical energy, robes billowing, weight shifted back",
      "grounded, centered stance with feet shoulder-width apart, arms raised in a ready posture or defensive guard, focused gaze",
      "introspective seated pose, elbows resting on knees, eyes cast downward, aura softly radiating outward",
      "wide-legged power stance, arms loosely crossed, chin raised, exuding dominance and presence"
    ]
    // Large pool of distinct face structures — anchored by character name hash to avoid reuse across characters
    let faceShapes = [
      "a round face with a soft jawline, low cheekbones, and a short forehead",
      "a heart-shaped face with a tapered jaw, high cheekbones, and a wide forehead",
      "a diamond-shaped face with a narrow jaw, dramatic high cheekbones, and a narrow forehead",
      "a long face with a slender jawline, flat cheekbones, and a towering forehead",
      "a rectangular face with a wide, chiseled jaw, strong cheekbones, and a high brow",
      "a square face with a broad, sharp jaw, flat cheekbones, and a low forehead",
      "a triangular face with a wide jaw, subtle cheekbones, and a narrow forehead",
      "an oval face with a balanced jaw, soft cheekbones, and a medium-height forehead"
    ]
    let eyeTypes = [
      "narrow, deep-set amber eyes with vertical slit-pupils under thick straight brows, showing a cold expression",
      "wide, wide-set turquoise-blue eyes with thin arched brows and delicate eyelashes, showing a cute, youthful expression",
      "hooded, close-set violet eyes with bushy angled brows and sparse eyelashes, showing a mysterious, enigmatic expression",
      "almond-shaped, deep-set jade-green eyes with soft rounded brows and thick eyelashes, showing a gentle, serene expression",
      "large, round silver-grey eyes with thin slanted brows and long eyelashes, showing a regal expression",
      "slanted, wide-set gold eyes with thick arched brows and heavy eyelashes, showing an intimidating, feral glare",
      "half-lidded, deep-set crimson eyes with sparse straight brows, showing a cold, battle-hardened expression",
      "asymmetric eyes with complete heterochromia (one deep sapphire blue, one emerald green) under uneven brows, showing a curious expression"
    ]
    let skinAndHair = [
      "porcelain skin with faint freckles and a beauty mark on the cheek, with waist-length straight silver hair in a ponytail",
      "warm golden-brown skin with smooth texture and deep dimples, with thick, shoulder-length curly brown hair",
      "ashen-grey stone-like skin with faint wrinkles and a jagged scar across the brow, with a messy undercut of spiky dark hair",
      "sun-bronzed olive skin with a rough, weathered texture and laugh lines, with long, voluminous wavy auburn hair in dreadlocks",
      "rich mahogany skin with a flawless, glowing texture and a subtle birthmark, with short, tightly-coiled jet-black locs",
      "translucent, celestial-glowing skin with a soft blush, with fine, straight lavender-colored hair styled with elaborate braids",
      "cool pale-blue skin with metallic silver speckles, with a sleek, asymmetric bob of copper-red hair",
      "shadow-infused dark skin with a velvety texture and a faint tattoo on the jaw, with a messy, windswept buzz cut of silver-white hair"
    ]

    if (race && race !== "any") {
      const normalizedRace = race.toLowerCase()
      if (normalizedRace === "japanese" || normalizedRace === "east asian") {
        faceShapes = [
          "a slim oval face with a soft jawline, delicate chin, and high cheekbones",
          "a heart-shaped face with a tapered chin and soft forehead",
          "a refined angular face with a defined but elegant jaw and subtle cheekbones",
          "a round face with soft contours, smooth temples, and a youthful chin"
        ]
        eyeTypes = [
          "dark brown almond-shaped eyes with distinct epicanthic folds and an enigmatic, quiet gaze",
          "large, expressive dark brown eyes with soft eyelids and a gentle, observant look",
          "narrow, sharp eyes with an upward tilt and a calculating, focused intensity",
          "slanted, fox-like dark eyes that are quick-moving and convey sharp intelligence"
        ]
        skinAndHair = [
          "smooth, pale porcelain skin, with straight, glossy jet-black hair tied up in a neat topknot",
          "warm ivory skin with a healthy glow, with thick straight dark brown hair falling in natural bangs",
          "sun-bronzed golden skin from outdoor training, with windswept black hair worn loose",
          "pale ivory skin with cool undertones, with straight raven-black hair cascading down the shoulders"
        ]
      } else if (normalizedRace === "chinese" || normalizedRace === "xianxia") {
        faceShapes = [
          "a slender oval face with soft, symmetrical proportions and a delicate jaw",
          "a heart-shaped face with high, elegant cheekbones and a gently pointed chin",
          "a smooth, rounded face with gentle contours and a classic look",
          "a sharp, angular face with a high brow ridge and refined, clean jawline"
        ]
        eyeTypes = [
          "almond-shaped dark eyes with a slight upward tilt, exuding a serene and deep spiritual calm",
          "narrow, calculating dark phoenix-eyes with double eyelids and a piercing, sharp gaze",
          "large, bright obsidian-colored eyes with long dark lashes and an air of pure vitality",
          "half-lidded, tranquil dark eyes that seem to hold ancient wisdom and quiet focus"
        ]
        skinAndHair = [
          "flawless pale jade-like skin, with waist-length straight jet-black hair held by an ornate silver hairpin",
          "fair porcelain skin with a subtle pink warmth, with long straight dark hair flowing freely in the wind",
          "warm ivory skin with an ethereal clarity, with glossy black hair styled in intricate traditional buns",
          "cool pale skin with a smooth texture, with silver-streaked dark hair tied back with a silk ribbon"
        ]
      } else if (normalizedRace === "korean") {
        faceShapes = [
          "a slim oval face with a smooth, soft chin and high cheekbones",
          "a heart-shaped face with a narrow jaw and soft temples",
          "a balanced face with clean contours and refined proportions",
          "a long face with a slender nose bridge and elegant jawline"
        ]
        eyeTypes = [
          "dark brown almond-shaped eyes with clean, single-folded eyelids and an intense, focused gaze",
          "wide, bright dark eyes with soft contours and an expressive, warm look",
          "narrow, sharp dark brown eyes with long lashes and a calculating expression",
          "slightly upward-tilted almond eyes with a cool, poised look"
        ]
        skinAndHair = [
          "extremely clear, glowing pale skin, with straight jet-black hair styled neatly",
          "flawless ivory skin with a soft finish, with thick dark brown hair falling naturally",
          "cool pale skin with a rosy undertone, with glossy dark hair worn long and sleek",
          "fair skin with a dewy texture, with straight black hair tied back"
        ]
      } else if (normalizedRace === "middle eastern" || normalizedRace === "persian" || normalizedRace === "arabic") {
        faceShapes = [
          "a strong, angular face with a chiseled jaw, high cheekbones, and a prominent brow",
          "a striking oval face with balanced, noble features and a strong chin",
          "a diamond-shaped face with dramatic cheekbones and a tapered jawline",
          "a long, regal face with a straight nose bridge and defined, sharp contours"
        ]
        eyeTypes = [
          "large, deep-set dark brown eyes framed by thick, dark eyelashes and an intense, passionate gaze",
          "amber-colored almond eyes with a slight upward slant and a calculating, sharp look",
          "piercing dark brown eyes under thick, arched brows that convey absolute authority",
          "warm hazel eyes with a soft tilt and an air of quiet determination"
        ]
        skinAndHair = [
          "rich warm olive skin, with thick, wavy jet-black hair styled with natural volume",
          "golden-bronzed skin with a warm radiance, with thick curly dark brown hair worn short",
          "sun-kissed tan skin with a smooth texture, with long, cascading wavy black hair",
          "deep olive complexion with clean undertones, with a neatly trimmed thick black beard and wavy hair"
        ]
      } else if (normalizedRace === "norwegian" || normalizedRace === "nordic" || normalizedRace === "viking") {
        faceShapes = [
          "a broad, square-jawed face with a strong chin and heavy brow ridge",
          "a long, angular face with a high forehead and defined, prominent cheekbones",
          "a robust, chiseled face with weathered features and a straight nose bridge",
          "a wide heart-shaped face with high cheekbones and a solid jaw"
        ]
        eyeTypes = [
          "piercing ice-blue eyes with a cold, focused intensity under low-set light eyebrows",
          "clear grey eyes that shift like stormy seas, expressing a quiet and stubborn resolve",
          "luminous pale green eyes with a calculating tilt and a sharp, watchful gaze",
          "deep-set blue-grey eyes with faint shadows, showing a battle-hardened wisdom"
        ]
        skinAndHair = [
          "pale, fair skin with a slight ruddy flush, with thick braided golden-blonde hair",
          "weathered fair skin with light freckles, with ash-blonde or light brown windswept hair",
          "cool, pale skin with visible veins, with long, straight strawberry-blonde hair",
          "fair skin with a rugged texture, with thick, wild platinum-blonde hair worn loose"
        ]
      } else if (normalizedRace === "scottish" || normalizedRace === "celtic" || normalizedRace === "gaelic") {
        faceShapes = [
          "a heart-shaped face with a delicately pointed chin and high, defined cheekbones",
          "a long oval face with soft contours, a straight nose, and a high forehead",
          "a sharp, angular face with a narrow jaw and high cheekbones",
          "a square-jawed, rugged face with a freckled forehead and strong brow"
        ]
        eyeTypes = [
          "clear green eyes with an upward tilt, conveying a lively curiosity and fierce spirit",
          "bright grey-blue eyes with faint laughter lines, showing a warm and quick-witted nature",
          "deep-set forest-green eyes under thick reddish brows, locking onto targets with focus",
          "large, soft blue eyes that look calm and thoughtful"
        ]
        skinAndHair = [
          "porcelain-freckled skin with a rosy flush, with vibrant copper-red hair worn in wild waves",
          "pale skin with a rosy flush on the cheeks, with thick auburn hair falling in soft curls",
          "fair skin with a smooth texture, with sandy-brown or ginger-blonde hair styled in loose braids",
          "sun-freckled light skin, with deep chestnut hair worn long and windswept"
        ]
      } else if (normalizedRace === "african") {
        faceShapes = [
          "a strong face with broad, high cheekbones, a rounded chin, and a defined jaw",
          "a wide, expressive oval face with balanced proportions and full, striking features",
          "a heart-shaped face with high, prominent cheekbones and a tapered chin",
          "a square face with a strong, solid jawline and a wide forehead"
        ]
        eyeTypes = [
          "large, deep dark brown eyes with a warm, luminous quality and thick dark lashes",
          "expressive obsidian-colored eyes under thick, naturally arched brows with a sharp focus",
          "warm amber-brown eyes with a gentle downward tilt, conveying quiet strength",
          "piercing dark brown eyes that are wide-set and show deep wisdom"
        ]
        skinAndHair = [
          "rich dark mahogany skin with a flawless sheen, with short tightly-coiled jet-black hair",
          "warm golden-brown skin with an inner glow, with thick black hair styled in intricate cornrows",
          "deep warm espresso skin, with long micro-braids cascading down the shoulders",
          "smooth copper-brown skin with rich undertones, with a textured black afro"
        ]
      } else if (normalizedRace === "indian" || normalizedRace === "south asian") {
        faceShapes = [
          "a soft oval face with balanced proportions, a straight nose bridge, and a gentle jawline",
          "a heart-shaped face with high cheekbones and a delicately curved chin",
          "a refined angular face with a clear jawline and a high forehead",
          "a round face with soft contours and expressive, balanced features"
        ]
        eyeTypes = [
          "large, expressive dark brown almond eyes with a warm, deep, and liquid quality",
          "deep hazel-brown eyes with a slight upward tilt, showing a calculating and sharp intellect",
          "piercing dark eyes framed by long, thick black eyelashes and thick, dark arched brows",
          "warm golden-brown eyes with a calm, serene expression"
        ]
        skinAndHair = [
          "rich warm bronze skin with a smooth texture, with thick, glossy wavy jet-black hair",
          "golden-tan skin with warm undertones, with long cascading dark brown wavy hair",
          "deep warm brown skin with a golden radiance, with thick black hair worn in a long braid",
          "olive-tan skin with a healthy glow, with thick black hair styled back"
        ]
      } else if (normalizedRace === "american" || normalizedRace === "native american") {
        faceShapes = [
          "a strong oval face with high, broad cheekbones and a solid jawline",
          "a balanced oval face with a straight nose bridge and a rounded chin",
          "an angular face with defined, sharp cheekbones and a narrow chin",
          "a broad face with a strong brow and defined, rugged contours"
        ]
        eyeTypes = [
          "deep dark brown eyes with a sharp, calculating focus under straight eyebrows",
          "warm hazel eyes with light flecks, conveying a calm and observant nature",
          "expressive dark brown eyes under arched brows, showing quick-witted intelligence",
          "clear brown eyes with a steady, unblinking gaze"
        ]
        skinAndHair = [
          "sun-bronzed copper-tan skin, with long, straight jet-black hair worn loose",
          "warm golden-tan skin with a smooth texture, with thick wavy dark brown hair",
          "light golden-brown skin, with long straight black hair styled in braids",
          "tan skin with faint sun freckles, with windswept dark hair"
        ]
      } else if (normalizedRace === "mediterranean") {
        faceShapes = [
          "a classic oval face with balanced, symmetric features and a straight nose",
          "a strong-jawed face with a defined chin and prominent cheekbones",
          "a diamond-shaped face with high cheekbones and a clear jawline",
          "a soft oval face with gentle contours and a warm expression"
        ]
        eyeTypes = [
          "piercing dark brown eyes with a calculating slant and thick dark eyelashes",
          "warm amber-colored eyes under defined brows, conveying intelligence and passion",
          "deep hazel eyes with a soft tilt, showing a quiet and persistent focus",
          "dark almond-shaped eyes with a watchful, alert gaze"
        ]
        skinAndHair = [
          "warm olive skin with a golden undertone, with thick, wavy dark brown hair styled back",
          "sun-kissed light tan skin with a smooth finish, with thick curly black hair",
          "rich olive complexion, with long cascading dark chestnut wavy hair",
          "smooth golden skin, with wavy jet-black hair falling naturally"
        ]
      } else if (normalizedRace === "elf" || normalizedRace === "ethereal") {
        faceShapes = [
          "an elegant, elongated heart-shaped face with high, sweeping cheekbones and a delicately pointed chin",
          "a slender, long oval face with sharp, refined jawline and high, narrow forehead",
          "a delicate, narrow diamond face with high cheekbones and a narrow brow",
          "a graceful, angular face with fine symmetry and a smooth, tapering chin"
        ]
        eyeTypes = [
          "large, tilted almond-shaped eyes of glowing jade-green with thin, high-arched silver brows",
          "deep-set, luminous violet eyes with an otherworldly depth and long, fine eyelashes",
          "slanted, narrow golden eyes with a sharp, ethereal intensity and faint celestial glow",
          "wide, expressive sapphire eyes that shimmer with ancient memories and soft wisdom"
        ]
        skinAndHair = [
          "porcelain-pale skin with a faint, moonlit celestial glow, with waist-length straight silver-white hair",
          "smooth, light-copper skin with a soft golden sheen, with flowing honey-gold wavy hair",
          "cool, pale-lavender skin with a soft matte finish, with straight twilight-blue hair falling in a neat braid",
          "soft, alabaster skin with a delicate pearlescent shimmer, with windswept silk-textured white hair"
        ]
      } else if (normalizedRace === "dwarf" || normalizedRace === "stout") {
        faceShapes = [
          "a broad, rectangular face with a massive, square jaw and a low, heavy forehead",
          "a solid, square face with pronounced cheekbones, a deep brow ridge, and a robust chin",
          "a rugged, round face with full cheeks, a wide weathered nose bridge, and a thick jaw",
          "a compact, stocky face with deep-set features, a wide forehead, and a prominent chin cleft"
        ]
        eyeTypes = [
          "deep-set, dark amber eyes under thick, bushy dark eyebrows with a stubborn, fierce glare",
          "small, piercing granite-grey eyes framed by heavy laugh lines and a focused, intense gaze",
          "shrewd bronze-colored eyes that sparkle with mechanical intelligence under a heavy, furrowed brow",
          "dark brown, wide-set eyes with a warm but unyielding focus and thick, heavy eyelashes"
        ]
        skinAndHair = [
          "rugged, weathered stone-textured skin with faint lines, with a massive braided copper-red beard and hair",
          "deep sun-bronzed, freckled skin with thick pores, with a long, flowing dark brown beard and braided hair",
          "ash-grey, soot-stained skin with a tough leather-like texture, with a short, stiff iron-grey beard and spiky hair",
          "warm, ruddy skin with prominent cheeks, with a thick, well-kept golden-blonde beard and side-braids"
        ]
      } else if (normalizedRace === "orc" || normalizedRace === "rugged" || normalizedRace === "goblinoid") {
        faceShapes = [
          "a brutal, angular face with a massive protruding lower jaw, prominent underbite fangs, and a low sloping forehead",
          "a rugged, broad face with heavy brow ridges, scarred cheeks, and a wide flat nose",
          "a lean, triangular face with pointed, flared ears, a sharp jutting chin, and high gaunt cheekbones",
          "a square, battle-hardened face with a thick neck, broken nose bridge, and a solid, asymmetrical jawline"
        ]
        eyeTypes = [
          "glinting crimson eyes under a heavy, scarred brow ridge, exuding a wild, feral intensity",
          "small, deep-set yellow-amber eyes that glow faintly in the dark with a predatory, cold focus",
          "burning orange eyes with slitted pupils, conveying a battle-hardened, intimidating glare",
          "narrow, bloodshot dark brown eyes with uneven eyebrows and a fierce, watchful gaze"
        ]
        skinAndHair = [
          "thick, weathered dull-green skin with battle scars, with coarse black hair shaved into a topknot",
          "tough, ash-grey skin with a rough leather texture, with a wild mane of stiff white hair",
          "coarse, deep bronze-brown skin with faint tribal markings, with dreadlocked dark hair",
          "pale olive skin with rough, stone-like patches, with a spiky undercut Mohawk of crimson-dyed hair"
        ]
      } else if (normalizedRace === "celestial" || normalizedRace === "divine") {
        faceShapes = [
          "a perfectly symmetrical, radiant oval face with soft, noble contours and a high, clear forehead",
          "a regal, heart-shaped face with high cheekbones, a straight slender nose, and a gentle jaw",
          "an elegant diamond-shaped face with refined, clean contours and a calm, majestic chin",
          "a soft, glowing face with balanced proportions and a serene, divine expression"
        ]
        eyeTypes = [
          "luminous gold eyes that radiate a soft, warm light under thin, elegant brows",
          "clear, star-like silver eyes with no pupils, expressing a calm, omniscient intelligence",
          "brilliant sky-blue eyes that shimmer like twilight under arched, flawless white brows",
          "deep sapphire-blue eyes with faint nebula-like patterns swirling within the irises"
        ]
        skinAndHair = [
          "immaculate pale skin with a soft, warm celestial glow, with flowing hair of pure, shimmering gold filaments",
          "smooth, pearlescent alabaster skin that reflects light, with waist-length hair of spun silver",
          "light-bronze skin that glows with a quiet warmth, with thick, wavy hair of deep violet-blue",
          "luminous golden-tan skin with an ethereal clarity, with hair of soft white light that billows gently"
        ]
      } else if (normalizedRace === "shadow" || normalizedRace === "void") {
        faceShapes = [
          "a sharp, gaunt diamond face with hollow cheeks, a narrow pointed chin, and a high brow",
          "an angular, long face with a razor-sharp jawline and shadowed, deep-set features",
          "a slim, mysterious oval face with dark contours, a slender nose, and a guarded expression",
          "a heart-shaped face with a narrow jaw and high cheekbones that cast long, dark shadows"
        ]
        eyeTypes = [
          "void-black eyes with faintly glowing amethyst pupils, conveying a cold, mysterious intensity",
          "narrow, piercing crimson eyes that burn like embers in the shadows under thin, dark brows",
          "luminous silver eyes that contrast sharply with dark surroundings, showing a calculating gaze",
          "half-lidded lavender eyes with slitted dark pupils and an enigmatic, quiet watchfulness"
        ]
        skinAndHair = [
          "shadow-infused, ashen-grey skin that seems to absorb light, with vaporous black hair that drifts like smoke",
          "cool, pale-lavender skin with a matte finish, with straight, ink-black hair styled with sharp angles",
          "deep obsidian-black skin with a faint metallic sheen, with silver-white hair styled in tight braids",
          "dusk-purple skin with a velvety texture, with long, straight indigo hair falling loose to the shoulders"
        ]
      } else if (normalizedRace === "draconic" || normalizedRace === "dragon") {
        faceShapes = [
          "a reptilian-influenced humanoid face with fine scales along the cheeks, a strong jaw, and a defined chin",
          "a sharp, angular face with a pronounced brow ridge, small horns at the temples, and a straight nose bridge",
          "a bold, square-jawed face with fine crimson scales tracing the jawline and a prominent chin",
          "a fierce, heart-shaped face with high, scale-crested cheekbones and a narrow, pointed chin"
        ]
        eyeTypes = [
          "slit-pupil reptilian eyes of burning amber-gold, exuding a regal, intimidating presence",
          "glowing emerald eyes with slitted pupils under thick, dark brows that slant downward",
          "bright ruby-red eyes with a reflective tapetum, locking onto targets with a hot, focused glare",
          "deep bronze eyes with vertical slits, conveying ancient patience and a calculating mind"
        ]
        skinAndHair = [
          "warm golden-tan skin with shimmering gold scales on the cheekbones, with a thick mane of dark bronze hair",
          "cool charcoal-grey skin with fine obsidian scales along the jaw, with spikes of ash-grey hair",
          "rich copper-red skin with patches of crimson scales, with long, straight scarlet hair tied in a high ponytail",
          "deep jade-green skin with delicate emerald scales on the neck, with flowing dark green wavy hair"
        ]
      } else if (normalizedRace === "stone" || normalizedRace === "crystal" || normalizedRace === "golem") {
        faceShapes = [
          "a chiselled face with flat planes, a square-cut jawline, and a solid forehead, resembling carved granite",
          "a sharp, geometric diamond face with facets like polished crystal, a narrow nose, and high cheekbones",
          "a rugged rectangular face with cracked, weathered features and a heavy brow ridge",
          "a blocky, solid face with heavy proportions, a broad flat nose bridge, and a thick chin"
        ]
        eyeTypes = [
          "solid, glowing amethyst-purple eyes with no pupils, emitting a soft crystal radiance under stone brows",
          "piercing jade-green eyes that shine like polished gems from deep-set sockets",
          "faintly glowing cobalt-blue eyes that resemble cracks in stone filled with energy",
          "warm, golden amber eyes that look like fossilized sap, reflecting a slow, ancient wisdom"
        ]
        skinAndHair = [
          "cool, granite-grey skin with a fine stone texture and faint cracks, with hair of stiff, fibrous dark moss",
          "translucent crystal-like skin with a soft pink quartz hue, with spikes of glowing rose-quartz crystal instead of hair",
          "weathered, basalt-black skin with rough fissures, with a beard and hair of glowing blue crystal shards",
          "smooth, marbled white skin with gold veins, with flowing hair of fine golden fibers"
        ]
      }
    }

    const faceShape = faceShapes[nameHash % faceShapes.length]
    const eyeType = eyeTypes[(nameHash + 3) % eyeTypes.length]
    const skinHair = skinAndHair[(nameHash + 7) % skinAndHair.length]
    const pose = humanPoses[(nameHash + 1) % humanPoses.length]

    // Detect if details are already present in the prompt to prevent contradictions
    const hasHair = /\b(hair|locks|braid(?:s|ed)?|bald|coiffure|tresses|ponytail|curls|waves|shaven)\b/i.test(trimmedPrompt)
    const hasEyes = /\b(eyes|gaze|look|iris|pupils|lashes)\b/i.test(trimmedPrompt)
    const hasSkin = /\b(skin|complexion|flesh|hide)\b/i.test(trimmedPrompt)
    const hasPose = /\b(pose|posing|posed|posture|stance|standing|stands|crouch(?:ed|ing)?|kneel(?:ed|ing)?|seated|sit(?:s|ting)?|lean(?:ed|ing)?|running|walking|ready posture)\b/i.test(trimmedPrompt)
    const hasFace = /\b(face|facial|jaw|jawline|cheekbones|cheeks|chin)\b/i.test(trimmedPrompt)

    // Split skinAndHair into skin and hair parts to selectively append them
    const skinHairParts = skinHair.split(/(?:,\s+with\s+|,?\s+hair\s+)/i)
    const skinPart = skinHairParts[0] ? skinHairParts[0].trim() : ""
    let hairPart = skinHairParts[1] ? skinHairParts[1].trim() : ""
    if (hairPart && !hairPart.toLowerCase().startsWith("hair")) {
      hairPart = "hair " + hairPart
    }

    const faceShapeCleaned = cleanFaceShape(faceShape, hasEyes || hasFace)

    const faceParts: string[] = []
    if (!hasFace && faceShapeCleaned) faceParts.push(faceShapeCleaned)
    if (!hasEyes && eyeType) faceParts.push(eyeType)

    const skinHairPartsList: string[] = []
    if (!hasSkin && skinPart) skinHairPartsList.push(skinPart)
    if (!hasHair && hairPart) skinHairPartsList.push(hairPart)

    if (skinHairPartsList.length > 0) {
      faceParts.push(skinHairPartsList.join(", and "))
    }

    const raceClause = race && race !== "any" ? `reflecting a clear ${race} heritage and facial structure` : ""

    let faceDirective = ""
    if (faceParts.length > 0) {
      faceDirective = `design a humanoid face with ${faceParts.join(", ")}`
      if (raceClause) {
        faceDirective += `, ${raceClause}`
      }
    }

    let poseDirective = ""
    if (!hasPose && pose) {
      poseDirective = `Pose the figure in a ${pose}.`
    }

    if (!faceDirective && !poseDirective) {
      return ""
    }

    const faceSection = faceDirective ? `${faceDirective}. ` : ""
    const poseSection = poseDirective ? `${poseDirective} ` : ""

    return `Distinct face and pose for ${safeLabel}: ${faceSection}${poseSection}This face must feel entirely unique to this character — do NOT reuse generic "striking face" or "ethereal face" templates; derive the face from the character's role and lore instead.`
  }

  const faceProfiles = [
    "an angular face with narrowed alert eyes, firm brows, pronounced cheekbones, and a controlled mouth",
    "a softer oval face with wide searching eyes, lifted brows, a guarded half-frown, and visible skin details",
    "a severe weathered face with heavy brows, a sharp nose, tight lips, and a battle-ready expression",
    "a composed regal face with calm eyes, refined nose, elegant jawline, and restrained expression"
  ]
  const poseProfiles = [
    "a three-quarter standing pose with one hand, limb, or aura lifted into the composition",
    "a forward-leaning movement pose with weight shifted through the shoulders and hips",
    "a side-on guarded stance with the head turned and the silhouette clearly readable",
    "an upright commanding pose with squared shoulders and energy or environment arranged behind the figure"
  ]
  const faceProfile = faceProfiles[nameHash % faceProfiles.length]
  const poseProfile = poseProfiles[(nameHash + index) % poseProfiles.length]

  const hasEyes = /\b(eyes|gaze|look|iris|pupils|lashes)\b/i.test(trimmedPrompt)
  const hasPose = /\b(pose|posing|posed|posture|stance|standing|stands|crouch(?:ed|ing)?|kneel(?:ed|ing)?|seated|sit(?:s|ting)?|lean(?:ed|ing)?|running|walking|ready posture)\b/i.test(trimmedPrompt)

  let faceProfileCleaned = faceProfile
  if (hasEyes) {
    faceProfileCleaned = faceProfileCleaned
      .replace(/with narrowed alert eyes,\s*/i, "")
      .replace(/with wide searching eyes,\s*/i, "")
      .replace(/with calm eyes,\s*/i, "with a ")
      .replace(/\s+/g, " ")
      .trim()
  }

  const raceString = race && race !== "any" ? `, exhibiting characteristic ${race} features,` : ""

  if (hasPose) {
    return `Distinct face for ${safeLabel}: do not reuse the same facial design as the other ${Math.max(totalForms, 2)} forms; give this form ${faceProfileCleaned}${raceString}.`
  }

  return `Distinct face and pose for ${safeLabel}: do not reuse the same facial design or body pose as the other ${Math.max(totalForms, 2)} forms; give this form ${faceProfileCleaned}${raceString} plus ${poseProfile}.`
}

function ensureDistinctCharacterAppearancePrompt(prompt: string, formKey: string, label: string, index: number, totalForms: number, entryCategory: string, characterName: string = "", race?: string): string {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) return trimmedPrompt

  // If the prompt is already detailed (e.g., has 120+ words), return it as is.
  // The LLM generates high-quality, customized prompts directly; appending static text ruins them.
  if (countPromptWords(trimmedPrompt) >= 120) {
    return trimmedPrompt
  }

  const needsFace = !APPEARANCE_FACE_TERMS.test(trimmedPrompt)
  const needsPose = !APPEARANCE_POSE_TERMS.test(trimmedPrompt)
  const shouldForceDistinctVariant = totalForms > 1

  if (!shouldForceDistinctVariant && !needsFace && !needsPose) {
    return trimmedPrompt
  }

  return `${trimmedPrompt} ${getDistinctAppearanceDirective(trimmedPrompt, formKey, label, index, totalForms, entryCategory, characterName, race)}`
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
    } else if (action === "generate_pose") {
      const { name, category, formLabel, poseStyle, loreEntry } = body
      systemInstruction =
        "You are an expert character designer and art director. " +
        "Your task is to generate a highly detailed, dynamic description of a character's physical pose, stance, and body language.\n" +
        "Guidelines:\n" +
        "1. Write a vivid, focused description of approximately 50-80 words.\n" +
        "2. Do NOT mention the character's name, general appearance, or background. Only describe the physical pose, posture, limb positions, weight distribution, hand gestures, and any immediate visual aura/energy matching the pose.\n" +
        "3. Match the selected style: " + String(poseStyle || "dynamic") + ".\n" +
        "4. Output ONLY the raw descriptive phrase. No intro, no quotes, no markdown headers, and no outro comments."
      
      const charDetails = loreEntry && typeof loreEntry === "object" ? ` (Category: ${category || "character"}, Lore: ${loreEntry.content || ""})` : ""
      userPrompt = `Generate a pose description for a character named "${name}" in their "${formLabel || "Humanoid Form"}" matching the style "${poseStyle || "dynamic"}".${charDetails}`
    } else if (action === "generate_attire") {
      const { name, category, formLabel, attireNature, loreEntry } = body
      systemInstruction =
        "You are an expert fantasy/sci-fi clothing and armor designer. " +
        "Your task is to generate a highly detailed, textured description of a character's clothing, armor, or attire.\n" +
        "Guidelines:\n" +
        "1. Write a vivid, focused description of approximately 50-80 words.\n" +
        "2. Focus entirely on fabrics, materials, colors, armor plates, trim, accessories, fit, drape, and how the clothing/armor flows or sits on the body.\n" +
        "3. Do NOT mention the character's name, face, or general pose. Only describe the attire itself.\n" +
        "4. Match the selected attire nature: " + String(attireNature || "fantasy robes") + ".\n" +
        "5. Output ONLY the raw descriptive phrase. No intro, no quotes, no markdown headers, and no outro comments."
      
      const charDetails = loreEntry && typeof loreEntry === "object" ? ` (Category: ${category || "character"}, Lore: ${loreEntry.content || ""})` : ""
      userPrompt = `Generate an attire description for a character named "${name}" in their "${formLabel || "Humanoid Form"}" matching the nature "${attireNature || "fantasy robes"}".${charDetails}`
    } else if (action === "appearance_prompts") {
      const { name, selectedText, forms, chapter, loreEntry, formLabels, formEnabled, style, lighting, atmosphere, camera, regenerateForm, perFormNegatives, facialFeatures, race, isAdHoc } = body
      const isAdHocMode = isAdHoc === true
      const safeFormLabels = formLabels && typeof formLabels === "object" ? formLabels as Record<string, string> : {}
      const safeFormEnabled = formEnabled && typeof formEnabled === "object" ? formEnabled as Record<string, boolean> : {}
      const appForms = forms && typeof forms === "object" ? forms as Record<string, string> : {}

      const safeLoreEntry = loreEntry && typeof loreEntry === "object"
        ? loreEntry as { name?: string; category?: string; content?: string; groups?: string[]; aliases?: string[]; characterDetails?: unknown }
        : null
      const chapterContext = chapter && typeof chapter === "object"
        ? chapter as { title?: string; chapterNumber?: number; content?: string; targetEvidence?: string }
        : null
      const rawEntryCategory = typeof safeLoreEntry?.category === "string" ? safeLoreEntry.category : ""
      const entryCategory = rawEntryCategory === "beast" || rawEntryCategory === "character" || rawEntryCategory === "place" || rawEntryCategory === "world" || rawEntryCategory === "item"
        ? rawEntryCategory
        : "other"
      const isCharacterLike = entryCategory === "beast" || entryCategory === "character"
      const categoryFormKeys = isCharacterLike
        ? ["beastForm", "demiHumanForm", "humanForm"]
        : null
      const enabledFormKeys = Object.keys(safeFormEnabled).filter(k => safeFormEnabled[k] !== false)
      const requestedFormKey = typeof regenerateForm === "string" && regenerateForm.trim() ? regenerateForm.trim() : ""
      const defaultVisualFormKeys = entryCategory === "place"
        ? ["environmentScene", "mapView", "interiorDetail"]
        : entryCategory === "world"
          ? ["planetView", "regionalMap", "environmentScene"]
          : entryCategory === "item"
            ? ["artifactCloseup", "inUseScene"]
            : ["environmentScene", "mapView"]
      const baseFormKeys = categoryFormKeys
        ? categoryFormKeys.filter(k => safeFormEnabled[k] !== false)
        : (enabledFormKeys.length > 0 ? enabledFormKeys : (Object.keys(appForms).length > 0 ? Object.keys(appForms) : defaultVisualFormKeys))
      const formKeys = requestedFormKey && (baseFormKeys.includes(requestedFormKey) || (categoryFormKeys && categoryFormKeys.includes(requestedFormKey)))
        ? [requestedFormKey]
        : baseFormKeys
      const chapterText = String(chapterContext?.content || "").trim()

      const usePerFormNegatives = perFormNegatives !== false // default true for backward compat

      const hasDescription = Boolean(
        chapterText &&
        (selectedText || safeLoreEntry?.name || name)
      )

      if (!hasDescription) {
        return NextResponse.json({ error: "Choose an active chapter with content and a World Bible person, beast, place, world, or item before generating visual prompts." }, { status: 400 })
      }

      const formLabelsStr = formKeys.map(k => {
        const fallbackLabel = k === "humanForm" ? "Humanoid Form" : k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
        const label = safeFormLabels[k] || fallbackLabel
        return `"${k}": "${label}"`
      }).join(", ")
      const requiredFormRule = entryCategory === "beast"
        ? "This Story Bible entry is a BEAST. You must create prompts for the requested form(s) (Beast Form, Demi-human Form, or Humanoid Form). These forms represent evolutionary stages of the same creature.\n\n" +
          "CRITICAL BEAST ARCHETYPE & CHAPTER INTENSITY INSTRUCTIONS:\n" +
          "1. IDENTIFY THE BEAST SPECIES/CLASS: Read the name and lore (e.g., 'Leviathan', 'Titan-Ape', 'Qilin'). If the creature is a known mythical type (like a Leviathan), generate an awe-inspiring, massive, and powerful representation of that class (e.g., colossal armor-plated marine serpent, leviathan-scale sea titan, fiery celestial avian, storm-clad dragon) even if the description in the Bible is sparse.\n" +
          "2. ADAPT TO CHAPTER ACTION & INTENSITY (READ CHAPTER WELL): You MUST read and analyze the active chapter context. If the scene is intense, chaotic, or combat-focused, the beast's pose, expression, and surrounding elements must reflect this intensity. For example, a fighting Leviathan should be coiling, lunging, roaring, churning titanic waves, with eyes glowing like molten gold, jaws wide, surrounded by crackling lightning or stormy seas. If the scene is calm or mysterious, the beast should look majestic, ancient, and dormant, blending with the environment.\n" +
          "3. STRICT BEAST FORM PROGRESSION RULES:\n" +
          (formKeys.includes("beastForm") ? "   - Beast Form: 100% beast. Fully animal/creature anatomy. No human stance, no humanoid hands, no human clothing. Use colossal, gargantuan scale keywords. Focus on powerful claws, tails, fangs, scales, wings, or horns. The pose must match the chapter action (e.g., coiling, lunging, breathing energy, soaring through clouds).\n" : "") +
          (formKeys.includes("demiHumanForm") ? "   - Demi-Human Form: 50%-80% Beast, 20%-50% Human. A stylized, high-quality hybrid. Must combine:\n" +
            "     • Upright, powerful humanoid stance (two legs)\n" +
            "     • Human-like arms and hands, but with beastly claws or scales\n" +
            "     • Hybrid face (e.g., human features combined with glowing beast eyes, animal ears, horns, or cheek scales)\n" +
            "     • Beast legs (digitigrade, clawed paws, or hooves)\n" +
            "     • A long beast tail and body coverage of fine fur, feathers, or shimmering scales\n" +
            "     • Heightened scale: significantly larger and broader than average humans\n" +
            "     • Dress and gear: tribal wraps, leather armor plates, or robes that fit a warrior or shaman, with elemental aura matching the chapter's tone.\n" : "") +
          (formKeys.includes("humanForm") ? "   - Humanoid Form: Fully human silhouette. Retain tails, wings, horns, fur, scales, or other non-human traits **only if they are explicitly mentioned in the chapter or Story Bible for the humanoid form**. Do not add or default to them. The form must look human unless the input states otherwise. Note that 'humanoid form' refers to the silhouette and base species morphology; it MUST still fully incorporate any described human-compatible physical characteristics like extreme obesity, colossal size, screaming expressions, or damaged/peeling skin.\n" : "")
        : entryCategory === "character"
          ? "This Story Bible entry is a PERSON/CHARACTER. You must create a humanoid appearance prompt. Do not invent beast or demi-human forms for a person entry unless the chapter explicitly says they transform.\n"
          : entryCategory === "place"
            ? "This Story Bible entry is a PLACE. Generate environment, landmark, interior, route, or map prompts as requested. Do not turn the place into a human character. Ground scale, geography, architecture, climate, landmarks, hazards, and mood in the chapter and lore.\n"
            : entryCategory === "world"
              ? "This Story Bible entry is WORLD LORE. Generate planet, realm, region, map, or ground-level environment prompts as requested. Preserve cosmology, geography, biomes, moons, rings, continents, magic systems, factions, and travel context from the chapter and lore.\n"
              : entryCategory === "item"
                ? "This Story Bible entry is an ITEM or artifact. Generate object close-up and in-context scene prompts as requested. Preserve materials, scale, markings, damage, powers, ownership, how it is used, and the environment where it appears.\n"
                : "Use only the requested visual prompt types, and ground every prompt in the active chapter.\n"

      // Build per-form negative prompt guidance
      const formNegativeGuidance = formKeys.map(k => {
        const label = safeFormLabels[k] || k
        if (k === "beastForm") return `  - ${label}: exclude human face, smooth skin, humanoid clothing, upright posture, anthropomorphic features, human-like arms or torso`
        if (k === "demiHumanForm") return `  - ${label}: exclude fully animal anatomy, four-legged stance, complete fur/scales/hide that completely hides humanoid torso, human legs, small human-sized build, no tail`
        if (k === "humanForm" || k === "humanoidForm") return `  - ${label}: exclude tails, wings, horns, fur, scales, animal ears, claws, fangs, or any non-human physical traits unless they are explicitly mentioned in the chapter or lore for the humanoid form. The humanoid form must look human by default.`
        if (k.toLowerCase().includes("map")) return `  - ${label}: exclude photorealistic portrait framing, character close-up, unreadable fake text, random labels, modern UI overlays, satellite-photo realism unless requested`
        if (k.toLowerCase().includes("planet") || k.toLowerCase().includes("continent") || k.toLowerCase().includes("regional")) return `  - ${label}: exclude character portrait framing, crowded foreground figures, unreadable fake text, modern UI overlays, generic Earth copy`
        if (k.toLowerCase().includes("environment") || k.toLowerCase().includes("scene") || k.toLowerCase().includes("landmark") || k.toLowerCase().includes("interior")) return `  - ${label}: exclude isolated character portrait, blank generic background, modern objects unless present in lore, unreadable signage`
        if (k.toLowerCase().includes("artifact") || k.toLowerCase().includes("item") || k.toLowerCase().includes("object")) return `  - ${label}: exclude random extra objects, unreadable fake text, cropped object, modern product-photo styling unless requested`
        return `  - ${label}: exclude anything not grounded in the chapter description`
      }).join("\n")

      // Extract any pre-existing appearance facts from the Bible entry to use as hard constraints
      const knownDetails = [
        extractKnownAppearanceDetails(safeLoreEntry?.content || ""),
        formatKnownCharacterDetails(safeLoreEntry?.characterDetails, chapterContext?.chapterNumber)
      ].filter(Boolean).join("\n")
      const knownDetailsBlock = knownDetails
        ? `\nKnown appearance facts from Story Bible (do NOT contradict these):\n${knownDetails}`
        : ""

      // Expand the style into image-gen quality tokens
      let expandedStyle = expandAppearanceStyle(style || "cinematic fantasy character concept art")
      if (typeof lighting === "string" && lighting.trim()) {
        expandedStyle += `, ${lighting.trim()} lighting`
      }
      if (typeof atmosphere === "string" && atmosphere.trim()) {
        expandedStyle += `, ${atmosphere.trim()} atmosphere`
      }
      if (typeof camera === "string" && camera.trim()) {
        expandedStyle += `, ${camera.trim()}`
      }
      const visualSubjectLabel = entryCategory === "place"
        ? "place, environment, or location"
        : entryCategory === "world"
          ? "world, realm, planet, region, or setting"
          : entryCategory === "item"
            ? "item, artifact, weapon, relic, or object"
            : "character, creature, or visual subject"
      const subjectOrderRule = isAdHocMode
        ? "- Order the prompt by visual priority:\n" +
          "  * For character/beast subjects: (1) art style, (2) subject type + species + gender/age, (3) face + expression, (4) hair/fur/skin, (5) eyes, (6) body build, (7) clothing/armor/held items, (8) pose + aura, (9) background, (10) lighting.\n" +
          "  * For environment/planet/map/item subjects: (1) art style, (2) subject type, (3) scale/camera, (4) geography/layout/silhouette, (5) materials/construction, (6) landmarks/hazards/routes/powers, (7) atmosphere/lighting/color/mood.\n"
        : (isCharacterLike
          ? "- Order the prompt by visual priority: (1) art style + quality modifiers, (2) subject type + species/race + gender/age only when supported or safely inferable, (3) face + expression, (4) hair/fur/skin/scales color and texture, (5) eyes color and quality, (6) body build + silhouette, (7) clothing/armor/accessories (and any weapons/held items **only if explicitly mentioned**), (8) aura/power effects + pose, (9) background + setting, (10) lighting + mood. If generating a close-up of a specific body part or organ (such as an eye, wing, claw, horn), prioritize that part and its details immediately after the art style.\n"
          : "- Order the prompt by visual priority: (1) art style + quality modifiers, (2) visual subject type, (3) scale and camera angle, (4) geography/layout/silhouette, (5) architecture, terrain, materials, or object construction, (6) landmarks, routes, borders, powers, hazards, or usage context, (7) atmosphere, lighting, weather, color palette, and mood. For maps, specify top-down/atlas/cartography composition and avoid fake unreadable text unless exact names are supplied.\n")
      const chapterScanRule = isAdHocMode
        ? "1. PRIORITIZE THE WRITER'S SPECIFIC DETAILS (CRITICAL): The author's story text is the ultimate source of truth. You MUST carefully scan the Full Active Chapter Context and Highlighted Passage to extract all visual details. For characters: hair, facial hair, body build (e.g. extremely fat/obese, muscular, skeletal), scale (e.g. mansion-sized), skin state (e.g. peeling skin, scars), pose & expression (e.g. screaming, fighting, resting), ethnic/cultural descent, height, age, attire, weapons. For environments/planets/items: layout, architecture, materials, color, scale, atmosphere, celestial features (e.g. rings for a planet). Do NOT omit or contradict these. Never default to generic normal/average traits if the text describes extreme or unusual physical characteristics.\n"
        : (isCharacterLike
          ? "1. PRIORITIZE THE WRITER'S SPECIFIC DETAILS (CRITICAL): The author's story text is the ultimate source of truth. You MUST carefully scan the Full Active Chapter Context, Highlighted Passage, and Story Bible to extract ten core visual pillars: HAIR, FACIAL HAIR, BODY BUILD & PHYSICAL SCALE, SKIN STATE & TEXTURE, POSE & EXPRESSION, ETHNIC/CULTURAL DESCENT, HEIGHT, AGE, ATTIRE, and WEAPONS/HELD ITEMS. Do NOT omit, modify, or contradict any of these. If the chapter describes them, they MUST be the foundation of the generated prompts:\n" +
            "   - HAIR: Use the exact color, length, cut, style, and texture described (e.g. 'thinning silver hair parted to the left', 'disheveled braid of charcoal curls'). Avoid generic hair terms.\n" +
            "   - FACIAL HAIR: Incorporate any mentioned beard, mustache, stubble, whiskers, or facial hair details. Be specific about length, color, style, and texture (e.g., 'a full, flowing white beard and handlebar mustache', 'coarse black stubble lining his jaw'). If a character is described with a beard (like Shiva), it MUST be included and detailed in the prompt.\n" +
            "   - BODY BUILD & PHYSICAL SCALE: Incorporate the character's exact physical build (e.g. morbidly obese, extremely fat, muscular, skeletal, athletic, frail) and scale (e.g., 'about the size of a mansion', 'colossal', 'gargantuan'). If the character is described with extreme proportions, the prompt must explicitly reflect this build and scale (e.g., using keywords like 'colossal scale', 'towering above the surroundings', 'morbidly obese silhouette', 'massive double chins'). Never default to average/normal proportions when extreme proportions are described.\n" +
            "   - SKIN STATE & TEXTURE: Use the exact skin descriptions (e.g., 'skin about to peel off', 'rough weathered leather-like skin', 'smooth pale skin'). If a distressed or unusual skin state is described, include detailed descriptors matching that texture.\n" +
            "   - POSE & EXPRESSION: Reflect the character's emotional expression and action described in the text (e.g., 'screaming in anger', 'face contorted in pain', 'letting out a thunderous shout', 'sitting in calm meditation'). Never default to a generic passive or introspective pose if the chapter scene is highly active, chaotic, or intense.\n" +
            "   - ETHNIC/CULTURAL DESCENT: Identify any explicit ethnic descent, cultural heritage, or regional appearance (e.g. Indian descent, East Asian heritage, Mesoamerican look, Nordic features) from the text. Do NOT infer or assume heritage or ethnicity based solely on the character's name; only incorporate heritage details that are explicitly stated in the chapter text, Story Bible, or user notes. For characters like Shiva who have Indian descent, describe specific features in the prompt like warm golden-brown or olive skin tone, deep-set dark almond-shaped eyes, strong dark eyebrows, and a straight, well-defined nose bridge. Respect and project this heritage accurately in the prompt instead of using generic western templates.\n" +
            "   - HEIGHT: Incorporate the character's relative height (e.g., 'towering', 'tall', 'lanky', 'diminutive', 'petite') into their posture and the camera composition (e.g., use 'low-angle shot looking up' for towering height to emphasize their scale, or 'standing tall with broad shoulders' for a tall build).\n" +
            "   - AGE: Refine the visual age based on the writing (e.g., 'elderly monk with wrinkled brow and age spots', 'young youth', 'middle-aged merchant'). Translate this age into face textures, posture, and gaze.\n" +
            "   - ATTIRE: Use the exact clothes, armor, fabrics, colors, cloaks, or uniforms mentioned in the writing. Build the outfit prompt directly around these written garments first, and only supplement with matching materials if details are missing.\n" +
            "   - WEAPONS/HELD ITEMS: Scan the text to see if they hold, wield, carry, or use any weapon or item (e.g. a specific sword, staff, bow, dagger, book). If a weapon/item is mentioned, describe it in detail and portray the character holding/using it (e.g., 'firmly gripping a heavy iron claymore with both hands'). If NO weapon or held item is mentioned in the active chapter or Story Bible context, do NOT include any weapons; generate only their appearance, clothing, and pose without weapons.\n" +
            "2. BUILD PROMPT AROUND WRITTEN DETAILS: Always write the prompt such that the written details are the primary focus of the character's description. The prompt must be built around their hair, facial hair, body build, skin, pose, ethnic descent/culture, height, age, attire, and weapon. Avoid letting generic templates or your own assumptions overwrite the author's words.\n" +
            "3. Only AFTER faithfully incorporating all written details, intelligently supplement with consistent, high-quality details for anything missing (face shape, lighting, background, etc.) to create a complete, vivid, usable prompt.\n" +
            "4. SPECIFIC BODY PART OR CLOSE-UP FOCUS (CRITICAL): If the Highlighted Passage or target chapter text focuses on a specific body part (such as a single eye, claw, wing, horn, wound, tail) or specific sub-part rather than the entire body of the character/beast, your generated prompt for each requested form MUST be a macro close-up or highly focused description of that specific part/feature in the style and context of that form, rather than a full-body character portrait. For example, if generating a Beast Form and the focus is an eye, generate a close-up of the beast's wild reptilian or beastly eye. If Humanoid Form is requested, generate a close-up of the eye in its humanized form (retaining any special color/glow but in a humanoid orbit). Only generate full-body descriptions if the inputs describe the character/beast as a whole.\n\n"
          : "1. BEFORE writing any prompt, you MUST first silently extract and remember EVERY specific visual detail mentioned in the Full Active Chapter Context and especially the Target-Focused Chapter Evidence. This includes geography, architecture, terrain, rooms, streets, weather, lighting, biomes, celestial features, travel routes, borders, landmarks, materials, scale, object markings, powers, damage, ownership, and where the subject appears in the scene.\n" +
            "2. In the final image prompt, these chapter-provided details MUST appear accurately and naturally as the foundation of the description. Do NOT omit them, generalize them, or contradict them. If generating a map, use the chapter/lore to infer relative geography and travel routes, and keep labels minimal unless exact names are supplied.\n" +
            "3. Only AFTER faithfully incorporating all chapter-mentioned visual details, intelligently supplement with consistent, high-quality details for anything missing (camera angle, materials, lighting, scale cues, atmospheric effects, map border style, or environmental storytelling) to create a complete, vivid, usable prompt or image generation.\n\n")
      const subjectDesignRules = isAdHocMode
        ? "5. INFER THE SUBJECT TYPE BEFORE DESIGNING: Classify the target into 'character', 'beast', 'place', 'world', 'item'. Apply the corresponding design constraints.\n" +
          "6. PRESERVE NON-HUMAN & FANTASTICAL TRAITS: For character humanoid forms, only include non-human features (wings, tails, horns, etc.) if explicitly mentioned in the text.\n" +
          "7. NO DEFAULT WEAPONS: Do not include weapons unless explicitly described in the text.\n"
        : (isCharacterLike
          ? "5. INFER THE SUBJECT TYPE BEFORE DESIGNING: Decide whether the entry is human, beast, monster, demi-human, divine entity, spirit, demon, artifact-bodied being, or another story-specific type by reading category, name, aliases, groups, chapter behavior, and lore. Do not assume human unless the context supports it.\n" +
            "6. PRESERVE NON-HUMAN & FANTASTICAL TRAITS — STRICT RULE: Only include non-human or fantastical physical traits (wings, horns, scales, claws, tails, pointy ears, fur, animal features, etc.) in **any** form — especially humanoid forms — if they are **explicitly described or observed in the chapter text or Story Bible for that character in that form**. Do not invent, default to, or assume these traits from the character's category, name, or species alone. If nothing is mentioned about tails, wings, horns, fur, scales or similar, the humanoid form MUST appear fully human with no such features.\n" +
            "7. NO DEFAULT WEAPONS OR HELD ITEMS: Do NOT give the character any weapon (such as a sword, blade, bow, staff, dagger, spear, wand, or shield) or have them hold/wield a weapon UNLESS a weapon is explicitly mentioned or described in the active chapter or Story Bible context. If no weapon is mentioned in the input, do not include any weapons in the prompt; generate only their physical appearance, clothing, and pose without any held weapons.\n" +
            "8. INTELLIGENT EXTRAPOLATION FROM PARTIAL DETAILS: If the combined details from the user, chapter, and Story Bible are sparse (e.g., only hair and eye color are known), you MUST create a coherent head-to-toe visual concept that suits the character's role, species, power, social status, emotional tone, and scene context. Fill in face, body, skin/fur/scales, clothing or natural covering, accessories, posture, aura, lighting, and background — but **never add unmentioned non-human traits** (tails, wings, horns, fur, scales, animal ears, claws etc.) to humanoid forms, and **never add unmentioned weapons** (such as swords, staves, bows, daggers, etc.). Only include such traits if they are explicitly described in the chapter or lore for the humanoid form. Mark invented-but-plausible choices in consistencyNotes.\n"
          : "4. INFER THE VISUAL SUBJECT BEFORE DESIGNING: Decide whether the target should be treated as a location, planet, region, route, map, artifact, weapon, relic, interior, settlement, dungeon, battlefield, or other story-specific visual subject by reading category, name, aliases, groups, chapter behavior, and lore.\n" +
            "5. PRESERVE SETTING & OBJECT TRUTH — STRICT RULE: Only include landmarks, borders, routes, celestial bodies, architecture, materials, magical effects, damage, inscriptions, ownership marks, and technology that are supported by the chapter, Story Bible, or user-provided form notes. Do not copy generic fantasy map symbols or Earth-like geography unless the lore supports it.\n" +
            "6. INTELLIGENT EXTRAPOLATION FROM PARTIAL DETAILS: If the combined details are sparse, create a coherent visual design that suits the world's genre, culture, power system, climate, danger level, and story mood. Fill in layout, scale, materials, lighting, atmosphere, and environmental storytelling, but mark invented-but-plausible choices in consistencyNotes.\n")
      const facialRules = isAdHocMode
        ? "7. VISUAL CLARITY & CHARACTER DESIGN MANDATE (CRITICAL - always apply):\n" +
          "   - For character/creature portraits, apply the EXPERT CHARACTER DESIGN & FACIAL UNIQUENESS MANDATE: you are an expert character concept artist and character designer for a high-fantasy cinematic novel. Ensure every character has a unique and memorable face. Never reuse facial structures, proportions, or combinations of features. Treat every character as a completely new individual.\n" +
          "   - Shape variation: round, heart-shaped, diamond, long, rectangular, square, triangular, oval.\n" +
          "   - Proportion variation: eye spacing, depth, eyelids, eyelashes, brow thickness/angle, nose bridge/tip, nostril size, mouth width, lip fullness, chin/jaw width, cheek fullness, forehead height.\n" +
          "   - Imperfections: beauty marks, freckles, scars, dimples, asymmetrical smiles, laugh lines, uneven eyebrows, wrinkles, skin texture.\n" +
          "   - Tone and persona: regal, cute, mysterious, rugged, cold, gentle, intimidating, scholarly, ancient, battle-hardened, youthful, elegant, wild, feral, alien, ethereal.\n" +
          "   - Hair, Eye, Skin colors: broad variety of colors and styles, including fantasy hues (metallic, stone, crystal textures, celestial glow, shadow-infused skin).\n" +
          "   - Avoid generic adjectives like 'striking', 'beautiful', or 'handsome'. Describe real structural features, shapes, and textures.\n" +
          "   - For locations, maps, planets, or items, ensure the subject is immediately recognizable with layout, materials, landmarks, and atmospheric details.\n"
        : (isCharacterLike
          ? "7. EXPERT CHARACTER DESIGN & FACIAL UNIQUENESS MANDATE (CRITICAL - ALWAYS APPLY):\n" +
            "   You are an expert character concept artist and character designer for a high-fantasy cinematic novel. Your primary task is to generate complete visual descriptions for characters while ensuring every character has a unique and memorable face.\n" +
            "   - INDIVIDUALITY: Treat every character as a completely new individual. Never reuse facial structures, proportions, or combinations of features unless explicitly requested.\n" +
            "   - INTEGRATE USER/SOURCE DETAILS: If the user or chapter text provides appearance details, preserve every detail exactly, expand it naturally, add realistic complementary facial features, and improve visual quality without contradicting the source.\n" +
            "   - CREATING FROM SCRATCH: If the user provides little or no appearance information, create an entirely original appearance from scratch.\n" +
            "   - FACE DESIGN PILLARS: Every generated face must have a unique face shape, unique jawline, unique cheekbones, unique eye shape, unique eyebrow shape, unique nose, unique lips, unique ears, unique forehead, unique facial proportions, unique expression, unique beauty imperfections, and unique age characteristics. Never default to the same attractive face.\n" +
            "   - VARIATION IN SHAPES: Vary face shapes: round, heart-shaped, diamond, long, rectangular, square, triangular, oval.\n" +
            "   - VARIATION IN PROPORTIONS: Vary proportions: eye spacing, eye depth, eyelids, eyelashes, brow thickness, brow angle, nose bridge, nose tip, nostril size, mouth width, lip fullness, chin length, jaw width, cheek fullness, forehead height.\n" +
            "   - MEMORABLE IMPERFECTIONS: Include subtle imperfections when appropriate: beauty marks, freckles, scars, dimples, asymmetrical smiles, laugh lines, uneven eyebrows, skin texture, faint wrinkles. These imperfections make every face memorable.\n" +
            "   - AVOID CONVENTIONAL ATTRACTIVENESS: Do NOT always create conventionally attractive characters. Tailor their look to visually communicate their personality: regal, cute, mysterious, rugged, cold, gentle, intimidating, scholarly, ancient, battle-hardened, youthful, elegant, wild, feral, alien, ethereal. Avoid repeating facial archetypes.\n" +
            "   - HAIR VARIETY: If hair is unspecified in the source/user input, randomly generate: style, length, volume, texture, parting, braids, curls, waves, undercuts, ponytails, buzz cuts, dreadlocks, locs, spikes, ornaments. Hair color should suit the character.\n" +
            "   - EYE COLORS: Do not default to blue or red. Use a broad range: amber, hazel, silver, lavender, gold, turquoise, jade, bronze, grey, violet, crimson, emerald, deep brown, heterochromia.\n" +
            "   - SKIN TONES: Span the entire fantasy spectrum: human ethnicities, fantasy hues, metallic tones, stone textures, wood textures, crystal textures, celestial glow, shadow-infused skin.\n" +
            "   - RACE/HERITAGE: When races/heritages are given (e.g., East Asian, Nordic, African, Elf, Dwarf, Orc, Celestial, Shadow, Draconic, Stone, etc.), generate facial features appropriate to that race while maintaining uniqueness.\n" +
            "   - AVOID GENERIC ADJECTIVES: Do NOT use buzzwords like 'striking', 'beautiful', 'handsome', 'gorgeous', 'pretty', 'perfect face'. Instead, describe real structural features, shapes, and textures.\n" +
            "   - CONCEPT ART STYLE: The completed appearance should read like professional concept art instructions suitable for AI image generation.\n"
          : "7. ENVIRONMENT, MAP & OBJECT CLARITY MANDATE (CRITICAL - always apply): The visual subject must be immediately recognizable. For environments, describe a clear foreground/midground/background, scale cues, landmarks, weather, and lighting. For maps, describe top-down or atlas composition, coastlines, terrain symbols, routes, borders, compass/legend style, and avoid fake unreadable labels unless exact names are supplied. For planets, describe continents, atmosphere, moons/rings, cloud systems, lights, or magical phenomena. For items, describe silhouette, materials, markings, damage, scale, effects, and how it sits in the story environment.\n")
      const distinctFormRules = isAdHocMode
        ? "8. DISTINCT FACE + POSE PER FORM (CRITICAL): If generating multiple character forms, every form must have its own face and pose. For scenes/maps/items, ensure different forms show different angles, layouts, closeups, or contexts.\n"
        : (isCharacterLike
          ? "8. DISTINCT FACE + POSE PER FORM (CRITICAL): Every requested character form must have its own facial design and readable pose. Do not copy the same face, expression, stance, silhouette, or camera angle across forms. For each prompt, explicitly name the form-specific face/head details and the form-specific pose/action. Beast forms need fully bestial faces and natural beast stances; demi-human forms need hybrid faces and upright two-legged posture/action; humanoid forms need fully human faces by default and distinct upright character poses without unmentioned beast traits; custom forms still need different facial profiles, expressions, body orientations, and poses. If generating a close-up of a specific body part or organ (such as an eye, wing, claw, horn), ensure the camera angles, framing, lighting, and textures vary distinctly across the forms (e.g. beastly eye close-up vs human eye close-up) instead of a standard body pose.\n"
          : "")

      systemInstruction =
        "You are an expert image-generation prompt engineer specializing in visual concept art for novelists.\n" +
        "Your output prompts are fed directly into Stable Diffusion / SDXL or similar image generators, so they must be vivid, concrete, and visually complete enough for an image model to understand the " + visualSubjectLabel + " without extra explanation.\n\n" +
        "PROMPT FORMAT RULES (critical):\n" +
        "- Write each prompt as ONE long descriptive image-generation prompt with 3-5 dense sentences. It must read like a complete visual art direction paragraph, not a checklist and not a short tag dump.\n" +
        subjectOrderRule +
        "- Be specific: prefer 'waist-length silver hair with black streaks' over 'long hair'. Prefer 'glowing amber slitted eyes' over 'interesting eyes'.\n" +
        "- Include the expanded art style and quality tokens at the START of every prompt.\n" +
        "- Each prompt MUST be at least 150 words and should usually be 170-280 words. A prompt under 150 words is invalid. Do not stop after listing key traits; expand them into a full head-to-toe design with scene, posture, materials, lighting, aura, and background.\n\n" +
        "ACCURATE CHAPTER CAPTURE (HIGHEST PRIORITY):\n" +
        "STRICT FIDELITY RULE: The generated image prompt MUST faithfully incorporate EVERY visual detail explicitly mentioned in the Highlighted Passage and Chapter Context about the subject. For example, if the text describes a character with 'long hair and a long beard', or an item/planet as 'brown with rings around it', these details MUST be the central focus of the generated prompt. Under no circumstances should you invent contradictory details (like making the character bald, clean-shaven, or short-haired) or default to generic styling. The prompt must be built around the text's explicit descriptions first and foremost.\n" +
        chapterScanRule +
        "CONTENT & MERGING RULES (critical):\n" +
        "1. PRIORITIZE AND MERGE USER INPUTS: Any details the user explicitly typed in the form description (e.g., hair, eyes, clothing, or style in the 'Forms to generate prompts for' section) must be treated as absolute truth and included. Integrate them perfectly.\n" +
        "2. READ THE ACTIVE CHAPTER FIRST: Before designing, silently scan the Full Active Chapter Context and extract every visual clue written by the author about this " + visualSubjectLabel + ". These chapter-written details outrank generic fantasy defaults.\n" +
        "3. MERGE CHAPTER EVIDENCE & STORY BIBLE: The Target-Focused Chapter Evidence and Full Active Chapter Context contain the author's own words describing the target. Treat every specific visual detail from them as **mandatory** to include accurately. Highlighted passage is highest priority. Do not replace author-written details with your inventions or defaults.\n" +
        subjectDesignRules +
        "   - Cultivation/Xianxia: flowing Daoist silk robes with gold/silver embroidery, elaborate hairpins/crowns, dynamic hand gestures (sword seals), swirling Qi energy, floating spiritual talismans, and backgrounds like mist-shrouded mountain peaks or ancient temples.\n" +
        "   - Dark Fantasy: weathered leather, heavy plate armor with battle damage, dark hooded cloaks, rugged or scarred features, dramatic chiaroscuro lighting, and gothic, ruined, or stormy environments.\n" +
        "   - LitRPG/Sci-Fi: sleek armor plates, glowing runes or neon accents, holographic displays, athletic build, and high-tech or cybernetic backgrounds.\n" +
        facialRules +
        distinctFormRules +
        (isCharacterLike
          ? "9. FORM EVOLUTION (CRITICAL FOR MULTI-FORM ENTRIES): Strictly follow these anatomical rules for the requested forms:\n" +
            (formKeys.includes("beastForm") ? "   - Beast Form = 100% beast (full animal/creature body plan, stance, head, zero humanoid traits).\n" : "") +
            (formKeys.includes("demiHumanForm") ? "   - Demi-Human Form = 50-80% beast / 20-50% human with these REQUIRED traits: upright two-legged posture, humanoid torso, human-like arms and hands, beast or partially beast head, beast-style legs, retained tail, retained fur or scales over most of the body, significantly larger than humans. (Only include tail/fur/scales if they are signature traits mentioned in the input.)\n" : "") +
            (formKeys.includes("humanForm") ? "   - Humanoid Form = clean humanoid silhouette. The result must look like a human (or near-human) unless the chapter explicitly states the character has tails/wings/etc. in humanoid form. Do not default to adding any non-human traits. **CRITICAL: Do NOT add tails, wings, horns, fur, scales, claws or any non-human body features to the humanoid form unless the chapter or Story Bible explicitly describes the character as having them in humanoid form. However, the humanoid form MUST fully preserve all human-compatible attributes described in the text, such as extreme obesity, colossal scale, peeling skin, active screaming expressions, or unique facial structures. Do not default to clean-skin, average-sized, or passive templates.**\n" : "") +
            "   - Custom Forms (e.g., Undead Form, Spirit Form, Combat Stance, etc.): Portray the character with details specific to that custom state name. For example, for an 'Undead Form', portray the character with undead, skeletal, or decaying features, hollow eyes, pale/grey skin, and dark spectral aura as described in the chapter. For a 'Spirit Form', portray them as translucent, glowing, and ethereal. Ground the style in the label and the chapter descriptions.\n"
          : "") +
        "10. SPECIFY PREMIUM MATERIALS & DYNAMIC LIGHTING: Avoid generic terms. Specify materials (e.g., polished obsidian, white silk brocade, burnished silver), lighting (e.g., ethereal moonlight, dramatic rim lighting, firelight casting long shadows), and active visual effects (e.g., crackling blue lightning, swirling frost particles).\n" +
        "11. If the Known Appearance Facts block is present, treat those as absolute visual constraints — do not invent contradicting details.\n" +
        "12. " + requiredFormRule +
        (usePerFormNegatives
          ? "13. Every form's negativePrompt must be FORM-SPECIFIC and exclude elements that would break that form's visual logic:\n" +
            formNegativeGuidance + "\n" +
            "   Always also include in every negative: low quality, blurry, watermark, text, cropped, deformed anatomy, extra limbs, bad proportions, duplicate, disfigured.\n\n"
          : "13. Provide ONE strong shared negative prompt that covers general quality issues and form-specific problems. Keep negativePrompts minimal or empty unless a form has a truly unique blocker.\n" +
            "   Always include in the shared negative: low quality, blurry, watermark, text, cropped, deformed anatomy, extra limbs, bad proportions, duplicate, disfigured.\n\n"
        ) +
        (isAdHocMode
          ? "AD-HOC CLASSIFICATION MANDATE:\n" +
            "- Since this is an ad-hoc request (isAdHoc is true) and no Story Bible entry is selected, you MUST analyze the Highlighted Passage and Chapter Context to determine what subject is described.\n" +
            "- Classify the subject into one of the 5 categories: 'character', 'beast', 'place', 'world', 'item'.\n" +
            "- If the payload contains only the default form key 'humanForm' but the classified category is a non-character (beast, place, world, or item), you MUST ignore the default form key and generate prompts for the standard forms of that category:\n" +
            "  * beast: ['beastForm', 'demiHumanForm', 'humanForm']\n" +
            "  * place: ['environmentScene', 'mapView', 'interiorDetail']\n" +
            "  * world: ['planetView', 'regionalMap', 'environmentScene']\n" +
            "  * item: ['artifactCloseup', 'inUseScene']\n" +
            "- Populate 'inferredCategory' with the selected category name.\n" +
            "- Populate 'inferredName' with a short, descriptive name for the subject (e.g., 'Brown Rings Planet', 'Giant Flytrap', 'Ethereal Sword').\n" +
            "- Populate 'formLabels' in the output JSON with an object mapping each generated form key to its user-friendly display name (e.g., `{\"planetView\": \"Planet View\", \"regionalMap\": \"Regional Map\", \"environmentScene\": \"Environment Scene\"}`).\n\n"
          : "") +
        "OUTPUT RULES:\n" +
        "14. Output ONLY valid JSON with keys: characterName, overview, prompts, negativePrompts, consistencyNotes, negativePrompt, characterDetails" + (isAdHocMode ? ", inferredCategory, inferredName, formLabels" : "") + ".\n" +
        (isAdHocMode
          ? "   - prompts: object whose keys are either the inferred forms (e.g. planetView, regionalMap, environmentScene) or the explicitly requested forms if customized.\n" +
            "   - formLabels: object mapping each generated form key to its user-friendly display name (e.g. `{\"planetView\": \"Planet View\"}`).\n" +
            "   - inferredCategory: the category you classified the target into ('character', 'beast', 'place', 'world', 'item').\n" +
            "   - inferredName: the short name you inferred for the subject.\n"
          : "   - prompts: object with keys " + formLabelsStr + " — each value is the long descriptive image prompt string.\n"
        ) +
        (usePerFormNegatives
          ? "   - negativePrompts: object with the SAME keys, each value is the form-specific negative prompt string.\n"
          : "   - negativePrompts: object (can be empty or very brief when per-form negatives are disabled).\n"
        ) +
        "   - overview: 3-5 sentence prose summary of the target's overall visual identity and why the inferred design fits the chapter/lore.\n" +
        "   - consistencyNotes: array of up to 5 short strings flagging any visual details that conflicted between sources or were intelligently inferred because the source was sparse.\n" +
        "   - negativePrompt: a single shared negative prompt string as a fallback.\n" +
        "   - characterDetails: object with fields appearance, hair, eyes, body, height, age, attire, distinguishingFeatures, weapon (or held item) — descriptive prose phrases extracted from the active chapter and Story Bible. You MUST explicitly scan the chapter to find and extract these core details (especially hair, height, age, attire, weapon) and build the final prompts around them.\n" +
        "15. No markdown fences. No bullets inside prompt values. Do not use newline-separated tag lists inside prompt values."

      const chapterLine = chapterContext
        ? `\nActive Chapter: ${chapterContext.chapterNumber ? `Chapter ${chapterContext.chapterNumber} - ` : ""}${chapterContext.title || "Untitled"}`
        : ""
      // Always include chapter context so appearance generation can pick up visual clues beyond the selected mention.
      const chapterContent = chapterText
        ? `\nFull Active Chapter Context (required scan — extract all written visual details for this ${visualSubjectLabel} before inventing anything):\n${chapterText.slice(0, 14000)}`
        : ""
      const chapterEvidence = chapterContext?.targetEvidence
        ? `\nTarget-Focused Chapter Evidence (highest priority — use this first):\n${chapterContext.targetEvidence}`
        : ""
      const selectedLine = selectedText ? `\nHighlighted Passage (highest priority):\n${selectedText}` : ""
      const loreLine = safeLoreEntry
        ? `\nStory Bible Entry:\nName: ${safeLoreEntry.name || name || "Unknown"}\nType: ${safeLoreEntry.category || "unknown"}\nAliases: ${Array.isArray(safeLoreEntry.aliases) ? safeLoreEntry.aliases.join(", ") : "none"}\nGroups: ${Array.isArray(safeLoreEntry.groups) ? safeLoreEntry.groups.join(", ") : "none"}\nLore Notes:\n${safeLoreEntry.content || ""}`
        : ""

      const formDescriptions = formKeys.map((k, index) => {
        const fallbackLabel = k === "humanForm" ? "Humanoid Form" : k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
        const label = safeFormLabels[k] || fallbackLabel
        const userProvided = appForms[k]?.trim()
        const baseInfer = userProvided
          ? `User-specified traits: "${userProvided}"`
          : isCharacterLike
            ? "Infer from chapter evidence and lore (include chapter visual details accurately as foundation, then enhance). If the character is described holding or using a weapon (sword, bow, staff, etc.), this MUST be included in the visual description with specific details."
            : "Infer from chapter evidence and lore (include setting, geography, object, map, route, material, scale, and atmosphere details accurately as foundation, then enhance)."
        const beastNote = (entryCategory === "beast" && !userProvided) ? " For beast entries, strictly apply the mandatory beast/demi-human/humanoid anatomical rules even with minimal information. In humanoid form, do not add tails, wings or other non-human traits unless explicitly stated in the chapter." : ""
        const contextTextForFiltering = `${userProvided || ""} ${selectedText || ""} ${chapterText || ""} ${safeLoreEntry?.content || ""}`
        const distinctNote = isCharacterLike ? ` ${getDistinctAppearanceDirective(contextTextForFiltering, k, label, index, formKeys.length, entryCategory, name, race)}` : ""
        return `- ${label} (${k}): ${baseInfer}${beastNote}${distinctNote}`
      }).join("\n")

      userPrompt =
        `Visual target name: ${safeLoreEntry?.name || name || "Unknown / infer from context"}\n` +
        `World Bible category: ${safeLoreEntry?.category || "unknown"}\n` +
        `Art style and quality modifiers to use at the START of every prompt: ${expandedStyle}\n` +
        `${knownDetailsBlock}` +
        `${selectedLine}${chapterEvidence}\n` +
        `${chapterLine}${chapterContent}${loreLine}\n\n` +
        (selectedText ? `CRITICAL SPECIFIC FOCUS CHECK: The user highlighted "${selectedText}". If this describes a specific body part, organ, accessory, or sub-part (e.g. an eye, a claw, a sword) rather than the whole body of the creature/character, you MUST construct the prompts as detailed close-ups/focused descriptions of that specific part (styled and context-matched per requested form) rather than full-body portraits.\n` : "") +
        `IMPORTANT INSTRUCTION FOR THIS GENERATION: Faithfully use and preserve every visual description from the chapter/evidence above in the prompts. Build the artistic description AROUND those exact details first (the Target-Focused Evidence and Highlighted Passage are the highest priority source), then enhance for completeness and beauty. Do not drop or alter chapter details.\n` +
        (isCharacterLike ? `STRICT RULE FOR NON-HUMAN TRAITS: In humanoid or human forms, ONLY include tails, wings, horns, fur, scales, animal ears, claws or other non-human body features if they are explicitly described in the chapter or lore for that form. If nothing is stated, the humanoid form must be fully human with no such additions. Do not infer or default to them from the character's category or name.\n\n` : "") +
        (isCharacterLike && race && race !== "any" ? `RACE/CULTURAL APPEARANCE MANDATE: The character has the physical features and appearance of a ${race} person. You MUST explicitly describe their facial features, bone structure, skin tone, eye shape, and hair characteristics to reflect this specific heritage. Do NOT use generic or vague descriptors; ensure their facial structure is clearly, distinctly, and authentically ${race}.\n\n` : "") +
        (entryCategory === "beast" ? `BEAST ANATOMY RULES (MANDATORY): Beast form = 100% beast. Demi-human = 50-80% beast 20-50% human with upright posture, humanoid torso, human-like arms, beast/partial beast head, beast legs, retained tail + fur/scales, larger than human. Humanoid form only retains tail/fur/scales/build traits if the chapter or Story Bible explicitly says so.\n\n` : "") +
        (facialFeatures && typeof facialFeatures === "string" && facialFeatures.trim()
          ? (isCharacterLike
            ? `FACIAL FEATURES GUIDANCE (treat as high-priority truth - use this to define the face, eyes, expression, hair, and head even if the chapter is completely silent on appearance):\n"${facialFeatures.trim()}"\n\n`
            : `VISUAL ANCHOR GUIDANCE (treat as high-priority truth for geography, environment, object design, map style, materials, scale, and mood):\n"${facialFeatures.trim()}"\n\n`)
          : (isCharacterLike
            ? `FACIAL UNIQUENESS INSTRUCTION: No explicit facial features were provided. You MUST invent a face that is EXCLUSIVELY derived from this specific character's identity \u2014 their name (use its phonetic/cultural origin), clan/sect/bloodline, social status, age, personality, and the emotional tone of the current chapter. NEVER fall back on the same generic archetypes ("striking cultivator face", "ethereal beauty", "rugged warrior") across different characters. Each character must be visually irreplaceable. Define: exact face shape, unique eye shape and color and expression, brow style, nose profile, lip shape, jawline, chin, skin tone, hair style and color, and any defining marks or textures.\n\n`
            : `VISUAL ANCHOR INSTRUCTION: If the chapter gives sparse setting or object detail, infer a coherent environment, map, planet, or artifact design from the name, category, lore, groups, genre, and current chapter mood. Make the subject visually specific and immediately usable.\n\n`)
        ) +
        `Forms to generate prompts for:\n${formDescriptions}` +
        `${memoryContext}`
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
        customJsonInstruction = `\n16. CRITICAL: The user has enabled a custom JSON status template. The returned 'profile' object MUST contain a 'customJsonData' property. This 'customJsonData' property MUST be a valid JSON object matching the exact structure, keys, nesting, and value types of this template:\n${customJsonTemplateStr}\nAnalyze the chapter and fill in the values for the keys inside 'customJsonData' based on the chapter details. Preserve any existing values from the candidate/existing profile when no new details are found in the chapter.`
      }

      systemInstruction =
        "You are a web-novel character progression tracker for a novelist. " +
        "The writer wants a simple profile that can be refreshed whenever a chapter or chapters are scanned.\n" +
        "Guidelines:\n" +
        "1. Use the Story Bible entry, current chapter, target-specific chapter evidence, existing profile, and candidate profiles to create or update exactly one character profile.\n" +
        "2. If an explicit Story Bible entry is provided, that entry is the only target. Do not copy cultivation, powers, titles, bloodlines, skills, or lore from nearby characters. If no explicit Story Bible entry is provided, select the best candidate profile/lore entry based on names, aliases, actions, viewpoint, and progression evidence in the chapter.\n" +
        "3. MULTI-CHARACTER DIFFERENTIATION (CRITICAL): When multiple characters appear in the chapter:\n" +
        "   - Attribute EVERY detail (class, skills, realm, stage, relationships, appearance, actions, dialogue) ONLY to the character it belongs to.\n" +
        "   - Use: exact name/alias matches, speaker tags, pronouns in context, unique descriptors, who is acting/speaking.\n" +
        "   - Explicitly ignore or skip details for non-target characters.\n" +
        "   - If a detail cannot be confidently attributed to the target, do not include it in the profile update.\n" +
        "4. Read in this order: target-specific evidence first, Story Bible notes second, full chapter third, existing profile last for preservation. Do not stop after the first mention; scan the full chapter for later corrections, reveals, awakenings, status screens, dialogue labels, and narration.\n" +
        "4. The profile schema includes: name, title, additional titles, cultivation realm (profile.realm), cultivation stage/sub-rank (profile.stage), rank (profile.rank), bloodline name, bloodline rank, affinity names/ranks, main class, secondary class or extra classes, weapons, skills, and lore.\n" +
        "5. Put the character's main class/job/role in profile.className only when the text explicitly presents it as a class, job, occupation, system class, or combat role. If the chapter gives a second class, subclass, job, or secondary role, put it in profile.customFields['Secondary Class']; if there are more classes, use distinct custom fields such as profile.customFields['Class 2'], profile.customFields['Class 3'], and matching rank fields when known. Put extra titles beyond profile.title in custom fields such as profile.customFields['Title 2']. Put weapons or equipment in custom fields such as profile.customFields['Weapon'] or profile.customFields['Weapon 2']. Do not put classes, titles, or weapons in abilities or lore unless the chapter explicitly says they are skills/techniques.\n" +
        "6. Put the bloodline name in profile.customFields['Bloodline'] and its rank/grade/tier/quality such as Supreme or Celestial in profile.customFields['Bloodline Rank']. Do not put bloodlines in affinities or skills.\n" +
        "7. Put affinity names in profile.customFields['Affinity Names'] as a comma-separated list, such as Fire, Ice, Void. Put paired affinity ranks in profile.customFields['Affinity Rank'], such as Fire (High), Ice (Celestial), Void (Supreme). Preserve pairings when multiple affinities have different ranks. Do not put affinities in bloodline or class.\n" +
        "8. Put the character's cultivation realm (such as Demigod, God) in profile.realm. Put their cultivation stage/sub-rank (such as Low, Medium, High, Peak) in profile.stage. If the system uses a non-cultivation rank (or if realm is not applicable), put it in profile.rank. Use the Configured Cultivation Realms, Configured Stage Labels, and Uploaded Cultivation Guide when available to match and normalize these values. Any term that appears in the uploaded cultivation ladder is cultivation, not className, unless the chapter explicitly says it is a class/job. Be extremely smart and precise to pick up on even the smallest error or detail in character growth and cultivation advancements.\n" +
        "9. SKILLS, TECHNIQUES & ABILITIES (critical):\n" +
        "   - Scan the chapter (especially status screens, system notifications, character activation, narration of effects, and learning moments) for any skills, techniques, powers, spells, arts, or signature abilities used by or granted to the target.\n" +
        "   - For every ability: \n" +
        "     • name: Use the exact name as displayed in the chapter.\n" +
        "     • rank: Include rank/tier/layer if shown (e.g. 'Tier 2', '3rd Layer', 'Peak').\n" +
        "     • level: Use 1 if no explicit numeric level is stated.\n" +
        "     • description: This is the most important part. Carefully read exactly how the skill/technique/ability was DISPLAYED or described in the chapter (system message text, popup, character explanation, effect narration). Write a concise, flavorful description that captures the presentation style and core effect as revealed. Do not use generic summaries — ground it in the actual wording and context from the text.\n" +
        "       Example: Chapter shows system text '[Phantom Mirage Step] (Earth Rank) — Steps blur into afterimages, confusing foes for several breaths.' → Good description: 'Momentarily creates afterimages of the user to misdirect enemy attacks. Duration and effectiveness increase with rank.'\n" +
        "     • evidence: Include a short direct quote or snippet from the chapter showing where it appeared.\n" +
        "   - Only include abilities that are explicitly shown or used in this chapter or were already in the existing profile. Never invent new ones.\n" +
        "   - Do NOT put class names, bloodlines, or affinities into abilities unless the chapter explicitly presents them as skills/techniques.\n" +
        "10. Extract and return ONLY new, interesting reusable lore details discovered in this chapter in profile.notes (such as reputation, prophecy, rumor, weakness, relationship, hidden identity, origin, temperament, or an unusual detail). Do not return existing/past lore notes. If no new details exist in the chapter, return \"\" (an empty string) in profile.notes.\n" +
        "11. Preserve existing values when the current chapter gives no direct evidence. If the chapter has no meaningful progression or new character detail, keep the profile stable and set update.shouldApply to false. Still summarize that it was reviewed.\n" +
        "12. Never double-count previous profile history. Use the existing profile and processed chapter history as current truth.\n" +
        "13. In update.evidence, include short exact snippets that justify every changed card field, especially class, secondary class, cultivation realm (realm), stage, bloodline, bloodline rank, affinity names, affinity rank, and abilities/skills.\n" +
        "    For abilityChanges, you can return either simple strings or rich objects like { name: 'Flame Slash', rank: 'Tier 2', description: '...' } so the history can display the new description.\n" +
        "14. Output ONLY valid JSON with keys: targetLoreEntryId, targetProfileId, profile, and update. No markdown fences. profile must include name, title, className, rank, realm, stage, abilities, customFields, notes, level, exp, nextLevelExp, stats, traits, nicknames, uniqueTrait, cultivationPath, and optionally customJsonData. customFields must include Bloodline, Bloodline Rank, Affinity Names, Affinity Rank, Secondary Class, and any observed extra title/class/weapon fields. abilities must be an array where each has name, rank?, level, description (fitting text based on chapter display), evidence?. update must include shouldApply, summary, levelBefore, levelAfter, realmBefore, realmAfter, stageBefore, stageAfter, statChanges, abilityChanges (strings or objects containing name, rank, description), rewards, and evidence." +
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
        `- Name\n- Title\n- Cultivation Realm (profile.realm; e.g. Demigod, God; match against the configured cultivation realms list when possible)\n- Cultivation Stage (profile.stage; e.g. Low, Medium, High, Peak; match against the configured stage labels when possible)\n- Rank (profile.rank; e.g. Tier 1, Rank 4)\n- Bloodline (profile.customFields.Bloodline)\n- Bloodline Rank (profile.customFields['Bloodline Rank']; examples: Supreme, Celestial)\n- Affinity Names (profile.customFields['Affinity Names']; comma-separated for multiple affinities)\n- Affinity Rank (profile.customFields['Affinity Rank']; preserve pairings like Fire (High), Void (Supreme))\n- Main Class (profile.className)\n- Secondary Class (profile.customFields['Secondary Class'])\n- Skills/Techniques/Abilities (profile.abilities) — each entry MUST include: name, rank (if shown), level, description (write a fitting description by closely reading how the skill/technique/ability was DISPLAYED in the chapter — system text, activation, effects, etc.), evidence\n- Lore (profile.notes)\n\n` +
        customJsonPrompt +
        `Extraction Checklist:\n` +
        `1. Identify ONLY the target character. When multiple characters appear in the chapter, use names, aliases, speaker attribution, pronouns, context, and actions to attribute details correctly — NEVER mix details from other characters into the target's profile.\n` +
        `2. Search target evidence and full chapter for explicit status-like details, especially any displayed skills, techniques, or abilities (system messages, use descriptions, learning notifications).\n` +
        `3. Fill exact fields: Bloodline != Affinity != Class != Skills/Abilities.\n` +
        `4. For abilities: base the 'description' directly on the chapter's display text of that skill/technique.\n` +
        `5. Keep existing values when no new evidence appears.\n` +
        `6. Put supporting snippets in update.evidence.\n\n` +
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
    } else if (action === "brain_scan_updates") {
      const { chapters, existingBrainEntries } = body
      if (!Array.isArray(chapters) || !Array.isArray(existingBrainEntries)) {
        return NextResponse.json({ error: "chapters array and existingBrainEntries array are required for brain_scan_updates" }, { status: 400 })
      }

      systemInstruction =
        "You are a sharp creative writing memory assistant. The writer has a manuscript and wants to scan the provided recent chapters to detect new or relating details of already added entities in their Brain Map.\n" +
        "Guidelines:\n" +
        "1. Analyze the content of the provided chapters and compare it against the list of existing Brain Map entries.\n" +
        "2. For each existing entry, check if the chapters contain new details, developments, character progression, or relating context about them.\n" +
        "3. If updates are found, write a summary of the new developments in `updatedSummary` (keep it clean, concise, and clear) and extract supporting quote/text in `evidence`.\n" +
        "4. Choose an updated importance value: minor, major, or critical.\n" +
        "5. Output ONLY a JSON object with key:\n" +
        "  - updates: an array of objects, each containing:\n" +
        "    - entityName: the exact name of the matched existing entity (case-insensitive match)\n" +
        "    - updatedSummary: a concise 1-2 sentence recap of the new details or developments discovered in these chapters\n" +
        "    - evidence: a short paraphrased reason or detail from the text\n" +
        "    - importance: one of 'minor', 'major', 'critical'\n" +
        "Do not include markdown formatting or backticks around the JSON."

      const chaptersContext = chapters.map((chapter: any) => {
        const label = chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : "Chapter"
        return `### ${label}: ${chapter.title || "Untitled"}\n${chapter.content || ""}`
      }).join("\n\n---\n\n")

      const existingContext = existingBrainEntries.map((entry: any) => {
        return `- ${entry.entityName || entry.highlightedText || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${String(entry.aiSummary || "").slice(0, 300)}`
      }).join("\n")

      userPrompt = `Existing Brain Map entries:\n${existingContext}\n\nChapters to Scan:\n${chaptersContext}`
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
      const { chapterContent, existingBrainEntries, chapters, activeChapter, scanMode } = body
      if (!chapterContent) {
        return NextResponse.json({ error: "chapterContent is required for brain_suggest_additions" }, { status: 400 })
      }
      const chapterWindow = Array.isArray(chapters)
        ? chapters.slice(0, 10).map((chapter: any) => ({
            id: String(chapter?.id || ""),
            title: String(chapter?.title || "Untitled"),
            chapterNumber: Number.isFinite(Number(chapter?.chapterNumber)) ? Number(chapter.chapterNumber) : null,
            content: String(chapter?.content || "").slice(0, 12000)
          })).filter((chapter: any) => chapter.content.trim().length > 0)
        : []
      const isPreviousChapterScan = scanMode === "previous_chapters" && chapterWindow.length > 0

      systemInstruction =
        "You are a careful creative writing memory assistant for a novelist's Brain Map.\n" +
        (isPreviousChapterScan
          ? "Read the previous chapter window before the active chapter. Suggest up to 8 Brain Map additions or updates that are important because they are referenced repeatedly, gain new details in a later chapter, reveal character progression, establish a promise/foreshadowing, or clarify lore the writer is likely to reuse. Prefer concrete story facts over generic nouns. If an entity is already tracked, only suggest it when the provided chapters add a meaningful new update worth appending.\n"
          : "Scan the provided chapter text and extract up to 5 key names, items, places, concepts, or events that are NOT already tracked in the existing Brain Map entries list.\n") +
        "For each suggestion, provide a name, classification, importance, source chapter metadata, and a brief context recap grounded in the chapter text.\n" +
        "Output ONLY a JSON object with key:\n" +
        "- suggestions: an array of objects, each containing:\n" +
        "  - entityName: name of the entity (e.g. 'Arthur')\n" +
        "  - entityType: one of 'character', 'place', 'object', 'concept', 'event', 'foreshadowing'\n" +
        "  - importance: one of 'minor', 'major', 'critical'\n" +
        "  - aiSummary: a concise 1-2 sentence recap explaining the important fact or update based on the chapter content\n" +
        "  - chapterId: id of the most relevant source chapter, when provided\n" +
        "  - chapterTitle: title of the most relevant source chapter\n" +
        "  - chapterNumber: number of the most relevant source chapter, or null\n" +
        "  - evidence: a short paraphrased reason or detail from the text, not a long quote\n" +
        "  - mentionCount: estimated count of meaningful references across the provided chapters.\n" +
        "Do not include markdown formatting or backticks around the JSON."

      const existingContext = Array.isArray(existingBrainEntries) && existingBrainEntries.length > 0
        ? `\n\nExisting tracked Brain Map entries:\n${existingBrainEntries.slice(0, 100).map((entry: any) => {
            const chapter = entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Unknown chapter"
            return `- ${chapter}: ${entry.entityName || entry.highlightedText || "Unknown"} (${entry.entityType || "unknown"}, ${entry.importance || "minor"}) - ${String(entry.aiSummary || "").slice(0, 500)}`
          }).join("\n")}`
        : ""
      const activeContext = activeChapter
        ? `Active chapter currently open: ${activeChapter.chapterNumber ? `Chapter ${activeChapter.chapterNumber}` : "Chapter"} "${activeChapter.title || "Untitled"}". Only scan the previous chapters below.\n\n`
        : ""
      const previousChapterContext = chapterWindow.length > 0
        ? chapterWindow.map((chapter: any) => {
            const label = chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : "Chapter"
            return `### ${label}: ${chapter.title}\nchapterId: ${chapter.id}\n${chapter.content}`
          }).join("\n\n---\n\n")
        : String(chapterContent)
      userPrompt = `${activeContext}Previous Chapter Content:\n${previousChapterContext}${existingContext}`
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
      const { chapterContent, chapterTitle, chapterNumber, bibleEntries, chapters, activeChapter, scanMode } = body
      if (!chapterContent || !Array.isArray(bibleEntries)) {
        return NextResponse.json({ error: "chapterContent and bibleEntries are required for bible_extract_from_chapter" }, { status: 400 })
      }
      const chapterWindow = Array.isArray(chapters)
        ? chapters.slice(0, 10).map((chapter: any) => ({
            id: String(chapter?.id || ""),
            title: String(chapter?.title || "Untitled"),
            chapterNumber: Number.isFinite(Number(chapter?.chapterNumber)) ? Number(chapter.chapterNumber) : null,
            content: String(chapter?.content || "").slice(0, 12000)
          })).filter((chapter: any) => chapter.content.trim().length > 0)
        : []
      const isPreviousChapterScan = scanMode === "previous_chapters" && chapterWindow.length > 0

      systemInstruction =
        "You are a meticulous Story Bible curator for a novelist.\n" +
        (isPreviousChapterScan
          ? "Read the previous chapter window before the active chapter and propose high-value World Bible additions or updates. Prefer facts that recur, gain important new detail in a later chapter, change a character or faction status, clarify world rules, or are likely to matter again. Do not extract generic prose details or one-off background unless they establish canon.\n"
          : "Scan the active chapter and propose high-value canon additions.\n") +
        "Prefer facts that should be remembered later: new characters, beasts, factions, locations, artifacts, vows, relationships, status reveals, rules, secrets, deaths, promotions, appearance details, clothing/attire, and chapter-specific changes.\n" +
        "Match existing Story Bible entries by exact name or obvious alias when possible. For matched entries, provide matchedEntryId and a concise contentPatch to append. For new entries, provide category and starter notes.\n" +
        "For character or beast entries, always capture EVERY SINGLE VISUAL DETAIL described in the chapter. You MUST extract: face structure, facial hair (beard, mustache, whiskers), ethnic/cultural descent or heritage (e.g. Indian descent, East Asian features, Nordic appearance, etc.), skin tone, hair color/style/texture, eye color/shape, body shape/build, height, clothing, armor, accessories, scars, aura, posture, and weapons. Put these in characterDetails with top-level stable fields (appearance, hair, eyes, body, height, age, attire, weapon, distinguishingFeatures) and a chapterAppearance object with summary and exact evidence. Make sure you do NOT overlook beards, mustaches, specific jewelry, or specific cultural clothing/heritage/descent indicators mentioned in the text.\n" +
        "Every suggestion must include a timelineFact with summary, evidence, and optional status.\n" +
        "Every suggestion must also include chapterId, chapterTitle, chapterNumber, and mentionCount for the most relevant source chapter when those fields are available.\n" +
        "Output ONLY valid JSON with key suggestions. Limit to 10 suggestions."

      const existingContext = bibleEntries.slice(0, 120).map((entry: any) => {
        const facts = Array.isArray(entry.timelineFacts)
          ? entry.timelineFacts.slice(-8).map((fact: any) => `${fact.chapterNumber ? `Ch ${fact.chapterNumber}` : fact.chapterTitle || "Chapter"}: ${fact.summary || ""}`).join("; ")
          : ""
        const characterDetails = entry.characterDetails && typeof entry.characterDetails === "object"
          ? `; characterDetails=${JSON.stringify(entry.characterDetails).slice(0, 800)}`
          : ""
        return `- id=${entry.id}; name=${entry.name}; category=${entry.category}; notes=${String(entry.content || "").slice(0, 800)}; timeline=${facts}${characterDetails}`
      }).join("\n")

      const activeContext = activeChapter
        ? `Active chapter currently open: ${activeChapter.chapterNumber ? `Chapter ${activeChapter.chapterNumber}` : "Chapter"} "${activeChapter.title || "Untitled"}". Only scan the previous chapters below.\n\n`
        : `Active Chapter: ${chapterNumber ? `Chapter ${chapterNumber} - ` : ""}${chapterTitle || "Untitled"}\n\n`
      const previousChapterContext = chapterWindow.length > 0
        ? chapterWindow.map((chapter: any) => {
            const label = chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : "Chapter"
            return `### ${label}: ${chapter.title}\nchapterId: ${chapter.id}\n${chapter.content}`
          }).join("\n\n---\n\n")
        : String(chapterContent).slice(0, 60000)

      userPrompt =
        `${activeContext}` +
        `Existing Story Bible Entries:\n${existingContext || "No Story Bible entries yet."}\n\n` +
        `${isPreviousChapterScan ? "Previous Chapter Content" : "Chapter Content"}:\n${previousChapterContext}`
    } else if (action === "arc_seed_extract") {
      const { chapterContent, chapterTitle, chapterNumber, existingArcSeeds, bibleEntries, brainEntries } = body
      if (!chapterContent || typeof chapterContent !== "string") {
        return NextResponse.json({ error: "chapterContent is required for arc_seed_extract" }, { status: 400 })
      }

      systemInstruction =
        "You are a story development editor for a novelist. Read one completed chapter and identify the single strongest future arc seed hidden in it.\n" +
        "An arc seed is not a general summary. It is a concrete unresolved hook, promise, mystery, emotional wound, omen, object, relationship tension, threat, rumor, contradiction, or quiet detail that could be developed or paid off in future chapters.\n" +
        "Return only ONE best seed. If several exist, choose the one with the highest future-story potential and clearest evidence. Avoid noisy lists.\n" +
        "Prefer details that the author may forget but could later become an arc. Include exact evidence from the chapter.\n" +
        "Output ONLY valid JSON with key seed. seed must include title, summary, whyItMatters, futurePayoff, evidence, relatedCharacters, and relatedEntities."

      const seedContext = Array.isArray(existingArcSeeds)
        ? existingArcSeeds.slice(0, 80).map((seed: any) => `- ${seed.title || "Untitled"} (${seed.status || "open"}): ${seed.summary || ""}`).join("\n")
        : ""
      const bibleContext = Array.isArray(bibleEntries)
        ? bibleEntries.slice(0, 60).map((entry: any) => `- ${entry.name || "Unknown"} (${entry.category || "lore"})`).join(", ")
        : ""
      const brainContext = Array.isArray(brainEntries)
        ? brainEntries.slice(0, 60).map((entry: any) => `- ${entry.entityName || entry.highlightedText || "Unknown"}: ${entry.aiSummary || ""}`.slice(0, 280)).join("\n")
        : ""

      userPrompt =
        `Active Chapter: ${chapterNumber ? `Chapter ${chapterNumber} - ` : ""}${chapterTitle || "Untitled"}\n\n` +
        `Existing Arc Seeds:\n${seedContext || "No arc seeds yet."}\n\n` +
        `Known Story Bible Names:\n${bibleContext || "No Story Bible entries yet."}\n\n` +
        `Relevant Brain Map Memory:\n${brainContext || "No Brain Map entries yet."}\n\n` +
        `Chapter Content:\n${chapterContent.slice(0, 60000)}`
    } else if (action === "name_generate") {
      const { nameStyle, nameStyle2, nameCategory, nameSubType, nameGeneratorConfig, nameStructure, nameTone, nameGender, nameSyllableBank, customPrompt, bibleEntries, chapterContent, chapterTitle, count } = body
      if (!Array.isArray(bibleEntries)) {
        return NextResponse.json({ error: "bibleEntries is required for name_generate" }, { status: 400 })
      }

      const requestedCount = typeof count === "number" && count > 0 && count <= 20 ? count : 5
      const mashupLine = nameStyle2 ? `Mashup with secondary style: ${nameStyle2}. Blend elements from both styles naturally.` : ""
      const genderLine = nameGender && nameGender !== "any" ? `Preferred gender/orientation: ${nameGender}.` : ""
      const syllableLine = nameSyllableBank ? `Incorporate these syllables/roots where possible: ${nameSyllableBank}. Blend them organically into the names.` : ""

      let subtypeGuidance = ""
      const sub = String(nameSubType).toLowerCase()
      const cat = String(nameCategory).toLowerCase()
      const culture = nameGeneratorConfig?.culture || "Fantasy Mixed"

      if (cat === "character") {
        subtypeGuidance += `Category is CHARACTER (Type: ${nameSubType || "General"}).\n`
        if (sub === "humanoid") {
          const gender = nameGeneratorConfig?.gender || "male"
          const struct = nameGeneratorConfig?.structure || "single"
          const opt = nameGeneratorConfig?.additionalOption || "warrior"
          subtypeGuidance += `Generate Humanoid names matching culture/origin/race "${culture}", gender "${gender}", name structure "${struct}", and sound style "${opt}".\n`
          
          const cultLower = culture.toLowerCase()
          if (cultLower.includes("swahili")) {
            subtypeGuidance += "Use Swahili/East African naming patterns: melodic, rhythmic syllables ending in vowels (a, e, i, o, u), with prefix markers. Examples: Jengo, Kamaria, Zuberi, Zola.\n"
          } else if (cultLower.includes("yoruba")) {
            subtypeGuidance += "Use Yoruba/West African naming patterns: meaning-rich compound structures with tone play (e.g. Babajide, Olufemi, Adebayo, Temilade).\n"
          } else if (cultLower.includes("zulu")) {
            subtypeGuidance += "Use Zulu/Xhosa naming patterns: strong consonants, verb-derived meanings, and clicks/aspirations (c, q, x). Examples: Sipho, Thandi, Lindiwe, Bandile.\n"
          } else if (cultLower.includes("egyptian")) {
            subtypeGuidance += "Use Ancient Egyptian pharaonic naming patterns: suffixes and prefixes honoring gods (e.g. -amun, -hotep, -neb, -ra). Examples: Ramses, Nefertari, Imhotep, Amenhotep.\n"
          } else if (cultLower.includes("chinese")) {
            subtypeGuidance += "Use Chinese (Wuxia/Xianxia) naming patterns: Pinyin structure, standard family surname (Li, Zhang, Wang, Xiao) + one- or two-character given names (e.g. Feng, Wuchen, Qingxuan, Ruoxian). Examples: Xiao Feng, Li Wuchen, Zhang Qingxuan.\n"
          } else if (cultLower.includes("japanese")) {
            subtypeGuidance += "Use Japanese naming patterns: traditional syllables (ka, ki, ku, ke, ko, sa, shi, etc.) with classic endings (e.g. -ro, -ta, -suke, -ko, -mi, -ka). Examples: Kenji, Kazuma, Hiroto, Sakura, Miyuki.\n"
          } else if (cultLower.includes("korean")) {
            subtypeGuidance += "Use Korean naming patterns: Hanja structure, typically one-syllable surname (Kim, Lee, Park, Kang) + two-syllable given name (e.g. Min-jun, Eun-ji, Ji-woo). Examples: Kim Min-jun, Kang Eun-ji.\n"
          } else if (cultLower.includes("hindu") || cultLower.includes("indian")) {
            subtypeGuidance += "Use Sanskrit/Hindu naming patterns: divine prefixes, resonant phonetics, meaning-rich roots (e.g. -endra, -aditya, -esh, -ika). Examples: Arjun, Devendra, Priyadarshini, Aarav.\n"
          } else if (cultLower.includes("mongolian")) {
            subtypeGuidance += "Use Mongolian naming patterns: strong steppe warrior roots, compound names referencing skies, metal, or animals (e.g. Temür, Baatar, Genghis, Khulan). Examples: Yesütei, Borte, Temüjin.\n"
          } else if (cultLower.includes("nordic") || cultLower.includes("norse")) {
            subtypeGuidance += "Use Norse/Scandinavian naming patterns: strong runes, sagas, and patronymics/matronymics (-sen, -son, -dóttir). Examples: Ragnar, Freydis, Bjorn, Sigrid, Thorstein.\n"
          } else if (cultLower.includes("celtic")) {
            subtypeGuidance += "Use Celtic/Gaelic naming patterns: soft, flowing, mystical sounds with unique consonant clusters (bh, dh, th, sh, mh). Examples: Rowan, Maeve, Connor, Fiona, Alistair.\n"
          } else if (cultLower.includes("slavic")) {
            subtypeGuidance += "Use Slavic naming patterns: roots meaning peace, glory, or strength (-mir, -slav, -bor). Examples: Miroslav, Kazimierz, Vladislav, Milena, Danica.\n"
          } else if (cultLower.includes("greco-roman") || cultLower.includes("greek") || cultLower.includes("roman")) {
            subtypeGuidance += "Use Hellenic/Latin grand naming patterns: epic suffixes (-eus, -icles, -us, -ius, -ia). Examples: Achilles, Themistocles, Aurelius, Valerius, Livia, Octavia.\n"
          } else if (cultLower.includes("arabic")) {
            subtypeGuidance += "Use Arabic Semitic naming patterns: tri-consonantal roots, lineage markers (ibn, bin, bint, abu). Examples: Tariq, Layla, Yusuf, Fatima, Ibn Sina.\n"
          } else if (cultLower.includes("persian")) {
            subtypeGuidance += "Use Persian grand naming patterns: royal suffixes, melodious Persian roots (e.g. Cyrus, Darius, Rostam, Shireen, Roxana).\n"
          } else if (cultLower.includes("mesopotamian")) {
            subtypeGuidance += "Use Sumerian/Babylonian cuneiform naming patterns: grand antiquity feel (e.g. Gilgamesh, Enkidu, Ishtar, Enlil, Sargon).\n"
          } else if (cultLower.includes("aztec")) {
            subtypeGuidance += "Use Nahuatl/Aztec naming patterns: unique consonant clusters (tl, tz, x, z) referencing nature, sun, or jade. Examples: Tenoch, Xochitl, Cuauhtemoc, Metzli.\n"
          } else if (cultLower.includes("mayan")) {
            subtypeGuidance += "Use Mayan naming patterns: short, sharp glyph-based sounds referencing jaguars, skies, or jade (e.g. Balam, K'inich, Yaxun, Ixchel).\n"
          } else if (cultLower.includes("maori") || cultLower.includes("polynesian")) {
            subtypeGuidance += "Use Polynesian/Maori patterns: melodious open vowels, soft consonants, references to ocean, wind, or volcanic mana (e.g. Keanu, Moana, Tane, Aroha).\n"
          } else if (cultLower.includes("high elf")) {
            subtypeGuidance += "Use High Elf naming patterns: lyrical, flowing vowels, soft sibilants, melodic tone (l, s, m, r, th, f). Avoid harsh gutturals. Examples: Legolas, Galadriel, Celeborn, Elrond, Aerith.\n"
          } else if (cultLower.includes("wood elf")) {
            subtypeGuidance += "Use Wood Elf naming patterns: sylvan, nature-connected sounds, forest syllables, earthy tones (e.g. Oak, Thorn, Leaf, Willow roots integrated). Examples: Tauriel, Thranduil, Sylas, Lyra.\n"
          } else if (cultLower.includes("dark elf") || cultLower.includes("drow")) {
            subtypeGuidance += "Use Dark Elf (Drow) naming patterns: sharp, sibilant, dangerous sounds (z, sh, v, x, th, ', ss). Examples: Drizzt, Jarlaxle, Lolth, Viconia, Zaknafein.\n"
          } else if (cultLower.includes("mountain dwarf") || cultLower.includes("dwarven")) {
            subtypeGuidance += "Use Dwarven naming patterns: grounded, rugged, harsh consonants (g, k, th, r, d, b, z). Avoid soft vowels. Examples: Gimli, Thorin, Balin, Dwalin, Gloin.\n"
          } else if (cultLower.includes("dark dwarf") || cultLower.includes("duergar")) {
            subtypeGuidance += "Use Dark Dwarf/Duergar naming patterns: heavy, dark, obsidian-feeling, underground syllables with guttural undertones. Examples: Horgar, Murgrim, Thulgrun.\n"
          } else if (cultLower.includes("feral orc")) {
            subtypeGuidance += "Use Feral Orc naming patterns: guttural, harsh, monosyllabic warrior names, hard explosive consonants (g, z, k, r, kh). Examples: Grommash, Garrosh, Gul'dan, Thrall.\n"
          } else if (cultLower.includes("noble orc")) {
            subtypeGuidance += "Use Noble Orc naming patterns: grand, honor-bound, slightly longer clan warrior names. Examples: Durotan, Orgrim, Saurfang.\n"
          } else if (cultLower.includes("goblin")) {
            subtypeGuidance += "Use Goblin/Kobold naming patterns: short, sharp, clicky, trickster syllables with hard endings. Examples: Gax, Squeek, Krenko, Tink.\n"
          } else if (cultLower.includes("halfling")) {
            subtypeGuidance += "Use Halfling/Hobbit naming patterns: cozy, warm, rustic English countryside names. Examples: Bilbo, Frodo, Samwise, Pippin, Merry.\n"
          } else if (cultLower.includes("dragonborn") || cultLower.includes("draconic")) {
            subtypeGuidance += "Use Dragonborn/Draconic naming patterns: hissing, sibilant, powerful draconic sounds (j, sh, k, ss, r, v, z). Examples: Torinn, Balasar, Daardendrian.\n"
          } else if (cultLower.includes("tiefling")) {
            subtypeGuidance += "Use Tiefling/Fiendish naming patterns: chthonic, exotic, sharp consonants, or abstract virtue names (e.g. Hope, Glory, Sorrow). Examples: Mephistopheles, Lilith, Zariel.\n"
          } else if (cultLower.includes("aasimar")) {
            subtypeGuidance += "Use Aasimar/Celestial naming patterns: resonant, grand, angelic, vowel-rich divine names. Examples: Gabriel, Seraphina, Uriel, Aurelia.\n"
          } else if (cultLower.includes("giant")) {
            subtypeGuidance += "Use Giant/Jotunn naming patterns: grave, thunderous, massive monosyllabic or simple naming style. Examples: Ymir, Thrym, Skadi, Surtur.\n"
          } else if (cultLower.includes("beastkin")) {
            subtypeGuidance += "Use Beast-kin naming patterns: animistic, soft Japanese-like or animalistic syllables (e.g. kitsune, neko, inuka). Examples: Ran, Koko, Ren, Haru.\n"
          }
        } else if (sub === "alien") {
          const style = nameGeneratorConfig?.alienStyle || "cosmic"
          const naming = nameGeneratorConfig?.alienNamingStyle || "harsh"
          subtypeGuidance += `Generate Alien names of style "${style}" (e.g., Insectoid clicks, mechanical whirs, aquatic bubbles, or eldritch monstrosities) with a naming style of "${naming}" (e.g., Harsh/Zhythos, elegant, scientific, unpronounceable with apostrophes like Xal'Thor, Veyrakk). Examples: Xal'Thor, Veyrakk, Zhythos.\n`
        } else if (sub.includes("beast") || sub.includes("shou") || sub === "insectoid") {
          const family = nameGeneratorConfig?.beastFamily || "wolf"
          const tier = nameGeneratorConfig?.beastTier || "primordial"
          subtypeGuidance += `Generate Beast names of family "${family}" and tier "${tier}" (e.g., common, elite, emperor, divine, primordial) in formats like "Voidfang Wolf", "Celestial Frost Lion", "Primordial Chaos Dragon". Examples: Voidfang Wolf, Celestial Frost Lion, Primordial Chaos Dragon.\n`
        } else {
          subtypeGuidance += `Generate names suitable for character type: ${nameSubType || "Spirit/Demon/Undead/Dragon/Divine/Hybrid"}.\n`
        }
      } else if (cat === "bloodline") {
        const bloodlineCat = nameGeneratorConfig?.bloodlineCategory || "Elemental: Flame"
        const bloodlineRank = nameGeneratorConfig?.bloodlineRank || "Ancient"
        subtypeGuidance += `Category is BLOODLINE. Generate bloodlines/lineages of Category "${bloodlineCat}" (e.g., Flame, Ice, Dragon, Titan, Void, Star, Chaos) and Rank "${bloodlineRank}" (e.g., Mortal, Rare, Ancient, Mythical, Primordial). Examples: Primordial Chaos Dragon Bloodline, Eternal Frost Phoenix Bloodline, Void Leviathan Bloodline.\n`
      } else if (cat === "title") {
        const titleCat = nameGeneratorConfig?.titleCategory || "Hero"
        const titleStyle = nameGeneratorConfig?.titleStyle || "Cosmic"
        subtypeGuidance += `Category is TITLE. Generate grand fantasy novel titles of class "${titleCat}" (e.g., Hero, Villain, Cultivator, God, Assassin) and style "${titleStyle}" (e.g., Fearsome, Noble, Ancient, Cosmic). Examples: The Void Emperor, Frost Sovereign, Dragon of Endless Night, Star Devourer.\n`
      } else if (["city", "planet", "realm", "galaxy", "universe"].includes(cat)) {
        if (cat === "city") {
          const cityType = nameGeneratorConfig?.cityType || "Human"
          const cityTheme = nameGeneratorConfig?.cityTheme || "Desert"
          subtypeGuidance += `Category is CITY. Generate city/settlement names of type "${cityType}" and theme "${cityTheme}" (e.g. desert, forest, floating, underground, void). Examples: Astravale, Frosthaven, Blackspire, Verdantis.\n`
        } else if (cat === "planet") {
          const planetTheme = nameGeneratorConfig?.planetTheme || "Fire"
          const planetCiv = nameGeneratorConfig?.planetCiv || "Futuristic"
          subtypeGuidance += `Category is PLANET. Generate planet names of theme "${planetTheme}" and civilization level "${planetCiv}" (e.g. primitive, magical, futuristic, divine). Examples: Planet Sonox, Planet Vorthis, Planet Drakoria, Planet Nythara.\n`
        } else if (cat === "realm") {
          const realmType = nameGeneratorConfig?.realmType || "Immortal"
          subtypeGuidance += `Category is REALM. Generate mystical plane/realm names of type "${realmType}" (e.g., Mortal, Immortal, Divine, Demon, Beast, Void, Chaos). Examples: Eternal Frost Realm, Abyssal Demon Realm, Primordial Beast Realm.\n`
        } else if (cat === "galaxy") {
          const galaxyTheme = nameGeneratorConfig?.galaxyTheme || "Light"
          subtypeGuidance += `Category is GALAXY. Generate galaxy names of theme/style "${galaxyTheme}" (e.g. light, darkness, chaos, order, elemental). Examples: Celestial Veil Galaxy, Crimson Void Galaxy, Astral Dragon Galaxy.\n`
        } else if (cat === "universe") {
          const universeType = nameGeneratorConfig?.universeType || "Magical"
          const universeScale = nameGeneratorConfig?.universeScale || "Infinite"
          subtypeGuidance += `Category is UNIVERSE. Generate universe names of type "${universeType}" and scale "${universeScale}" (e.g., magical, cultivation, apocalypse, primordial). Examples: Universe of Endless Chaos, Eternal Astral Universe, Primordial Genesis Universe.\n`
        }
      } else if (cat === "treasure") {
        subtypeGuidance += 
          "Category is TREASURE. Generate highly creative, fictional, and mythical names for treasures, rare items, mystical flora/fruits, celestial materials, legendary herbs, magical elixirs, or ancient relics based on the provided description/context.\n" +
          "Guidelines for Treasures:\n" +
          "1. For fruits, flora, or spiritual herbs, create evocative botanical and mystical names (e.g., 'Dual-Polarity Spirit Peach', 'Yin-Yang Starfruit', 'Nine-Leaf Sanguine Lotus').\n" +
          "2. For space rings, storage bags, or spatial tools, create grand, textured names (e.g., 'Empyrean Spatial Ring', 'Void-Folding Cache', 'Nebula Storage Sack').\n" +
          "3. For minerals, metals, or physical items, create cosmic-sounding names (e.g., 'Star-Core Obsidian', 'Ethereal Cobalt', 'Chaos-Tempered Iron').\n" +
          "4. Match the naming conventions of high-quality fantasy, xianxia, wuxia, and sci-fi fiction. Create beautiful, evocative, and textured names that suggest ancient power, rarity, or magical properties.\n"
      }

      const allStyles = [
        "Wild Fantasy", "Chinese-inspired", "Japanese-inspired", "Korean-inspired",
        "Elven", "Demonic", "Beast / Monster", "Cultivation Sect", "Noble House",
        "Divine / Celestial", "Grimdark", "Fully Invented", "Viking / Norse",
        "Slavic", "Celtic", "Egyptian", "Mesoamerican", "Arabian / Persian",
        "Indian / Hindi", "Greco-Roman", "Steampunk", "Cyberpunk",
        "Celestial Body", "Elemental", "Fey / Faerie", "Undead / Lich",
        "Dwarven", "Void / Abyss", "African", "Polynesian / Oceanic",
        "Mongolian / Steppe", "Tibetan / Himalayan", "Roman / Latin",
        "Lovecraftian / Cosmic Horror", "Gothic / Dark Romantic",
        "Pirate / Swashbuckler", "Western / Frontier", "Post-Apocalyptic",
        "Bio-Punk / Genetic", "Clockwork / Automaton", "Tropical / Island",
        "Arctic / Frozen", "Desert / Sand", "Forest / Woodland",
        "Swamp / Bog", "Angelic / Seraphic"
      ]

      const isSpecificCulture = cat === "character" && sub === "humanoid" && culture && culture !== "Fantasy Mixed" && culture !== "any"
      const diversityMandate = isSpecificCulture
        ? "- Within the requested culture/origin/race, ensure the names are varied in their starting letters, syllable counts, vowel placement, and meaning so they do not sound too similar, but they MUST all sound authentic and compatible with the selected culture/origin/race.\n" +
          "- Do NOT mix in other unrelated cultures, styles, or languages. All names must fit the selected tradition.\n"
        : "- In this single batch of exactly ${requestedCount} names, make every name feel like it belongs to a completely different naming tradition, culture, or invented language. They must sound stylistically incompatible with each other.\n" +
          "- Dramatically vary: syllable count (short vs long), consonant density, vowel openness, rhythm, starting/ending sounds, use of compounds vs single words, harshness vs softness.\n" +
          "- Do NOT reuse any phonetic motif, prefix family, or structural pattern within the batch. Force yourself to use very different sound palettes for each name.\n" +
          "- Strongly resist defaulting to common fantasy phonemes. Only use them if the requested style specifically demands it.\n" +
          "- Goal: the ${requestedCount} names should feel like they could come from  ${requestedCount} entirely separate fictional worlds or real-world linguistic families.\n"

      systemInstruction =
        "You are an expert fantasy novel naming specialist specializing in highly original, versatile names.\n" +
        `Available styles: ${allStyles.join(", ")}.\n` +
        "DIVERSITY MANDATE:\n" +
        `${diversityMandate}\n` +
        "You MUST avoid names already present in the Story Bible. Avoid exact matches, spelling variants, same-sounding variants, and obvious derivatives of existing names.\n" +
        `Generate exactly ${requestedCount} highly distinct, versatile options.\n` +
        "Respect the requested name structure: single, double, triple, title-style, clan-style, or any.\n" +
        `${subtypeGuidance ? subtypeGuidance + "\n" : ""}` +
        `${mashupLine ? mashupLine + "\n" : ""}` +
        `${genderLine ? genderLine + "\n" : ""}` +
        `${syllableLine ? syllableLine + "\n" : ""}` +
        "Output ONLY valid JSON as an array of objects. Each item must include name, category, style, raceOrOrigin, structure, meaning, pronunciation, vibe, and bibleContent."

      const existingNames = bibleEntries
        .slice(0, 300)
        .map((entry: any) => `- ${entry.name || "Unknown"} (${entry.category || "character"}): ${String(entry.content || "").slice(0, 180)}`)
        .join("\n")

      const userPromptDiversity = isSpecificCulture
        ? `DIVERSITY REQUIREMENT: The ${requestedCount} names MUST all belong to the selected culture/origin/race, but be distinct in sound and structure from each other within that naming style.`
        : `DIVERSITY REQUIREMENT: The ${requestedCount} names MUST be radically different from each other in sound, length, and style. Force extreme variety.`

      userPrompt =
        `Requested Style: ${nameStyle || "wild fantasy mix"}\n` +
        `${mashupLine ? `Secondary Style Mashup: ${nameStyle2}\n` : ""}` +
        `Requested Category: ${nameCategory || "character"}\n` +
        `${nameSubType ? `Requested Sub-type: ${nameSubType}\n` : ""}` +
        `Requested Structure: ${nameStructure || "any"}\n` +
        `Requested Tone: ${nameTone || "memorable fantasy"}\n` +
        `${nameGender && nameGender !== "any" ? `Gender: ${nameGender}\n` : ""}` +
        `${nameSyllableBank ? `Preferred Syllables: ${nameSyllableBank}\n` : ""}` +
        `Number of names to generate: ${requestedCount}\n` +
        `Extra Direction: ${customPrompt || "Surprise me with useful fantasy novel names."}\n\n` +
        `Existing Story Bible Names To Avoid:\n${existingNames || "No Story Bible names yet."}\n\n` +
        `Active Chapter Context (${chapterTitle || "Untitled"}):\n${String(chapterContent || "").slice(0, 6000)}\n\n` +
        `${userPromptDiversity}`
    } else if (action === "timeline_consistency_check") {
      const { chapters, profiles, bibleEntries } = body as {
        chapters: { id: string; title: string; chapterNumber: number; charactersAppearing: string[] }[]
        profiles: { name: string; history: { chapterId: string; chapterTitle: string; chapterNumber: number | null; levelBefore: number; levelAfter: number; realmBefore: string; realmAfter: string; stageBefore: string; stageAfter: string; summary: string; statChanges: Record<string, number> }[] }[]
        bibleEntries: { name: string; category: string; content: string }[]
      }

      systemInstruction =
        "You are a senior novel editor and continuity specialist. Your job is to analyze the entire manuscript timeline for plot holes and character consistency issues.\n" +
        "You are given:\n" +
        "1. The list of all chapters (in order) with which characters appear in each.\n" +
        "2. For each character with a progression profile: their full history of stat/level/realm/stage changes per chapter.\n" +
        "3. Story Bible entries for reference.\n\n" +
        "Analyze for these types of issues:\n" +
        "- **Power regression**: A character's realm, stage, or level drops between chapters without explanation in the history summary.\n" +
        "- **Missing progression**: A character appears in a chapter but has no progression history entry for it (gap in tracking).\n" +
        "- **Contradictory states**: Two chapters claim different realms/stages for the same character at overlapping times.\n" +
        "- **Premature appearance**: A character appears in a chapter before their first recorded progression entry or Bible introduction.\n" +
        "- **Ignored plot points**: A character's history summary mentions an injury, loss, or change that is not reflected in later chapters where they appear.\n\n" +
        "Only flag genuine issues. A character simply not appearing in a chapter is not a problem. A character staying at the same realm across multiple chapters is normal.\n" +
        "Output ONLY valid JSON with a single key 'issues' containing an array of objects. Each object must have:\n" +
        "- type: 'power_regression' | 'missing_progression' | 'contradictory_state' | 'premature_appearance' | 'ignored_plot_point'\n" +
        "- characterName: string\n" +
        "- severity: 'warning' | 'critical'\n" +
        "- message: string (concise explanation of the issue)\n" +
        "- chaptersInvolved: string[] (chapter titles or numbers)\n" +
        "- suggestion: string (how to fix)\n" +
        "If no issues are found, return { issues: [] }."

      const chapterList = (chapters || []).map(ch =>
        `Chapter ${ch.chapterNumber}: "${ch.title}" — Characters: ${(ch.charactersAppearing || []).join(", ") || "none"}`
      ).join("\n")

      const profileDetails = (profiles || []).map(p => {
        const timeline = (p.history || [])
          .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
          .map(h =>
            `  Ch${h.chapterNumber || "?"} (${h.chapterTitle}): Level ${h.levelBefore}→${h.levelAfter}, Realm "${h.realmBefore || "?"}"→"${h.realmAfter || "?"}", Stage "${h.stageBefore || "?"}"→"${h.stageAfter || "?"}" — ${h.summary}`
          ).join("\n")
        return `${p.name}:\n${timeline || "  No progression history recorded."}`
      }).join("\n\n")

      const bibleContext = (bibleEntries || []).map(e =>
        `${e.name} (${e.category}): ${String(e.content || "").slice(0, 800)}`
      ).join("\n")

      userPrompt =
        `## Chapters\n${chapterList}\n\n## Character Progression Timelines\n${profileDetails}\n\n## Story Bible Reference\n${bibleContext}`
    } else if (action === "format_references") {
      const { rawText, currentCategories } = body
      if (!rawText || typeof rawText !== "string") {
        return NextResponse.json({ error: "rawText is required for format_references." }, { status: 400 })
      }

      systemInstruction =
        "You are a world-building reference organizer for a novelist. The user has pasted raw text containing a list of " +
        "cultivation stages, ranks, levels, or other hierarchical reference data (e.g. cultivation realms, swordsmanship ranks, mage tiers, etc.).\n" +
        "Your task is to parse this text and extract each distinct entry, correctly ordering them from weakest/earliest to strongest/latest.\n" +
        "Return ONLY valid JSON with this structure:\n" +
        "{\n" +
        "  \"name\": \"The category name (e.g. Cultivation Stages, Swordsmanship Ranks)\",\n" +
        "  \"description\": \"A brief description of what this hierarchy represents\",\n" +
        "  \"entries\": [\n" +
        "    {\n" +
        "      \"name\": \"Entry name (e.g. Qi Condensation, Sword Apprentice)\",\n" +
        "      \"level\": 1,\n" +
        "      \"parentId\": null,\n" +
        "      \"description\": \"A brief evocative description of this stage/rank\",\n" +
        "      \"tags\": []\n" +
        "    }\n" +
        "  ]\n" +
        "}\n" +
        "Guidelines:\n" +
        "1. Detect whether the entries are flat (numbered 1-10) or hierarchical (e.g. Mortal -> Qi Condensation -> Foundation).\n" +
        "2. For hierarchical data, use parentId to link parent-child relationships. The parent entry comes first in the array.\n" +
        "3. Assign numeric level values based on the order/position in the hierarchy (1 = weakest/earliest).\n" +
        "4. Write a brief 1-2 sentence evocative description for each entry.\n" +
        "5. Infer the category name from the content. If the user pasted cultivation stages, name it 'Cultivation Stages'.\n" +
        "6. Preserve any existing entries from currentCategories when they are not present in the new raw text." +
        "7. If the raw text contains tags like [Mortal], [Qi Condensation] or similar bracketed labels, treat those as the name and use surrounding text as description."

      const currentData = Array.isArray(currentCategories) ? currentCategories.slice(0, 5) : []
      userPrompt =
        `Parse and format the following raw reference text into structured reference entries:\n\n` +
        `Raw text:\n${rawText.slice(0, 12000)}` +
        (currentData.length > 0 ? `\n\nExisting categories for reference:\n${JSON.stringify(currentData).slice(0, 2000)}` : "")
    } else {
      return NextResponse.json({ error: "Invalid action. Must be continue, rewrite, outline, generate_lore, appearance_prompts, progression_update, cultivation_realm_import, brain_analyze, brain_ask, brain_consistency_check, brain_suggest_additions, brain_generate_dossier, bible_consistency_check, bible_extract_from_chapter, arc_seed_extract, name_generate, progression_template_design, timeline_consistency_check, format_references, or brain_scan_updates." }, { status: 400 })
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
      "bible_extract_from_chapter",
      "arc_seed_extract",
      "name_generate",
      "timeline_consistency_check",
      "format_references",
      "brain_scan_updates"
    ])
    let text = ""
    if (action === "cultivation_realm_import" && !process.env.GROQ_API_KEY) {
      text = JSON.stringify({ settings: parseCultivationSettingsFromText(body.rawText, body.currentSettings).settings })
    } else {
      // appearance_prompts and name_generate need creative temperature — higher than standard JSON extraction
      const appearanceTemp = action === "appearance_prompts" ? 0.60 : undefined
      const nameTemp = action === "name_generate" ? 0.92 : undefined
      const creativeTemp = appearanceTemp ?? nameTemp

      // Use Gemini hand-in-hand with Groq:
      // - Prefer Gemini for progression_update (superior long-context reasoning and multi-character disambiguation)
      // - Groq for speed on other creative/structured tasks
      const useGemini = (action === "progression_update" || action === "brain_analyze") && !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (useGemini) {
        try {
          text = await generateWithGemini(systemInstruction, userPrompt, jsonActions.has(action), creativeTemp ?? 0.3)
        } catch (geminiErr) {
          console.warn("[Gemini] Failed, falling back to Groq:", geminiErr)
          try {
            text = await generateWithGroq(systemInstruction, userPrompt, jsonActions.has(action), creativeTemp)
          } catch (groqErr) {
            console.error("Both Gemini and Groq failed:", groqErr)
            throw groqErr;
          }
        }
      } else {
        try {
          text = await generateWithGroq(systemInstruction, userPrompt, jsonActions.has(action), creativeTemp)
        } catch (groqErr) {
          console.warn("[Groq] Failed, trying fallback to Gemini:", groqErr)
          if (geminiApiKey) {
            try {
              text = await generateWithGemini(systemInstruction, userPrompt, jsonActions.has(action), creativeTemp ?? 0.3)
            } catch (geminiErr) {
              console.error("Both Groq and Gemini failed:", geminiErr)
              throw geminiErr
            }
          } else {
            throw groqErr
          }
        }
      }
    }

    if (action === "brain_consistency_check") {
      const result = parseJsonObject<any>(text)
      return NextResponse.json({
        conflicts: result?.conflicts || []
      })
    }

    if (action === "timeline_consistency_check") {
      const result = parseJsonObject<any>(text)
      return NextResponse.json({
        issues: result?.issues || []
      })
    }

    if (action === "brain_suggest_additions") {
      const result = parseJsonObject<any>(text)
      const allowedTypes = new Set(["character", "place", "object", "concept", "event", "foreshadowing"])
      const allowedImportance = new Set(["minor", "major", "critical"])
      const suggestions = Array.isArray(result?.suggestions)
        ? result.suggestions.map((suggestion: any) => {
            const entityType = allowedTypes.has(suggestion?.entityType) ? suggestion.entityType : "concept"
            const importance = allowedImportance.has(suggestion?.importance) ? suggestion.importance : "minor"
            const chapterNumber = Number.isFinite(Number(suggestion?.chapterNumber)) ? Number(suggestion.chapterNumber) : null
            const mentionCount = Number.isFinite(Number(suggestion?.mentionCount)) ? Math.max(1, Number(suggestion.mentionCount)) : undefined
            return {
              entityName: String(suggestion?.entityName || "").trim(),
              entityType,
              importance,
              aiSummary: String(suggestion?.aiSummary || "").trim(),
              chapterId: suggestion?.chapterId ? String(suggestion.chapterId) : undefined,
              chapterTitle: suggestion?.chapterTitle ? String(suggestion.chapterTitle).slice(0, 160) : undefined,
              chapterNumber,
              evidence: suggestion?.evidence ? String(suggestion.evidence).slice(0, 400) : undefined,
              mentionCount
            }
          }).filter((suggestion: any) => suggestion.entityName && suggestion.aiSummary).slice(0, 10)
        : []
      return NextResponse.json({
        suggestions
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

    if (action === "brain_scan_updates") {
      const result = parseJsonObject<any>(text)
      const updates = Array.isArray(result?.updates)
        ? result.updates.map((up: any) => ({
            entityName: String(up?.entityName || "").trim(),
            updatedSummary: String(up?.updatedSummary || "").trim(),
            evidence: up?.evidence ? String(up.evidence).trim() : "",
            importance: ["minor", "major", "critical"].includes(String(up?.importance)) ? up.importance : "minor"
          })).filter((up: any) => up.entityName && up.updatedSummary)
        : []
      return NextResponse.json({
        updates
      })
    }

    if (action === "appearance_prompts") {
      const appearance = parseJsonObject<AppearancePromptResult>(text)
      if (!appearance) {
        return NextResponse.json({
          appearancePrompts: {
            characterName: "",
            overview: "",
            prompts: {},
            consistencyNotes: [],
            negativePrompt: "",
            negativePrompts: {}
          }
        })
      }

      const extractString = (val: unknown, fallbackKey: string): string => {
        if (typeof val === "string") return val.trim()
        if (val && typeof val === "object") {
          const nested = (val as Record<string, unknown>)[fallbackKey] ?? (val as Record<string, unknown>)[Object.keys(val as Record<string, unknown>)[0]]
          if (typeof nested === "string") return nested.trim()
          return ""
        }
        return ""
      }
      const responseLoreEntry = body?.loreEntry && typeof body.loreEntry === "object"
        ? body.loreEntry as { category?: string; name?: string }
        : null
      const responseEntryCategory = typeof responseLoreEntry?.category === "string" ? responseLoreEntry.category : ""
      const characterName = String(body?.name || responseLoreEntry?.name || "").trim()
      const race = typeof body?.race === "string" ? body.race.trim() : ""
      const responseFormLabels = body?.formLabels && typeof body.formLabels === "object"
        ? body.formLabels as Record<string, string>
        : {}
      const prompts: Record<string, string> = {}
      const negativePrompts: Record<string, string> = {}
      if (appearance.prompts && typeof appearance.prompts === "object") {
        const promptKeys = Object.keys(appearance.prompts)
        const responseIsCharacterLike = responseEntryCategory === "beast" ||
          responseEntryCategory === "character" ||
          promptKeys.some(key => /\b(beast|demi|human|humanoid|form)\b/i.test(key.replace(/([A-Z])/g, " $1")))

        for (const key of promptKeys) {
          const text = extractString(appearance.prompts[key], key)
          if (text) {
            const fallbackLabel = key === "humanForm" ? "Humanoid Form" : key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
            const label = responseFormLabels[key] || fallbackLabel
            const expandedPrompt = expandShortAppearancePrompt(text, key)
            prompts[key] = responseIsCharacterLike
              ? ensureDistinctCharacterAppearancePrompt(expandedPrompt, key, label, Object.keys(prompts).length, promptKeys.length, responseEntryCategory, characterName, race)
              : expandedPrompt
          }
        }
      }
      if (appearance.negativePrompts && typeof appearance.negativePrompts === "object") {
        for (const key of Object.keys(appearance.negativePrompts)) {
          const text = extractString(appearance.negativePrompts[key], key)
          if (text) negativePrompts[key] = text
        }
      }

      const extractCharDetail = (val: unknown): string =>
        typeof val === "string" ? val.trim() : ""

      const rawDetails = appearance.characterDetails
      const characterDetails = rawDetails && typeof rawDetails === "object"
        ? {
            appearance: extractCharDetail((rawDetails as Record<string, unknown>).appearance),
            hair: extractCharDetail((rawDetails as Record<string, unknown>).hair),
            eyes: extractCharDetail((rawDetails as Record<string, unknown>).eyes),
            body: extractCharDetail((rawDetails as Record<string, unknown>).body),
            height: extractCharDetail((rawDetails as Record<string, unknown>).height),
            age: extractCharDetail((rawDetails as Record<string, unknown>).age),
            attire: extractCharDetail((rawDetails as Record<string, unknown>).attire),
            distinguishingFeatures: extractCharDetail((rawDetails as Record<string, unknown>).distinguishingFeatures),
            weapon: extractCharDetail((rawDetails as Record<string, unknown>).weapon || (rawDetails as Record<string, unknown>).heldItem)
          }
        : undefined

      return NextResponse.json({
        appearancePrompts: {
          characterName: typeof appearance.characterName === "string" ? appearance.characterName : "",
          overview: typeof appearance.overview === "string" ? appearance.overview : "",
          prompts,
          consistencyNotes: Array.isArray(appearance.consistencyNotes)
            ? appearance.consistencyNotes.filter(item => typeof item === "string").slice(0, 6)
            : [],
          negativePrompt: typeof appearance.negativePrompt === "string" ? appearance.negativePrompt : "",
          negativePrompts,
          characterDetails: characterDetails && Object.values(characterDetails).some(Boolean) ? characterDetails : undefined,
          inferredCategory: typeof appearance.inferredCategory === "string" ? appearance.inferredCategory : undefined,
          inferredName: typeof appearance.inferredName === "string" ? appearance.inferredName : undefined,
          formLabels: appearance.formLabels && typeof appearance.formLabels === "object" ? appearance.formLabels : undefined
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

    if (action === "format_references") {
      const parsed = parseJsonObject<Record<string, unknown>>(text)
      if (!parsed) {
        return NextResponse.json({ error: "AI returned unparseable JSON. Please try again with different input." }, { status: 500 })
      }
      return NextResponse.json({ text: parsed })
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
      const sanitizeCharacterDetails = (details?: BibleExtractCharacterDetails) => {
        if (!details || typeof details !== "object") return undefined
        const chapterAppearance = details.chapterAppearance && typeof details.chapterAppearance === "object"
          ? {
            summary: String(details.chapterAppearance.summary || "").trim(),
            evidence: String(details.chapterAppearance.evidence || "").trim(),
            appearance: String(details.chapterAppearance.appearance || "").trim(),
            attire: String(details.chapterAppearance.attire || "").trim(),
            hair: String(details.chapterAppearance.hair || "").trim(),
            eyes: String(details.chapterAppearance.eyes || "").trim(),
            body: String(details.chapterAppearance.body || "").trim(),
            height: String(details.chapterAppearance.height || "").trim(),
            age: String(details.chapterAppearance.age || "").trim(),
            distinguishingFeatures: String(details.chapterAppearance.distinguishingFeatures || "").trim(),
            weapon: String(details.chapterAppearance.weapon || "").trim()
          }
          : undefined
        const sanitized = {
          appearance: String(details.appearance || "").trim(),
          attire: String(details.attire || "").trim(),
          hair: String(details.hair || "").trim(),
          eyes: String(details.eyes || "").trim(),
          body: String(details.body || "").trim(),
          height: String(details.height || "").trim(),
          age: String(details.age || "").trim(),
          distinguishingFeatures: String(details.distinguishingFeatures || "").trim(),
          weapon: String(details.weapon || "").trim(),
          chapterAppearance
        }
        const hasTopLevel = [
          sanitized.appearance,
          sanitized.attire,
          sanitized.hair,
          sanitized.eyes,
          sanitized.body,
          sanitized.height,
          sanitized.age,
          sanitized.distinguishingFeatures,
          sanitized.weapon
        ].some(Boolean)
        const hasChapter = chapterAppearance ? Object.values(chapterAppearance).some(Boolean) : false
        return hasTopLevel || hasChapter ? sanitized : undefined
      }

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
            chapterId: suggestion.chapterId ? String(suggestion.chapterId).trim() : undefined,
            chapterTitle: suggestion.chapterTitle ? String(suggestion.chapterTitle).trim().slice(0, 160) : undefined,
            chapterNumber: Number.isFinite(Number(suggestion.chapterNumber)) ? Number(suggestion.chapterNumber) : null,
            mentionCount: Number.isFinite(Number(suggestion.mentionCount)) ? Math.max(1, Number(suggestion.mentionCount)) : undefined,
            characterDetails: sanitizeCharacterDetails(suggestion.characterDetails),
            timelineFact: {
              summary: String(suggestion.timelineFact?.summary || suggestion.summary || "").trim(),
              evidence: String(suggestion.timelineFact?.evidence || "").trim(),
              status: String(suggestion.timelineFact?.status || "").trim()
            }
          })).filter(suggestion => suggestion.entryName && suggestion.summary)
          : []
      })
    }

    if (action === "arc_seed_extract") {
      const result = parseJsonObject<ArcSeedExtractResponse>(text)
      const seed = result?.seed
      if (!seed) {
        return NextResponse.json({
          seed: {
            title: "Future thread",
            summary: text.slice(0, 800),
            whyItMatters: "",
            futurePayoff: "",
            evidence: "",
            relatedCharacters: [],
            relatedEntities: []
          }
        })
      }

      return NextResponse.json({
        seed: {
          title: String(seed.title || "Future thread").trim(),
          summary: String(seed.summary || "").trim(),
          whyItMatters: String(seed.whyItMatters || "").trim(),
          futurePayoff: String(seed.futurePayoff || "").trim(),
          evidence: String(seed.evidence || "").trim(),
          relatedCharacters: Array.isArray(seed.relatedCharacters)
            ? seed.relatedCharacters.map(item => String(item).trim()).filter(Boolean).slice(0, 8)
            : [],
          relatedEntities: Array.isArray(seed.relatedEntities)
            ? seed.relatedEntities.map(item => String(item).trim()).filter(Boolean).slice(0, 10)
            : []
        }
      })
    }

    if (action === "name_generate") {
      const result = parseJsonValue<NameGenerateResponse | unknown[]>(text)
      const allowedCategories = new Set(["character", "beast", "world", "place", "item", "cosmic", "bloodline", "faction", "artifact", "treasure"])
      const rawNames: unknown[] = Array.isArray(result)
        ? result
        : Array.isArray((result as any)?.names)
          ? (result as any).names
          : Array.isArray((result as any)?.options)
            ? (result as any).options
            : Array.isArray((result as any)?.suggestions)
              ? (result as any).suggestions
              : []
      const requestedCount = typeof body?.count === "number" && body.count > 0 && body.count <= 20 ? body.count : 5
      const fallbackCat = String(body?.nameCategory || "character")
      const sanitizedNames = rawNames
        .map((option: unknown) => {
          const record = typeof option === "string" ? { name: option } : (option || {}) as Record<string, unknown>
          const category = allowedCategories.has(String(record.category)) ? String(record.category) : fallbackCat
          const meaning = String(record.meaning || record.description || record.reason || "").trim()
          const vibe = String(record.vibe || record.tone || record.feel || "").trim()
          return {
            name: String(record.name || record.fullName || record.title || "").trim(),
            category,
            style: String(record.style || record.culture || "").trim(),
            raceOrOrigin: String(record.raceOrOrigin || record.origin || record.race || "").trim(),
            structure: String(record.structure || record.nameStructure || "").trim(),
            meaning,
            pronunciation: String(record.pronunciation || record.pronounce || "").trim(),
            vibe,
            bibleContent: String(record.bibleContent || record.content || meaning || vibe || "").trim()
          }
        })
        .filter((option: { name: string }) => option.name)
        .slice(0, requestedCount)

      return NextResponse.json({
        names: sanitizedNames.length > 0 ? sanitizedNames : buildFallbackNameOptions(body)
      })
    }

    return NextResponse.json({ text })
  } catch (error: unknown) {
    console.error("Groq API error:", error)
    const message = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: `AI Generation failed: ${message}` }, { status: 500 })
  }
}
