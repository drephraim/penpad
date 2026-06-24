# Proposed Code Changes for Brain Map Updates and Scan Count Reduction

We have analyzed the codebase in `src/app/editor/page.tsx` and `src/app/api/ai/route.ts`. The changes below implement:
1. Reducing the bulk chapter scan count from **5 to 2** for the Character Progression bulk update.
2. Adding a new **"Scan Updates"** action card to the Brain Map panel that scans the last 2 chapters for updates to existing Brain Map entries.
3. Updating the Brain Map UI to **sort all brain entries by their modification timestamp (`updatedAt || createdAt`) in descending order**, so recently updated or added entries automatically float to the top of the list.

---

## 1. Changes in `src/app/editor/page.tsx`

### A. State Variable Additions
Add the `brainScanUpdatesLoading` state in the **Brain Map States** section (around line 1650):

```typescript
  const [brainScanUpdatesLoading, setBrainScanUpdatesLoading] = useState(false)
```

### B. Update Character Progression Bulk Update Scan Count (Change 5 to 2)
In the handler `handleProgressionBulkUpdate` (around lines 4338-4395), change references from 5 chapters to 2:

```diff
-      const recentChapters = getManuscriptNotesList(notes).slice(-5)
+      const recentChapters = getManuscriptNotesList(notes).slice(-2)
```

And update the status messages/notices:

```diff
         if (updatesQueue.length === 0) {
           if (updatesQueue.length === 0) {
-            setProgressionNotice("No characters were detected in the 5 recent chapters.")
+            setProgressionNotice("No characters were detected in the 2 recent chapters.")
             return
           }
         } else {
-          setProgressionNotice("No characters were detected in the 5 recent chapters. Ensure your characters have Story Bible entries and their names appear in the chapter text.")
+          setProgressionNotice("No characters were detected in the 2 recent chapters. Ensure your characters have Story Bible entries and their names appear in the chapter text.")
           return
         }
```

In the JSX UI for the action banner (around lines 11143-11160):

```diff
                 <button 
                   className={`progression-action-banner ${progressionBulkUpdating ? 'scanning' : ''}`}
                   onClick={handleProgressionBulkUpdate} 
                   disabled={progressionBulkUpdating || progressionLoading}
-                  title="Scan 5 recent chapters and update character profiles"
+                  title="Scan 2 recent chapters and update character profiles"
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
-                    <p>{progressionBulkUpdating ? progressionBulkUpdateStatus : "Scan the 5 recent chapters to detect and apply character growth automatically."}</p>
+                    <p>{progressionBulkUpdating ? progressionBulkUpdateStatus : "Scan the 2 recent chapters to detect and apply character growth automatically."}</p>
                   </div>
                   {!progressionBulkUpdating && <span className="progression-banner-badge">Scan</span>}
                 </button>
```

### C. Update Sorting of Brain Map Entries in UI
Modify `filteredBrainEntries` (around lines 9345-9356) to sort by `updatedAt || createdAt` descending:

```diff
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
-  })
+  }).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
```

### D. New Handler for Scanning Brain Map Updates
Add this helper method inside the editor page component (for example, below `quickAddSuggestedEntity` at line 7644):

