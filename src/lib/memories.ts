export interface Character {
  name: string
  firstMentioned: string
  mentions: number
  description?: string
}

export interface Location {
  name: string
  firstMentioned: string
  mentions: number
  type?: 'city' | 'town' | 'village' | 'planet' | 'world' | 'realm' | 'kingdom' | 'building' | 'dungeon' | 'landmark' | 'other'
}

export interface Creature {
  name: string
  firstMentioned: string
  mentions: number
}

export interface Weapon {
  name: string
  firstMentioned: string
  mentions: number
}

export interface Faction {
  name: string
  firstMentioned: string
  mentions: number
}

export interface Skill {
  name: string
  firstMentioned: string
  mentions: number
}

export interface HistoricalEvent {
  name: string
  firstMentioned: string
  description?: string
}

export interface Prophecy {
  text: string
  firstMentioned: string
}

export interface MemoriesData {
  characters: Character[]
  locations: Location[]
  creatures: Creature[]
  weapons: Weapon[]
  factions: Faction[]
  skills: Skill[]
  historicalEvents: HistoricalEvent[]
  prophecies: Prophecy[]
  customNotes: string[]
}

export class MemoriesManager {
  private data: MemoriesData = {
    characters: [],
    locations: [],
    creatures: [],
    weapons: [],
    factions: [],
    skills: [],
    historicalEvents: [],
    prophecies: [],
    customNotes: []
  }

  private chapters: Map<string, { title: string; content: string }> = new Map()

  addChapter(id: string, title: string, content: string) {
    try {
      this.chapters.set(id, { title, content })
      this.analyzeAll()
    } catch (e) {
      console.error("Error adding chapter to memories:", e)
    }
  }

  updateChapter(id: string, title: string, content: string) {
    try {
      if (this.chapters.has(id)) {
        this.chapters.set(id, { title, content })
        this.analyzeAll()
      }
    } catch (e) {
      console.error("Error updating chapter in memories:", e)
    }
  }

  removeChapter(id: string) {
    try {
      this.chapters.delete(id)
      this.analyzeAll()
    } catch (e) {
      console.error("Error removing chapter from memories:", e)
    }
  }

  private analyzeAll() {
    try {
      this.data = {
        characters: [],
        locations: [],
        creatures: [],
        weapons: [],
        factions: [],
        skills: [],
        historicalEvents: [],
        prophecies: [],
        customNotes: this.data.customNotes
      }

      const allContent = Array.from(this.chapters.values())
        .map(c => c.content)
        .join('\n\n')

      this.extractCharacters(allContent)
      this.extractLocations(allContent)
      this.extractCreatures(allContent)
      this.extractWeapons(allContent)
      this.extractFactions(allContent)
      this.extractSkills(allContent)
      this.extractHistoricalEvents(allContent)
      this.extractProphecies(allContent)
    } catch (e) {
      console.error("Error analyzing memories:", e)
    }
  }

  private extractCharacters(content: string) {
    try {
      const lines = content.split('\n')
      
      for (const line of lines) {
        const personPatterns = [
          /(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:was|is|are|had|has|will|can|could|would|should|appears?|seems?|looks?|feels?|became|becomes)/g,
          /(?:meet|met|know|knew|seen|saw|heard|called|named|captured|captured|chased|attacked|defeated|joined|befriended|married|trusted)\s+(?:a\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi,
          /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:boy|girl|man|woman|child|kid|warrior|mage|knight|king|queen|prince|princess|lord|lady|witch|wizard|sorcerer|healer|priest|rogue|thief|merchant|founder|ruler|leader|champion|hero|villain|monster|beast|creature)/gi,
          /(?:his|her|their|its)\s+name\s+(?:was\s+)?([A-Z][a-z]+)/gi,
          /(?:called|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi
        ]

        for (const pattern of personPatterns) {
          let match
          while ((match = pattern.exec(line)) !== null) {
            const name = (match[1] || match[0]).trim()
            if (this.isValidCharacterName(name)) {
              this.addCharacter(name)
            }
          }
        }

        const descriptionMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[-–—:]\s*(.{10,100})/i)
        if (descriptionMatch && this.isValidCharacterName(descriptionMatch[1])) {
          const char = this.data.characters.find(c => c.name === descriptionMatch[1])
          if (char && !char.description) {
            char.description = descriptionMatch[2].trim().substring(0, 150)
          }
        }
      }

      const capitalizedWords = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
      for (const name of capitalizedWords) {
        if (this.isValidCharacterName(name)) {
          this.addCharacter(name)
        }
      }

      this.data.characters.sort((a, b) => b.mentions - a.mentions)
    } catch (e) {
      console.error("Error extracting characters:", e)
    }
  }

