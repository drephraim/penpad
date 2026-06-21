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
  const attireMatch = loreContent.match(/\b(?:wear(?:s|ing)?|cloth(?:es|ing)|robe|armor|attire|dress(?:es)?|outfit)\b[^.\n]{0,150}/i)
  const bodyMatch = loreContent.match(/\b(?:build|stature|height|tall|muscular|slender|lithe|stocky|frame|figure|physique)\b[^.\n]{0,120}/i)
  const skinMatch = loreContent.match(/\b(?:skin|complexion|scales?|hide|fur color)\b[^.\n]{0,120}/i)
  if (hairMatch) lines.push(`- Hair/Fur: ${hairMatch[0].trim()}`)
  if (eyeMatch) lines.push(`- Eyes: ${eyeMatch[0].trim()}`)
  if (skinMatch) lines.push(`- Skin/Scales: ${skinMatch[0].trim()}`)
  if (bodyMatch) lines.push(`- Build: ${bodyMatch[0].trim()}`)
  if (attireMatch) lines.push(`- Attire: ${attireMatch[0].trim()}`)
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
  addField("Attire", "attire")
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
        item.attire,
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
    ? "For this beast form, keep the anatomy unmistakably non-human: a readable full-body creature silhouette, visible head structure, limbs, spine or tail logic where appropriate, natural hide or scale texture, and a stance that communicates intelligence, danger, and story role."
    : normalizedKey.includes("demi")
      ? "For this demi-human form, show the bridge between creature and person: humanoid posture with preserved signature markings, eyes, aura, textures, and body traits that clearly connect it back to the original non-human design."
      : "For this humanoid form, keep the design grounded in the character's story identity: face, expression, body language, clothing, accessories, aura, and any signature non-human lineage traits should remain visible without turning them into a generic human."

  return `${prompt} Full head-to-toe composition, complete visual design with face, silhouette, skin or surface texture, clothing or natural covering, accessories, posture, atmosphere, and surrounding environment all clearly readable. ${formSpecific} Preserve every explicit trait from the chapter, Story Bible, and user notes while adding coherent secondary details that fit the scene mood, power level, social status, materials, lighting, and background.`
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
      const { name, selectedText, forms, chapter, loreEntry, formLabels, formEnabled, style, regenerateForm } = body
      const safeFormLabels = formLabels && typeof formLabels === "object" ? formLabels as Record<string, string> : {}
      const safeFormEnabled = formEnabled && typeof formEnabled === "object" ? formEnabled as Record<string, boolean> : {}
      const appForms = forms && typeof forms === "object" ? forms as Record<string, string> : {}

      const safeLoreEntry = loreEntry && typeof loreEntry === "object"
        ? loreEntry as { name?: string; category?: string; content?: string; groups?: string[]; aliases?: string[]; characterDetails?: unknown }
        : null
      const chapterContext = chapter && typeof chapter === "object"
        ? chapter as { title?: string; chapterNumber?: number; content?: string; targetEvidence?: string }
        : null
      const entryCategory = safeLoreEntry?.category === "beast"
        ? "beast"
        : safeLoreEntry?.category === "character"
          ? "character"
          : "other"
      const categoryFormKeys = entryCategory === "beast"
        ? ["beastForm", "demiHumanForm", "humanForm"]
        : entryCategory === "character"
          ? ["humanForm"]
          : null
      const enabledFormKeys = Object.keys(safeFormEnabled).filter(k => safeFormEnabled[k] !== false)
      const requestedFormKey = typeof regenerateForm === "string" && regenerateForm.trim() ? regenerateForm.trim() : ""
      const baseFormKeys = categoryFormKeys || (enabledFormKeys.length > 0 ? enabledFormKeys : (Object.keys(appForms).length > 0 ? Object.keys(appForms) : ["beastForm", "demiHumanForm", "humanForm"]))
      const formKeys = requestedFormKey && baseFormKeys.includes(requestedFormKey)
        ? [requestedFormKey]
        : baseFormKeys
      const chapterText = String(chapterContext?.content || "").trim()

      const hasDescription = Boolean(
        chapterText &&
        (selectedText || safeLoreEntry?.name || name)
      )

      if (!hasDescription) {
        return NextResponse.json({ error: "Choose an active chapter with content and a World Bible person or beast before generating appearance prompts." }, { status: 400 })
      }

      const formLabelsStr = formKeys.map(k => {
        const fallbackLabel = k === "humanForm" ? "Humanoid Form" : k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
        const label = safeFormLabels[k] || fallbackLabel
        return `"${k}": "${label}"`
      }).join(", ")
      const requiredFormRule = entryCategory === "beast"
        ? "This Story Bible entry is a BEAST. You must create prompts for Beast Form, Demi-human Form, and Humanoid Form. The demi-human and humanoid versions are visual evolutions of the beast — they must preserve the beast's signature identifying traits (markings, colors, aura, eyes) while introducing an increasingly humanoid silhouette.\n"
        : entryCategory === "character"
          ? "This Story Bible entry is a PERSON/CHARACTER. You must create a humanoid appearance prompt. Do not invent beast or demi-human forms for a person entry unless the chapter explicitly says they transform.\n"
          : "Use only the requested forms, and ground every form in the active chapter.\n"

      // Build per-form negative prompt guidance
      const formNegativeGuidance = formKeys.map(k => {
        const label = safeFormLabels[k] || k
        if (k === "beastForm") return `  - ${label}: exclude human face, smooth skin, humanoid clothing, upright posture, anthropomorphic features`
        if (k === "demiHumanForm") return `  - ${label}: exclude fully animal anatomy, four-legged stance, complete fur coverage obscuring humanoid shape`
        if (k === "humanForm" || k === "humanoidForm") return `  - ${label}: exclude animal features, visible fur/scales/claws/fangs unless they are a signature trait explicitly mentioned in the chapter`
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
      const expandedStyle = expandAppearanceStyle(style || "cinematic fantasy character concept art")

      systemInstruction =
        "You are an expert image-generation prompt engineer specializing in character concept art for novelists.\n" +
        "Your output prompts are fed directly into Stable Diffusion / SDXL or similar image generators, so they must be vivid, concrete, and visually complete enough for an image model to understand the character without extra explanation.\n\n" +
        "PROMPT FORMAT RULES (critical):\n" +
        "- Write each prompt as ONE long descriptive image-generation prompt with 3-5 dense sentences. It must read like a complete visual art direction paragraph, not a checklist and not a short tag dump.\n" +
        "- Order the prompt by visual priority: (1) art style + quality modifiers, (2) subject type + species/race + gender/age only when supported or safely inferable, (3) face + expression, (4) hair/fur/skin/scales color and texture, (5) eyes color and quality, (6) body build + silhouette, (7) clothing/armor/accessories with material and color details, (8) aura/power effects + pose, (9) background + setting, (10) lighting + mood.\n" +
        "- Be specific: prefer 'waist-length silver hair with black streaks' over 'long hair'. Prefer 'glowing amber slitted eyes' over 'interesting eyes'.\n" +
        "- Include the expanded art style and quality tokens at the START of every prompt.\n" +
        "- Each prompt MUST be at least 150 words and should usually be 170-280 words. A prompt under 150 words is invalid. Do not stop after listing key traits; expand them into a full head-to-toe design with scene, posture, materials, lighting, aura, and background.\n\n" +
        "CONTENT & MERGING RULES (critical):\n" +
        "1. PRIORITIZE AND MERGE USER INPUTS: Any details the user explicitly typed in the form description (e.g., hair, eyes, clothing, or style in the 'Forms to generate prompts for' section) must be treated as absolute truth and included. Integrate them perfectly.\n" +
        "2. READ THE ACTIVE CHAPTER FIRST: Before designing, silently scan the Full Active Chapter Context and extract every visual clue written by the author about this character or beast: hair/fur, eyes, skin/scales/hide, attire, armor, ornaments, weapons, body shape, height, posture, expression, scent, aura, power effects, wounds, movement, species, transformation state, and surroundings. These chapter-written details outrank generic fantasy defaults.\n" +
        "3. MERGE CHAPTER EVIDENCE & STORY BIBLE: Use the highlighted passage and Target-Focused Chapter Evidence as the strongest local evidence, but do not ignore the rest of the chapter. Combine those details with Story Bible facts and saved chapter appearance memory. If the chapter says hair color, eye color, attire, beast anatomy, aura, or any distinguishing feature, it MUST appear in the prompt.\n" +
        "4. INFER THE SUBJECT TYPE BEFORE DESIGNING: Decide whether the entry is human, beast, monster, demi-human, divine entity, spirit, demon, artifact-bodied being, or another story-specific type by reading category, name, aliases, groups, chapter behavior, and lore. Do not assume human unless the context supports it.\n" +
        "5. PRESERVE NON-HUMAN & FANTASTICAL TRAITS: Pay close attention to non-human elements, magical mutations, beast traits, or cultivation auras mentioned in the chapter or Story Bible (e.g., wings, horns, scales, claws, pointy ears, tails, glowing markings, fangs, animal ears, celestial auras, serpentine bodies, insectoid limbs, stone hide, shadow bodies, multiple eyes). A humanoid form/silhouette can and should preserve these traits if they are part of the character's design.\n" +
        "6. INTELLIGENT EXTRAPOLATION FROM PARTIAL DETAILS: If the combined details from the user, chapter, and Story Bible are sparse (e.g., only hair and eye color are known), you MUST create a coherent head-to-toe visual concept that suits the character's role, species, power, social status, emotional tone, and scene context. Fill in face, body, skin/fur/scales, clothing or natural covering, accessories, posture, aura, lighting, and background. Mark invented-but-plausible choices in consistencyNotes.\n" +
        "   - Cultivation/Xianxia: flowing Daoist silk robes with gold/silver embroidery, elaborate hairpins/crowns, dynamic hand gestures (sword seals), swirling Qi energy, floating spiritual talismans, and backgrounds like mist-shrouded mountain peaks or ancient temples.\n" +
        "   - Dark Fantasy: weathered leather, heavy plate armor with battle damage, dark hooded cloaks, rugged or scarred features, dramatic chiaroscuro lighting, and gothic, ruined, or stormy environments.\n" +
        "   - LitRPG/Sci-Fi: sleek armor plates, glowing runes or neon accents, holographic displays, athletic build, and high-tech or cybernetic backgrounds.\n" +
        "7. NO HUMAN-BY-DEFAULT ASSUMPTION: If the character belongs to a beast, demon, monster, divine race, spirit race, bloodline, or demi-human lineage, the prompt must visibly reflect that. The concept should feel like the character being portrayed, not a generic attractive human in fantasy clothes.\n" +
        "8. SPECIFY PREMIUM MATERIALS & DYNAMIC LIGHTING: Avoid generic terms. Specify materials (e.g., polished obsidian, white silk brocade, burnished silver), lighting (e.g., ethereal moonlight, dramatic rim lighting, firelight casting long shadows), and active visual effects (e.g., crackling blue lightning, swirling frost particles).\n" +
        "9. If the Known Appearance Facts block is present, treat those as absolute visual constraints — do not invent contradicting details.\n" +
        "10. " + requiredFormRule +
        "11. Every form's negativePrompt must be FORM-SPECIFIC and exclude elements that would break that form's visual logic:\n" +
        formNegativeGuidance + "\n" +
        "   Always also include in every negative: low quality, blurry, watermark, text, cropped, deformed anatomy, extra limbs, bad proportions, duplicate, disfigured.\n\n" +
        "OUTPUT RULES:\n" +
        "12. Output ONLY valid JSON with keys: characterName, overview, prompts, negativePrompts, consistencyNotes, negativePrompt, characterDetails.\n" +
        "   - prompts: object with keys " + formLabelsStr + " — each value is the long descriptive image prompt string.\n" +
        "   - negativePrompts: object with the SAME keys, each value is the form-specific negative prompt string.\n" +
        "   - overview: 3-5 sentence prose summary of the character's overall visual identity and why the inferred design fits the chapter/lore.\n" +
        "   - consistencyNotes: array of up to 5 short strings flagging any visual details that conflicted between sources or were intelligently inferred because the source was sparse.\n" +
        "   - negativePrompt: a single shared negative prompt string as a fallback.\n" +
        "   - characterDetails: object with fields appearance, hair, eyes, body, attire, distinguishingFeatures — descriptive prose phrases extracted from the strongest/primary form.\n" +
        "13. No markdown fences. No bullets inside prompt values. Do not use newline-separated tag lists inside prompt values."

      const chapterLine = chapterContext
        ? `\nActive Chapter: ${chapterContext.chapterNumber ? `Chapter ${chapterContext.chapterNumber} - ` : ""}${chapterContext.title || "Untitled"}`
        : ""
      // Always include chapter context so appearance generation can pick up visual clues beyond the selected mention.
      const chapterContent = chapterText
        ? `\nFull Active Chapter Context (required scan — extract all written visual details for this character/beast before inventing anything):\n${chapterText.slice(0, 14000)}`
        : ""
      const chapterEvidence = chapterContext?.targetEvidence
        ? `\nTarget-Focused Chapter Evidence (highest priority — use this first):\n${chapterContext.targetEvidence}`
        : ""
      const selectedLine = selectedText ? `\nHighlighted Passage (highest priority):\n${selectedText}` : ""
      const loreLine = safeLoreEntry
        ? `\nStory Bible Entry:\nName: ${safeLoreEntry.name || name || "Unknown"}\nType: ${safeLoreEntry.category || "unknown"}\nAliases: ${Array.isArray(safeLoreEntry.aliases) ? safeLoreEntry.aliases.join(", ") : "none"}\nGroups: ${Array.isArray(safeLoreEntry.groups) ? safeLoreEntry.groups.join(", ") : "none"}\nLore Notes:\n${safeLoreEntry.content || ""}`
        : ""

      const formDescriptions = formKeys.map(k => {
        const fallbackLabel = k === "humanForm" ? "Humanoid Form" : k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()
        const label = safeFormLabels[k] || fallbackLabel
        const userProvided = appForms[k]?.trim()
        return `- ${label} (${k}): ${userProvided ? `User-specified traits: "${userProvided}"` : "No specific traits provided by user. Infer a complete visual design from all available context, preserving category and non-human clues."}`
      }).join("\n")

      userPrompt =
        `Character or creature name: ${safeLoreEntry?.name || name || "Unknown / infer from context"}\n` +
        `World Bible category: ${safeLoreEntry?.category || "unknown"}\n` +
        `Art style and quality modifiers to use at the START of every prompt: ${expandedStyle}\n` +
        `${knownDetailsBlock}` +
        `${chapterLine}${chapterContent}${selectedLine}${chapterEvidence}${loreLine}\n\n` +
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
        "3. Read in this order: target-specific evidence first, Story Bible notes second, full chapter third, existing profile last for preservation. Do not stop after the first mention; scan the full chapter for later corrections, reveals, awakenings, status screens, dialogue labels, and narration.\n" +
        "4. The profile schema includes: name, title, additional titles, cultivation realm (profile.realm), cultivation stage/sub-rank (profile.stage), rank (profile.rank), bloodline name, bloodline rank, affinity names/ranks, main class, secondary class or extra classes, weapons, skills, and lore.\n" +
        "5. Put the character's main class/job/role in profile.className only when the text explicitly presents it as a class, job, occupation, system class, or combat role. If the chapter gives a second class, subclass, job, or secondary role, put it in profile.customFields['Secondary Class']; if there are more classes, use distinct custom fields such as profile.customFields['Class 2'], profile.customFields['Class 3'], and matching rank fields when known. Put extra titles beyond profile.title in custom fields such as profile.customFields['Title 2']. Put weapons or equipment in custom fields such as profile.customFields['Weapon'] or profile.customFields['Weapon 2']. Do not put classes, titles, or weapons in abilities or lore unless the chapter explicitly says they are skills/techniques.\n" +
        "6. Put the bloodline name in profile.customFields['Bloodline'] and its rank/grade/tier/quality such as Supreme or Celestial in profile.customFields['Bloodline Rank']. Do not put bloodlines in affinities or skills.\n" +
        "7. Put affinity names in profile.customFields['Affinity Names'] as a comma-separated list, such as Fire, Ice, Void. Put paired affinity ranks in profile.customFields['Affinity Rank'], such as Fire (High), Ice (Celestial), Void (Supreme). Preserve pairings when multiple affinities have different ranks. Do not put affinities in bloodline or class.\n" +
        "8. Put the character's cultivation realm (such as Demigod, God) in profile.realm. Put their cultivation stage/sub-rank (such as Low, Medium, High, Peak) in profile.stage. If the system uses a non-cultivation rank (or if realm is not applicable), put it in profile.rank. Use the Configured Cultivation Realms, Configured Stage Labels, and Uploaded Cultivation Guide when available to match and normalize these values. Any term that appears in the uploaded cultivation ladder is cultivation, not className, unless the chapter explicitly says it is a class/job. Be extremely smart and precise to pick up on even the smallest error or detail in character growth and cultivation advancements.\n" +
        "9. Put skills, techniques, powers, spells, and signature abilities in profile.abilities. Each ability must include name, rank if known, level set to 1 when no number is stated, description, and evidence when available. Do not turn class names, bloodlines, or affinities into skills unless the chapter explicitly calls them skills/techniques.\n" +
        "10. Detect reincarnation and past-life information intelligently. Trigger this when the chapter uses phrases such as incarnation, incarnations, reincarnation, past life, past lives, previous life, former life, life as, in her life as, in his life as, when she was, when he was, she had once been, he had once been, soul memory, former self, previous self, prior existence, or names/titles explicitly framed as an earlier identity. Store this in profile.customFields['Incarnation / Past Lives'] as a concise readable summary. Also fill profile.customFields['Incarnation / Past Lives Identity/Name'] and profile.customFields['Incarnation / Past Lives Era'] when those parts can be inferred. Preserve multiple past lives separated by semicolons. Do not confuse ordinary aliases, disguises, family ancestry, titles, or metaphors with a real past life unless the chapter frames it as a previous incarnation or former life.\n" +
        "11. Extract and return ONLY new, interesting reusable lore details discovered in this chapter in profile.notes (such as reputation, prophecy, rumor, weakness, relationship, hidden identity, origin, temperament, or an unusual detail). Do not return existing/past lore notes. If no new details exist in the chapter, return \"\" (an empty string) in profile.notes.\n" +
        "12. Preserve existing values when the current chapter gives no direct evidence. If the chapter has no meaningful progression or new character detail, keep the profile stable and set update.shouldApply to false. Still summarize that it was reviewed.\n" +
        "13. Never double-count previous profile history. Use the existing profile and processed chapter history as current truth.\n" +
        "14. In update.evidence, include short exact snippets that justify every changed card field, especially class, secondary class, cultivation realm (realm), stage, bloodline, bloodline rank, affinity names, affinity rank, Incarnation / Past Lives, and skills.\n" +
        "15. Output ONLY valid JSON with keys: targetLoreEntryId, targetProfileId, profile, and update. No markdown fences. profile must include name, title, className, rank, realm, stage, abilities, customFields, notes, level, exp, nextLevelExp, stats, traits, nicknames, uniqueTrait, cultivationPath, and optionally customJsonData. customFields must include Bloodline, Bloodline Rank, Affinity Names, Affinity Rank, Secondary Class, Incarnation / Past Lives, Incarnation / Past Lives Identity/Name, Incarnation / Past Lives Era, and any observed extra title/class/weapon fields. update must include shouldApply, summary, levelBefore, levelAfter, realmBefore, realmAfter, stageBefore, stageAfter, statChanges, abilityChanges, rewards, and evidence." +
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
        `- Name\n- Title\n- Cultivation Realm (profile.realm; e.g. Demigod, God; match against the configured cultivation realms list when possible)\n- Cultivation Stage (profile.stage; e.g. Low, Medium, High, Peak; match against the configured stage labels when possible)\n- Rank (profile.rank; e.g. Tier 1, Rank 4)\n- Bloodline (profile.customFields.Bloodline)\n- Bloodline Rank (profile.customFields['Bloodline Rank']; examples: Supreme, Celestial)\n- Affinity Names (profile.customFields['Affinity Names']; comma-separated for multiple affinities)\n- Affinity Rank (profile.customFields['Affinity Rank']; preserve pairings like Fire (High), Void (Supreme))\n- Main Class (profile.className)\n- Secondary Class (profile.customFields['Secondary Class'])\n- Incarnation / Past Lives (profile.customFields['Incarnation / Past Lives']; detect wording like "incarnation", "past life", "past lives", "in her life as", "in his life as", "former life", "previous self")\n- Incarnation Identity/Name (profile.customFields['Incarnation / Past Lives Identity/Name'])\n- Incarnation Era (profile.customFields['Incarnation / Past Lives Era'])\n- Skills (profile.abilities)\n- Lore (profile.notes)\n\n` +
        customJsonPrompt +
        `Extraction Checklist:\n` +
        `1. Identify only the target character.\n` +
        `2. Search target evidence and full chapter for explicit status-like details.\n` +
        `3. Fill exact fields: Bloodline != Affinity != Class != Skills.\n` +
        `4. Search for reincarnation/past-life language and populate the Incarnation / Past Lives card when it appears.\n` +
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
        "For character or beast entries, always capture visual details when the chapter describes them: face, hair color/style, eye color, skin/fur/scales, body shape/build, height, clothing, armor, accessories, scars, aura, posture, or anything that shows how they look in this chapter. Put these in characterDetails with top-level stable fields and a chapterAppearance object with summary and exact evidence.\n" +
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

      if (cat === "character") {
        subtypeGuidance += `Category is CHARACTER (Type: ${nameSubType || "General"}).\n`
        if (sub === "humanoid") {
          const culture = nameGeneratorConfig?.culture || "Fantasy Mixed"
          const gender = nameGeneratorConfig?.gender || "male"
          const struct = nameGeneratorConfig?.structure || "single"
          const opt = nameGeneratorConfig?.additionalOption || "warrior"
          subtypeGuidance += `Generate Humanoid names matching culture/origin "${culture}", gender "${gender}", name structure "${struct}", and sound style "${opt}".\n`
          if (culture.toLowerCase().includes("african")) {
            subtypeGuidance += `African cultural naming roots apply (e.g. Swahili, Yoruba, Zulu, or ancient Egyptian naming sounds depending on sub-culture).\n`
          } else if (culture.toLowerCase().includes("asian")) {
            subtypeGuidance += `Asian naming roots apply (Chinese cultivation pinyin, Japanese kanji sound mappings, Korean Joseon sounds, Thai, Indian/Hindu Sanskrit roots, or Mongolian steppe feel).\n`
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

      systemInstruction =
        "You are a fantasy novel naming specialist. Generate fresh, memorable names that fit the user's requested culture, race, creature type, tone, and name length.\n" +
        `Available styles: ${allStyles.join(", ")}.\n` +
        "You MUST avoid names already present in the Story Bible. Avoid exact matches, spelling variants, same-sounding variants, and obvious derivatives of existing names.\n" +
        `Generate exactly ${requestedCount} distinct, varied options per request.\n` +
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
        `Active Chapter Context (${chapterTitle || "Untitled"}):\n${String(chapterContent || "").slice(0, 6000)}`
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
      return NextResponse.json({ error: "Invalid action. Must be continue, rewrite, outline, generate_lore, appearance_prompts, progression_update, cultivation_realm_import, brain_analyze, brain_ask, brain_consistency_check, brain_suggest_additions, brain_generate_dossier, bible_consistency_check, bible_extract_from_chapter, arc_seed_extract, name_generate, progression_template_design, timeline_consistency_check, or format_references." }, { status: 400 })
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
      "format_references"
    ])
    let text = ""
    if (action === "cultivation_realm_import" && !process.env.GROQ_API_KEY) {
      text = JSON.stringify({ settings: parseCultivationSettingsFromText(body.rawText, body.currentSettings).settings })
    } else {
      // appearance_prompts needs creative temperature — higher than standard JSON extraction
      const appearanceTemp = action === "appearance_prompts" ? 0.60 : undefined
      text = await generateWithGroq(systemInstruction, userPrompt, jsonActions.has(action), appearanceTemp)
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
      const prompts: Record<string, string> = {}
      const negativePrompts: Record<string, string> = {}
      if (appearance.prompts && typeof appearance.prompts === "object") {
        for (const key of Object.keys(appearance.prompts)) {
          const text = extractString(appearance.prompts[key], key)
          if (text) prompts[key] = expandShortAppearancePrompt(text, key)
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
            attire: extractCharDetail((rawDetails as Record<string, unknown>).attire),
            distinguishingFeatures: extractCharDetail((rawDetails as Record<string, unknown>).distinguishingFeatures)
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
          characterDetails: characterDetails && Object.values(characterDetails).some(Boolean) ? characterDetails : undefined
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
            distinguishingFeatures: String(details.chapterAppearance.distinguishingFeatures || "").trim()
          }
          : undefined
        const sanitized = {
          appearance: String(details.appearance || "").trim(),
          attire: String(details.attire || "").trim(),
          hair: String(details.hair || "").trim(),
          eyes: String(details.eyes || "").trim(),
          body: String(details.body || "").trim(),
          distinguishingFeatures: String(details.distinguishingFeatures || "").trim(),
          chapterAppearance
        }
        const hasTopLevel = [sanitized.appearance, sanitized.attire, sanitized.hair, sanitized.eyes, sanitized.body, sanitized.distinguishingFeatures].some(Boolean)
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
      const allowedCategories = new Set(["character", "beast", "world", "place", "item", "cosmic", "bloodline", "faction", "artifact"])
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
