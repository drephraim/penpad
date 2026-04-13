export interface Character {
  name: string
  firstMentioned: string
  mentions: number
  description?: string
  skills: string[]
}

export interface MemoriesData {
  characters: Character[]
  customNotes: string[]
}

export class MemoriesManager {
  private data: MemoriesData = {
    characters: [],
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
        customNotes: this.data.customNotes
      }

      const allContent = Array.from(this.chapters.values())
        .map(c => c.content)
        .join('\n\n')

      this.extractCharacters(allContent)
    } catch (e) {
      console.error("Error analyzing memories:", e)
    }
  }

  private extractCharacters(content: string) {
    try {
      const lines = content.split('\n')
      const foundCharacters = new Map<string, Character>()

      for (const line of lines) {
        const namePatterns = [
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g,
        ]

        for (const pattern of namePatterns) {
          let match
          while ((match = pattern.exec(line)) !== null) {
            const name = match[1].trim()
            if (this.isValidCharacterName(name)) {
              if (!foundCharacters.has(name)) {
                foundCharacters.set(name, {
                  name,
                  firstMentioned: this.getChapterForText(content, name),
                  mentions: 1,
                  skills: []
                })
              } else {
                foundCharacters.get(name)!.mentions++
              }
            }
          }
        }

        const skillPattern = /(?:used?|known\s+for|mastered?|wielded?|possessed?)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:power|ability|skill|technique|magic|spell|art))|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:Blade|Fist|Fire|Ice|Lightning|Shadow))?)/gi
        let skillMatch
        while ((skillMatch = skillPattern.exec(line)) !== null) {
          const skill = (skillMatch[1] || skillMatch[2] || '').trim()
          if (skill.length > 2) {
            const namesInLine = this.extractNamesFromLine(line)
            for (const charName of namesInLine) {
              const char = foundCharacters.get(charName)
              if (char && !char.skills.includes(skill)) {
                char.skills.push(skill)
              }
            }
          }
        }

        const descriptionMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–—:,]\s*([^.\n]{10,150})/)
        if (descriptionMatch && this.isValidCharacterName(descriptionMatch[1])) {
          const char = foundCharacters.get(descriptionMatch[1])
          if (char && !char.description) {
            char.description = descriptionMatch[2].trim().substring(0, 200)
          }
        }

        const possessPattern = /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:was|is|had|possessed?)\s+([^.]{10,100})/g
        let posMatch
        while ((posMatch = possessPattern.exec(line)) !== null) {
          const detail = posMatch[1].trim()
          if (detail.length > 10) {
            const namesInLine = this.extractNamesFromLine(line)
            for (const charName of namesInLine) {
              const char = foundCharacters.get(charName)
              if (char && !char.description) {
                char.description = detail.substring(0, 200)
                break
              }
            }
          }
        }
      }

      this.data.characters = Array.from(foundCharacters.values())
        .filter(c => c.mentions >= 2 || c.description || c.skills.length > 0)
        .sort((a, b) => b.mentions - a.mentions)
    } catch (e) {
      console.error("Error extracting characters:", e)
    }
  }

  private extractNamesFromLine(line: string): string[] {
    const names: string[] = []
    const namePattern = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}/g
    let match
    while ((match = namePattern.exec(line)) !== null) {
      const name = match[0].trim()
      if (this.isValidCharacterName(name)) {
        names.push(name)
      }
    }
    return names
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
    if (!name || name.length < 2 || name.length > 35) return false

    const commonWords = new Set([
      'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Who', 'Why', 'How',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
      'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Lady', 'Lord', 'King', 'Queen', 'Prince', 'Princess', 'Saint',
      'Chapter', 'Part', 'Section', 'Book', 'Volume', 'Story', 'Tale', 'Saga', 'Prologue', 'Epilogue',
      'Hello', 'Goodbye', 'Yes', 'No', 'Please', 'Thank', 'Sorry', 'Excuse',
      'Suddenly', 'However', 'Therefore', 'Moreover', 'Furthermore', 'Meanwhile',
      'After', 'Before', 'During', 'Through', 'Between', 'Among', 'Within', 'Without',
      'Because', 'Since', 'Although', 'While', 'Unless', 'Until', 'Whether', 'Wherever',
      'There', 'Here', 'Where', 'When', 'Then', 'Now', 'Later', 'Earlier', 'Above', 'Below',
      'Every', 'Some', 'Most', 'Many', 'Other', 'Another', 'Such', 'Same',
      'Nothing', 'Something', 'Anything', 'Everything', 'Someone', 'Anyone', 'Everyone',
      'The End', 'Index', 'Contents', 'Table', 'Note', 'Notes', 'Summary'
    ])

    if (commonWords.has(name)) return false
    if (commonWords.has(name.split(' ')[0])) return false

    const startsWithCommon = ['The', 'A', 'An', 'One', 'Some', 'Any', 'Each', 'Every']
    if (startsWithCommon.includes(name.split(' ')[0])) return false

    return true
  }

  generateMarkdown(): string {
    try {
      const lines: string[] = ['# Memory Bank\n']

      if (this.data.characters.length > 0) {
        lines.push('')
        for (const char of this.data.characters.slice(0, 30)) {
          const entry = `**${char.name}**`
          lines.push(entry)

          if (char.description) {
            lines.push(`   ${char.description}`)
          }

          if (char.skills.length > 0) {
            lines.push(`   *Skills: ${char.skills.join(', ')}*`)
          }

          lines.push(`   _First mentioned: ${char.firstMentioned} (${char.mentions} times)_\n`)
        }
      }

      if (this.data.customNotes.length > 0) {
        lines.push('## Custom Notes\n')
        for (const note of this.data.customNotes) {
          lines.push(`- ${note}`)
        }
        lines.push('')
      }

      if (lines.length === 2) {
        lines.push('_No memories captured yet._\n')
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