  private addCharacter(name: string) {
    const cleanName = name.trim()
    if (cleanName.length < 2 || cleanName.length > 30) return
    
    const existing = this.data.characters.find(c => c.name.toLowerCase() === cleanName.toLowerCase())
    if (existing) {
      existing.mentions++
    } else {
      this.data.characters.push({
        name: cleanName,
        firstMentioned: this.getChapterForText(this.getAllContent(), cleanName),
        mentions: 1
      })
    }
  }

  private extractLocations(content: string) {
    try {
      const locationPatterns: { pattern: RegExp; type: Location['type'] }[] = [
        { pattern: /(?:in|at|to|from|on|to|into|through)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:City))/gi, type: 'city' },
        { pattern: /(?:in|at|to|from|on|to|into|through)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Town)) /gi, type: 'town' },
        { pattern: /(?:in|at|to|from|on|to|into|through)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Village)) /gi, type: 'village' },
        { pattern: /(?:in|at|to|from|on)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Planet|World|Realm|Kingdom|Empire|Continent|Dimension))/gi, type: 'planet' },
        { pattern: /(?:in|at|to|from|on)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Palace|Castle|Fortress|Tower|Temple|Shrine|Tomb|Cave|Canyon|Cave))/gi, type: 'building' },
        { pattern: /(?:in|at|to|from|on)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Forest|Mountain|River|Lake|Ocean|Sea|Valley|Canyon|Desert|Jungle|Wasteland))/gi, type: 'landmark' },
        { pattern: /(?:in|at|to|from|on)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Cave|Dungeon|Lair|Nest|Hollow))/gi, type: 'dungeon' },
        { pattern: /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s+(?:was|is|located|situated|built|established|founded)\s+(?:in|at|on|to)/gi, type: 'other' },
      ]

      const seen = new Map<string, { chapter: string; type: Location['type']; mentions: number }>()

      for (const { pattern, type } of locationPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const location = (match[1] || match[0]).trim()
          if (this.isValidLocationName(location)) {
            if (seen.has(location)) {
              seen.get(location)!.mentions++
            } else {
              seen.set(location, { 
                chapter: this.getChapterForText(content, location), 
                type,
                mentions: 1 
              })
            }
          }
        }
      }

      for (const [name, data] of Array.from(seen.entries())) {
        this.data.locations.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions,
          type: data.type
        })
      }

      this.data.locations.sort((a, b) => b.mentions - a.mentions)
    } catch (e) {
      console.error("Error extracting locations:", e)
    }
  }

  private isValidLocationName(name: string): boolean {
    const commonWords = new Set([
      'The', 'This', 'That', 'One', 'Some', 'Any', 'Each', 'Every',
      'Chapter', 'Part', 'Section', 'Book', 'Volume', 'Story', 'Tale',
      'Hello', 'Goodbye', 'Yes', 'No', 'Please', 'Sorry',
      'The End', 'Prologue', 'Epilogue'
    ])
    if (commonWords.has(name)) return false
    if (name.split(' ').length > 4) return false
    if (name.length < 2) return false
    return true
  }

  private extractCreatures(content: string) {
    try {
      const creaturePatterns = [
        /(?:a|an|the)\s+([A-Z][a-z]+(?:\s+[a-z]+)?)\s+(?:creature|beast|monster|dragon|golem|spirit|ghost|wraith|shade|daemon|demon|angel|fallen)/gi,
        /(?:the|an?)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s+(?:appeared|emerged|appeared|attacked|roared|growled|screamed)/gi,
        /(?:killed|slew|defeated|vanquished|banished)\s+(?:a|an|the)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?\s+)?(?:creature|beast|monster|dragon)/gi,
        /(?:summoned|conjured|called)\s+(?:a|an)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?)/gi
      ]

      const creatureTypes = ['dragon', 'golem', 'demon', 'angel', 'spirit', 'ghost', 'wraith', 'shade', 'beast', 'monster', 'werewolf', 'vampire', 'unicorn', 'phoenix', 'griffin', 'basilisk', 'hydra', 'minotaur', 'kraken', 'chimera', 'lich', 'wraith', 'reaper']

      const seen = new Map<string, { chapter: string; mentions: number }>()

      for (const pattern of creaturePatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const creature = (match[1] || match[0]).trim()
          if (creature.length > 2 && !creatureTypes.some(t => creature.toLowerCase().includes(t))) {
            if (seen.has(creature)) {
              seen.get(creature)!.mentions++
            } else {
              seen.set(creature, { chapter: this.getChapterForText(content, creature), mentions: 1 })
            }
          }
        }
      }

      for (const [name, data] of Array.from(seen.entries())) {
        this.data.creatures.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    } catch (e) {
      console.error("Error extracting creatures:", e)
    }
  }

  private extractWeapons(content: string) {
    try {
      const weaponPatterns = [
        /(?:the|a|an)\s+([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Sword|Axe|Spear|Bow|Shield|Hammer|Dagger|Staff|Wand|Blade|Weapon|Armor))/gi,
        /(?:wielding|wielded|carrying|carried|holding|held)\s+(?:a|an|the)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Sword|Axe|Spear|Bow|Shield|Hammer|Dagger|Staff|Wand|Blade))/gi,
        /(?:forged|made|created)\s+(?:a|an)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Sword|Axe|Spear|Bow|Shield|Hammer|Dagger|Staff|Wand|Weapon|Armor|Blade))/gi,
        /(?:the|an?)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s+(?:Sword|Axe|Spear|Bow|Shield|Hammer|Dagger|Staff|Wand|Blade|Artifact|Relic)/gi
      ]

      const seen = new Map<string, { chapter: string; mentions: number }>()

      for (const pattern of weaponPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const weapon = (match[1] || match[0]).trim()
          if (weapon.length > 2) {
            if (seen.has(weapon)) {
              seen.get(weapon)!.mentions++
            } else {
              seen.set(weapon, { chapter: this.getChapterForText(content, weapon), mentions: 1 })
            }
          }
        }
      }

      for (const [name, data] of Array.from(seen.entries())) {
        this.data.weapons.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    } catch (e) {
      console.error("Error extracting weapons:", e)
    }
  }

  private extractFactions(content: string) {
    try {
      const factionPatterns = [
        /(?:the|an?)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s+(?:Guild|Order|Society|Club|Council|Syndicate|House|Clan|Tribe|Faction|Empire|Kingdom|Alliance|Guild)/gi,
        /(?:joined|left|betrayed|led|commanded|ruled)\s+(?:the|an?)?\s*([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:Guild|Order|Society|Club|Council|Syndicate|House|Clan|Tribe|Faction))/gi,
        /(?:the|an?)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s+(?:Knights|Warriors|Mages|Sorcerers|Priests|Healers|Thieves|Assassins|Rangers|Wizards)/gi
      ]

      const seen = new Map<string, { chapter: string; mentions: number }>()

      for (const pattern of factionPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const faction = (match[1] || match[0]).trim()
          if (faction.length > 2) {
            if (seen.has(faction)) {
              seen.get(faction)!.mentions++
            } else {
              seen.set(faction, { chapter: this.getChapterForText(content, faction), mentions: 1 })
            }
          }
        }
      }

      for (const [name, data] of Array.from(seen.entries())) {
        this.data.factions.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    } catch (e) {
      console.error("Error extracting factions:", e)
    }
  }

  private extractSkills(content: string) {
    try {
      const skillPatterns = [
        /(?:mastered|learned|used|cast|performed)\s+(?:a|an|the)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Spell|Tech|Technique|Skill|Art|Power|Ability|Magic))/gi,
        /(?:the|an?)\s+([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Spell|Tech|Technique|Skill|Art|Power|Ability|Magic|Strike|Attack|Defense))/gi,
        /(?:known\s+as|called|named)\s+(?:the)?\s*([A-Z][a-z]+(?:\s+[a-z]+){0,2}\s+(?:Blade|Fist|Foot|Star|Fire|Ice|Lightning|Shadow|Dark|Light))/gi,
        /(?:summoned|conjured|invoked|channeled)\s+(?:a|an)?\s*([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:Element|Energy|Force|Power))/gi
      ]

      const seen = new Map<string, { chapter: string; mentions: number }>()

      for (const pattern of skillPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const skill = (match[1] || match[0]).trim()
          if (skill.length > 2) {
            if (seen.has(skill)) {
              seen.get(skill)!.mentions++
            } else {
              seen.set(skill, { chapter: this.getChapterForText(content, skill), mentions: 1 })
            }
          }
        }
      }

      for (const [name, data] of Array.from(seen.entries())) {
        this.data.skills.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    } catch (e) {
      console.error("Error extracting skills:", e)
    }
  }

  private extractHistoricalEvents(content: string) {
    try {
      const eventPatterns = [
        /(?:the|an?|that)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*(?:\s+War|Battle|Conflict|Crusade|Campaign|Revolution|Uprising|Invasion|Siege))/gi,
        /(?:the|an?|that)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*(?:\s+Fall|Dawn|Rise|End|Beginning|Birth|Death|Destruction|Creation))/gi,
        /(?:the|an?|that)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*(?:\s+Age|Era|Epoch|Period|Time))/gi,
        /(?:during|in|after|before)\s+(?:the|an?)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*(?:\s+War|Battle|Conflict|Crusade|Campaign|Invasion))/gi,
        /(?:legend|history|story|tale|prophecy)\s+(?:of|about)\s+(?:the)?\s*([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)/gi
      ]

      const seen = new Set<string>()

      for (const pattern of eventPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const event = (match[1] || match[0]).trim()
          if (event.length > 3 && !seen.has(event)) {
            seen.add(event)
            this.data.historicalEvents.push({
              name: event,
              firstMentioned: this.getChapterForText(content, event)
            })
          }
        }
      }
    } catch (e) {
      console.error("Error extracting historical events:", e)
    }
  }

  private extractProphecies(content: string) {
    try {
      const prophecyPatterns = [
        /(?:prophecy|prophecied|foretold|predicted|foreseen)\s*[:.]?\s*[""''](.{20,200})[""'']/gi,
        /(?:legend|ancient\s+text|scroll|tome|tablet)\s+(?:reads?|says?|writes?|states?|declares?)\s*[:.]?\s*[""''](.{20,200})[""'']/gi,
        /(?:according\s+to|as\s+per)\s+(?:the\s+)?(?:prophecy|prophecies|ancient\s+wisdom|oracle|seer)\s*[:.]?\s*[""''](.{20,200})[""'']/gi,
        /(?:the\s+)?(?:words|text|inscription|engraving|runes)\s+(?:on|upon)\s+(?:the\s+)?\w+\s+(?:read|reads|stated|states)\s*[:.]?\s*[""''](.{20,200})[""'']/gi
      ]

      const seen = new Set<string>()

      for (const pattern of prophecyPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const prophecy = match[1].trim()
          if (prophecy.length > 10 && !seen.has(prophecy)) {
            seen.add(prophecy)
            this.data.prophecies.push({
              text: prophecy,
              firstMentioned: this.getChapterForText(content, prophecy)
            })
          }
        }
      }
    } catch (e) {
      console.error("Error extracting prophecies:", e)
    }
  }

  private getAllContent(): string {
    return Array.from(this.chapters.values())
      .map(c => c.content)
      .join('\n\n')
  }

  private getChapterForText(content: string, text: string): string {
    const chapters = Array.from(this.chapters.entries())
    for (const [, chapter] of chapters) {
      if (chapter.content.includes(text.substring(0, 30))) {
        return chapter.title
      }
    }
    return 'Unknown'
  }

  private isValidCharacterName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 30) return false
    
    const commonWords = new Set([
      'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Who', 'Why', 'How',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
      'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Lady', 'Lord', 'King', 'Queen', 'Prince', 'Princess',
      'Chapter', 'Part', 'Section', 'Book', 'Volume', 'Story', 'Tale', 'Saga',
      'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last', 'Final', 'Next',
      'Hello', 'Goodbye', 'Yes', 'No', 'Please', 'Thank', 'Sorry', 'Excuse',
      'The End', 'Prologue', 'Epilogue', 'Index', 'Contents', 'Table', 'Note', 'Notes',
      'Suddenly', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Meanwhile',
      'After', 'Before', 'During', 'Through', 'Between', 'Among', 'Within', 'Without',
      'Because', 'Since', 'Although', 'While', 'Unless', 'Until', 'Whether', 'Wherever'
    ])
    
    if (commonWords.has(name)) return false
    if (commonWords.has(name.split(' ')[0])) return false
    
    const startsWithCommon = ['The', 'A', 'An', 'One', 'Some', 'Any', 'Each', 'Every']
    if (startsWithCommon.includes(name.split(' ')[0])) return false
    
    return true
  }

  generateMarkdown(): string {
    try {
      const lines: string[] = ['# Memory Bank\n', '_Captured memories from your manuscript_\n']

      if (this.data.characters.length > 0) {
        lines.push('## Characters\n')
        for (const char of this.data.characters.slice(0, 25)) {
          let entry = `- **${char.name}**`
          if (char.description) {
            entry += `: ${char.description}`
          } else {
            entry += ` — *${char.firstMentioned}* (${char.mentions} mentions)`
          }
          lines.push(entry)
        }
        lines.push('')
      }

      if (this.data.locations.length > 0) {
        lines.push('## Locations\n')
        for (const loc of this.data.locations.slice(0, 20)) {
          const typeTag = loc.type ? ` [${loc.type}]` : ''
          lines.push(`- **${loc.name}**${typeTag} — *${loc.firstMentioned}* (${loc.mentions} mentions)`)
        }
        lines.push('')
      }

      if (this.data.creatures.length > 0) {
        lines.push('## Creatures & Beasts\n')
        for (const creature of this.data.creatures.slice(0, 15)) {
          lines.push(`- **${creature.name}** — *${creature.firstMentioned}* (${creature.mentions} mentions)`)
        }
        lines.push('')
      }

      if (this.data.weapons.length > 0) {
        lines.push('## Weapons & Artifacts\n')
        for (const weapon of this.data.weapons.slice(0, 15)) {
          lines.push(`- **${weapon.name}** — *${weapon.firstMentioned}* (${weapon.mentions} mentions)`)
        }
        lines.push('')
      }

      if (this.data.factions.length > 0) {
        lines.push('## Factions & Orders\n')
        for (const faction of this.data.factions.slice(0, 15)) {
          lines.push(`- **${faction.name}** — *${faction.firstMentioned}* (${faction.mentions} mentions)`)
        }
        lines.push('')
      }

      if (this.data.skills.length > 0) {
        lines.push('## Skills & Techniques\n')
        for (const skill of this.data.skills.slice(0, 15)) {
          lines.push(`- **${skill.name}** — *${skill.firstMentioned}* (${skill.mentions} mentions)`)
        }
        lines.push('')
      }

      if (this.data.historicalEvents.length > 0) {
        lines.push('## Historical Events\n')
        for (const event of this.data.historicalEvents.slice(0, 10)) {
          lines.push(`- **${event.name}** — *${event.firstMentioned}*`)
        }
        lines.push('')
      }

      if (this.data.prophecies.length > 0) {
        lines.push('## Prophecies & Legends\n')
        for (const prophecy of this.data.prophecies.slice(0, 5)) {
          lines.push(`> _"${prophecy.text}"_`)
          lines.push(`> — *${prophecy.firstMentioned}*\n`)
        }
        lines.push('')
      }

      if (this.data.customNotes.length > 0) {
        lines.push('## Custom Notes\n')
        for (const note of this.data.customNotes) {
          lines.push(`- ${note}`)
        }
        lines.push('')
      }

      if (lines.length === 2) {
        lines.push('_No memories captured yet. Start writing to see elements appear here._\n')
      }

      lines.push('---\n')
      lines.push(`_Last updated: ${new Date().toLocaleDateString()}_`)

      return lines.join('\n')
    } catch (e) {
      console.error("Error generating markdown:", e)
      return '# Memory Bank\n\n_Error generating memories. Please try again._'
    }
  }

  addCustomNote(note: string) {
    this.data.customNotes.push(note)
  }

  removeCustomNote(index: number) {
    this.data.customNotes.splice(index, 1)
  }

  getData(): MemoriesData {
    return { ...this.data }
  }
}