```typescript
  const handleScanBrainUpdates = async () => {
    if (!projectId || !user || brainScanUpdatesLoading) return
    const orderedNotes = getManuscriptNotesList(notes)
    const recentNotes = orderedNotes.slice(-2) // Scan the last 2 chapters
    if (recentNotes.length === 0) {
      alert("No chapters found in the manuscript to scan.")
      return
    }

    if (brainEntries.length === 0) {
      alert("No existing Brain Map entries found. Add some entries first before scanning for updates.")
      return
    }

    setBrainScanUpdatesLoading(true)
    try {
      const chapters = recentNotes.map(note => ({
        id: note.id,
        title: note.title || "Untitled",
        chapterNumber: getNoteChapterNumber(note),
        content: note.content || ""
      }))

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_scan_updates",
          chapters,
          existingBrainEntries: brainEntries
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to scan for updates")

      const updates = Array.isArray(data.updates) ? data.updates : []
      if (updates.length === 0) {
        alert("Scanned the last 2 chapters and found no updates for existing Brain Map entries.")
        return
      }

      let updatedCount = 0
      const now = Date.now()
      const importanceRank: Record<BrainImportance, number> = {
        minor: 1,
        major: 2,
        critical: 3
      }

      let updatedList = [...brainEntries]
      const updatedEntriesToSave: BrainEntry[] = []

      for (const update of updates) {
        const normalizedName = update.entityName.trim().toLowerCase()
        const existingIdx = updatedList.findIndex(entry =>
          (entry.entityName || entry.highlightedText || "").trim().toLowerCase() === normalizedName
        )

        if (existingIdx !== -1) {
          const existingEntry = updatedList[existingIdx]
          const existingImportance = existingEntry.importance || "minor"
          const strongerImportance = update.importance && importanceRank[update.importance as BrainImportance] > importanceRank[existingImportance]
            ? update.importance as BrainImportance
            : existingImportance

          const evidenceText = update.evidence?.trim()
          const summaryWithEvidence = evidenceText
            ? `${update.updatedSummary}\n\nEvidence: ${evidenceText}`
            : update.updatedSummary

          const updatedEntry: BrainEntry = {
            ...existingEntry,
            importance: strongerImportance,
            aiSummary: summaryWithEvidence,
            updatedAt: now
          }

          updatedList[existingIdx] = updatedEntry
          updatedEntriesToSave.push(updatedEntry)
          updatedCount++
        }
      }

      if (updatedCount > 0) {
        // Sort updated list by updatedAt/createdAt descending
        updatedList.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        setBrainEntries(updatedList)
        await saveStoryBrainLocal(projectId, updatedList)
        for (const entry of updatedEntriesToSave) {
          await saveBrainEntryToCloud(user.uid, projectId, entry)
        }
        alert(`Successfully updated ${updatedCount} Brain Map entries!`)
      } else {
        alert("Scanned the last 2 chapters but couldn't match any suggested updates to existing Brain Map entries.")
      }
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to scan for updates.")
    } finally {
      setBrainScanUpdatesLoading(false)
    }
  }
```

### E. New Scan Button UI In Quick Actions Grid
Modify the `brain-quick-actions` container (around line 12982) to support 4 grid columns instead of 3, and append the new **Scan Updates** button:

```diff
-                <div className="brain-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginBottom: '0.75rem', flexShrink: 0 }}>
+                <div className="brain-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem', marginBottom: '0.75rem', flexShrink: 0 }}>
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
+
+                  <button
+                    className="brain-action-card glass-light"
+                    onClick={handleScanBrainUpdates}
+                    disabled={brainScanUpdatesLoading}
+                    title="Scan last 2 chapters for Brain Map updates"
+                    style={{
+                      display: 'flex',
+                      flexDirection: 'column',
+                      alignItems: 'center',
+                      justifyContent: 'center',
+                      gap: '0.35rem',
+                      padding: '0.55rem 0.25rem',
+                      borderRadius: 'var(--radius-md)',
+                      border: '1px solid var(--surface-border)',
+                      background: 'rgba(255, 255, 255, 0.03)',
+                      color: 'var(--text-secondary)',
+                      cursor: 'pointer',
+                      transition: 'var(--transition)'
+                    }}
+                  >
+                    {brainScanUpdatesLoading ? (
+                      <Loader2 size={14} className="spin" />
+                    ) : (
+                      <RefreshCw size={14} style={{ color: '#60a5fa' }} />
+                    )}
+                    <span style={{ fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scan Updates</span>
+                  </button>
                 </div>
```

---

## 2. Changes in `src/app/api/ai/route.ts`

### A. Add action `"brain_scan_updates"` to validation checks
At the beginning of the `POST` handler (around lines 1690-1708), add `"brain_scan_updates"` to the list of permitted actions and to the `jsonActions` set:

```diff
     if (![
       "continue", "rewrite", "outline", "generate_lore", "appearance_prompts",
       "progression_update", "cultivation_realm_import", "brain_analyze",
       "brain_ask", "progression_template_design", "brain_consistency_check",
       "brain_suggest_additions", "brain_generate_dossier", "bible_consistency_check",
       "bible_extract_from_chapter", "arc_seed_extract", "name_generate",
-      "timeline_consistency_check", "format_references"
+      "timeline_consistency_check", "format_references", "brain_scan_updates"
     ].includes(action)) {
-      return NextResponse.json({ error: "Invalid action. Must be continue, rewrite, outline, generate_lore, appearance_prompts, progression_update, cultivation_realm_import, brain_analyze, brain_ask, brain_consistency_check, brain_suggest_additions, brain_generate_dossier, bible_consistency_check, bible_extract_from_chapter, arc_seed_extract, name_generate, progression_template_design, timeline_consistency_check, or format_references." }, { status: 400 })
+      return NextResponse.json({ error: "Invalid action. Must be continue, rewrite, outline, generate_lore, appearance_prompts, progression_update, cultivation_realm_import, brain_analyze, brain_ask, brain_consistency_check, brain_suggest_additions, brain_generate_dossier, bible_consistency_check, bible_extract_from_chapter, arc_seed_extract, name_generate, progression_template_design, timeline_consistency_check, format_references, or brain_scan_updates." }, { status: 400 })
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
-      "format_references"
+      "format_references",
+      "brain_scan_updates"
     ])
```

### B. Prompt Generation Logic
Add the system prompt and context construction for `"brain_scan_updates"` right before `"brain_suggest_additions"` (around line 1312):

```typescript
    } else if (action === "brain_scan_updates") {
      const { chapters, existingBrainEntries } = body
      if (!Array.isArray(chapters) || chapters.length === 0) {
        return NextResponse.json({ error: "chapters array is required for brain_scan_updates" }, { status: 400 })
      }
      if (!Array.isArray(existingBrainEntries) || existingBrainEntries.length === 0) {
        return NextResponse.json({ error: "existingBrainEntries array is required for brain_scan_updates" }, { status: 400 })
      }

      systemInstruction =
        "You are a meticulous novel editor. Read the provided chapter content and cross-reference it with the list of existing Brain Map entries.\n" +
        "Identify if any of the existing entities (characters, places, objects, concepts, events, etc.) receive new details, developments, or updates in these chapters.\n" +
        "Specifically look for: updates to status, new relationships, newly revealed secrets, new actions they took, or relating details about their role in these chapters.\n" +
        "For each existing entry that has updates or relating details in the chapters, propose an updated summary.\n" +
        "Output ONLY a JSON object with key:\n" +
        "- updates: an array of objects, each containing:\n" +
        "  - entityName: name of the entity as written in the existing list\n" +
        "  - updatedSummary: a concise 2-3 sentence updated summary/context that integrates the new details while preserving vital old details\n" +
        "  - evidence: a short excerpt or paraphrased detail from the text supporting the update\n" +
        "  - importance: optionally update the importance to 'minor', 'major', or 'critical' if their role/importance has changed\n" +
        "Do not include markdown formatting or backticks around the JSON."

      const chapterContent = chapters.map((c: any) => {
        const label = c.chapterNumber ? `Chapter ${c.chapterNumber}` : "Chapter"
        return `### ${label}: ${c.title}\n${c.content}`
      }).join("\n\n---\n\n")

      const existingContext = existingBrainEntries.map((entry: any) => {
        return `- Name: "${entry.entityName || entry.highlightedText}" (${entry.entityType || "unknown"})\n  Current Summary: ${entry.aiSummary}`
      }).join("\n")

      userPrompt = `Chapter Content to scan:\n${chapterContent}\n\nExisting Brain Map Entries:\n${existingContext}`
```

### C. Response Parsing and Formatting
Add the response formatting for `"brain_scan_updates"` right before `"brain_suggest_additions"` (around line 1732):

```typescript
    if (action === "brain_scan_updates") {
      const result = parseJsonObject<any>(text)
      const allowedImportance = new Set(["minor", "major", "critical"])
      const updates = Array.isArray(result?.updates)
        ? result.updates.map((update: any) => {
            const importance = allowedImportance.has(update?.importance) ? update.importance : undefined
            return {
              entityName: String(update?.entityName || "").trim(),
              updatedSummary: String(update?.updatedSummary || "").trim(),
              evidence: update?.evidence ? String(update.evidence).slice(0, 400) : undefined,
              importance
            }
          }).filter((update: any) => update.entityName && update.updatedSummary)
        : []
      return NextResponse.json({
        updates
      })
    }
```
