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
}

export interface TimelineEvent {
  event: string
  chapter: string
  timestamp?: string
}

export interface PlotThread {
  thread: string
  introduced: string
  status: 'open' | 'resolved' | 'foreshadowed'
}

export interface MemoriesData {
  characters: Character[]
  locations: Location[]
  timeline: TimelineEvent[]
  plotThreads: PlotThread[]
  customNotes: string[]
}

export class MemoriesManager {
  private data: MemoriesData = {
    characters: [],
    locations: [],
    timeline: [],
    plotThreads: [],
    customNotes: []
  }

  private chapters: Map<string, { title: string; content: string }> = new Map()

  addChapter(id: string, title: string, content: string) {
    this.chapters.set(id, { title, content })
    this.analyzeAll()
  }

  updateChapter(id: string, title: string, content: string) {
    if (this.chapters.has(id)) {
      this.chapters.set(id, { title, content })
      this.analyzeAll()
    }
  }

  removeChapter(id: string) {
    this.chapters.delete(id)
    this.analyzeAll()
  }

  private analyzeAll() {
    this.data = {
      characters: [],
      locations: [],
      timeline: [],
      plotThreads: [],
      customNotes: this.data.customNotes
    }

    const allContent = Array.from(this.chapters.values())
      .map(c => c.content)
      .join('\n\n')

    this.extractCharacters(allContent)
    this.extractLocations(allContent)
    this.extractTimeline(allContent)
    this.extractPlotThreads(allContent)
  }

  private extractCharacters(content: string) {
    const capitalizedWords = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
    const seen = new Map<string, { chapter: string; mentions: number }>()

    for (const name of capitalizedWords) {
      if (this.isCommonWord(name)) continue
      if (name.split(' ').length > 4) continue

      const cleanName = name.trim()
      if (seen.has(cleanName)) {
        seen.get(cleanName)!.mentions++
      } else {
        seen.set(cleanName, { chapter: this.getChapterForText(content, name), mentions: 1 })
      }
    }

    for (const [name, data] of Array.from(seen.entries())) {
      if (data.mentions >= 1) {
        this.data.characters.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    }

    this.data.characters.sort((a, b) => b.mentions - a.mentions)
  }

  private extractLocations(content: string) {
    const locationPatterns = [
      /(?:in|at|to|from|on)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*(?:\s+(?:City|Town|Village|Forest|Mountain|River|Land|World|Sea|Ocean|Castle|Palace|Tower|House|Home|Cave|Castle))\b)/gi,
      /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:City|Town|Village|Forest|Mountain|River|Land|World|Sea|Ocean|Castle|Palace|Tower|House|Home|Cave))\b/gi
    ]

    const seen = new Map<string, { chapter: string; mentions: number }>()

    for (const pattern of locationPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const location = match[1] || match[0]
        if (this.isCommonWord(location)) continue

        if (seen.has(location)) {
          seen.get(location)!.mentions++
        } else {
          seen.set(location, { chapter: this.getChapterForText(content, location), mentions: 1 })
        }
      }
    }

    for (const [name, data] of Array.from(seen.entries())) {
      if (data.mentions >= 1) {
        this.data.locations.push({
          name,
          firstMentioned: data.chapter,
          mentions: data.mentions
        })
      }
    }

    this.data.locations.sort((a, b) => b.mentions - a.mentions)
  }

  private extractTimeline(content: string) {
    const timePatterns = [
      /((?:Day|The\s+\w+\s+day|Morning|Afternoon|Evening|Night|Midnight|Dawn|Dusk)\s+\d*[\w\s]*)/gi,
      /((?:Last|This|Next)\s+\w+)/gi,
      /(?:in\s+)?((?:\d+\s+)?(?:minutes?|hours?|days?|weeks?|months?|years?|centuries?|generations?)\s+(?:later|ago|earlier|from now|before))/gi,
      /((?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\s+(?:day|week|month|year|moment|instant)\s+(?:later|ago|passed|passed))/gi,
      /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/gi
    ]

    const seen = new Set<string>()

    for (const pattern of timePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const event = match[1] || match[0]
        const trimmed = event.trim()
        if (trimmed.length > 5 && !seen.has(trimmed)) {
          seen.add(trimmed)
          this.data.timeline.push({
            event: trimmed,
            chapter: this.getChapterForText(content, event)
          })
        }
      }
    }
  }

  private extractPlotThreads(content: string) {
    const threadPatterns = [
      /(?:remember|never forget|must find|need to|must return|must deliver|searching for|looking for|hunt for|hunting)/gi,
      /(?:secret|mystery|hidden|forgotten|lost|burielf|ancient|prophecy|prediction)/gi,
      /(?:promise|oath|vow|sworn|blood oath)/gi
    ]

    const seen = new Map<string, { text: string; chapter: string }>()

    for (const pattern of threadPatterns) {
      let match
      const lines = content.split('\n')
      for (const line of lines) {
        pattern.lastIndex = 0
        while ((match = pattern.exec(line)) !== null) {
          const context = this.getContextAround(line, match.index, 40)
          const key = context.toLowerCase().substring(0, 50)
          if (!seen.has(key)) {
            seen.set(key, {
              text: context,
              chapter: this.getChapterForText(content, context)
            })
          }
        }
      }
    }

    for (const [, data] of Array.from(seen.entries())) {
      this.data.plotThreads.push({
        thread: data.text,
        introduced: data.chapter,
        status: 'open'
      })
    }
  }

  private getContextAround(text: string, index: number, length: number): string {
    const start = Math.max(0, index - length)
    const end = Math.min(text.length, index + length)
    let context = text.substring(start, end)
    if (start > 0) context = '...' + context
    if (end < text.length) context = context + '...'
    return context.replace(/\n/g, ' ').trim()
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

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Who', 'Why', 'How',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
      'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Lady', 'Lord', 'King', 'Queen', 'Prince', 'Princess',
      'Chapter', 'Part', 'Section', 'Book', 'Volume', 'Story', 'Tale', 'Saga',
      'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last', 'Final', 'Next',
      'Hello', 'Goodbye', 'Yes', 'No', 'Please', 'Thank', 'Sorry', 'Excuse',
      'The End', 'Prologue', 'Epilogue', 'Index', 'Contents', 'Table'
    ])
    return commonWords.has(word) || commonWords.has(word.split(' ')[0])
  }

  generateMarkdown(): string {
    const lines: string[] = ['# Memories\n', '_Auto-generated notes from your manuscript_\n']

    if (this.data.characters.length > 0) {
      lines.push('## Characters\n')
      for (const char of this.data.characters.slice(0, 20)) {
        lines.push(`- **${char.name}**: First mentioned in *${char.firstMentioned}* (${char.mentions} mentions)`)
      }
      lines.push('')
    }

    if (this.data.locations.length > 0) {
      lines.push('## Locations\n')
      for (const loc of this.data.locations.slice(0, 15)) {
        lines.push(`- **${loc.name}**: First appears in *${loc.firstMentioned}* (${loc.mentions} mentions)`)
      }
      lines.push('')
    }

    if (this.data.timeline.length > 0) {
      lines.push('## Timeline\n')
      for (const event of this.data.timeline.slice(0, 15)) {
        lines.push(`- ${event.event} (${event.chapter})`)
      }
      lines.push('')
    }

    if (this.data.plotThreads.length > 0) {
      lines.push('## Plot Threads\n')
      for (const thread of this.data.plotThreads.slice(0, 10)) {
        lines.push(`- _${thread.thread}_ — introduced in *${thread.introduced}* [${thread.status}]`)
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
      lines.push('_No memories captured yet. Start writing to see character names, locations, and plot elements appear here._\n')
    }

    lines.push('---\n')
    lines.push(`_Last updated: ${new Date().toLocaleDateString()}_`)

    return lines.join('\n')
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
