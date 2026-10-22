# Asyar Polyglot Dictionary & German Trainer (`org.asyar.polyglot-dict`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development and superpowers:dispatching-parallel-agents to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and install `org.asyar.polyglot-dict`, a trilingual (`DE ↔ EN ↔ TR`) dictionary, German grammar & article trainer (`der/die/das`, plurals, verb conjugations), article-highlighted example sentence engine, and vocabulary/flashcard extension for Asyar.

**Architecture:** A Tier-2 Asyar extension (`asyar-sdk@^4.15.0`, Svelte 5, Vite 6, TypeScript, Vitest) with a background `worker.ts` and multi-view `view.ts` (`PolyglotView`, `VocabView`, `FlashcardView`). The data layer (`src/engine/`) runs parallel queries against Google Translate Rich Dictionary (`dt=t,bd,ex,ss,md,rm`), German Wiktionary (`de.wiktionary.org`), English Free Dictionary API, a built-in curated German lexicon fallback, and optional Gemini/OpenAI enrichment, caching results for 24h and persisting saved words with example sentences in `src/store/vocab.ts`.

**Tech Stack:** `asyar-sdk@^4.15.0`, `svelte@^5.0.0`, `vite@^6.0.0`, `@sveltejs/vite-plugin-svelte@^5.0.0`, `typescript@^5.7.0`, `vitest@^3.0.0`.

## Global Constraints

- Extension ID MUST be `"org.asyar.polyglot-dict"` and `asyarSdk` MUST be `"^4.15.0"`.
- `manifest.json` permissions MUST only use allowed slugs from `capabilities.json`: `["network", "selection:read", "clipboard:read", "clipboard:write", "notifications:send", "storage:read", "storage:write", "cache:read", "cache:write", "tools:register", "extension:invoke"]`.
- Every lookup MUST return all three translations (`de`, `en`, `tr`), German grammar details when applicable (`article: "der" | "die" | "das"`, `plural`, `conjugation`), and at least one German and one English example sentence with Turkish translations and highlighted German articles (`der/die/das/den/dem/des/ein/eine/einen/einem`).
- Color coding for German articles: `der` = blue (`#3b82f6`), `die` = rose/red (`#ec4899`), `das` = emerald/green (`#10b981`).

---

### Task 1: Project Scaffold, Manifest, Build Config & Shared Types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `manifest.json`
- Create: `view.html`
- Create: `worker.html`
- Create: `src/types.ts`

**Interfaces:**
- Produces: All shared TypeScript interfaces in `src/types.ts` (`ArticleGender`, `GermanNounGrammar`, `GermanVerbConjugation`, `GermanGrammarInfo`, `ExampleSentence`, `HighlightSegment`, `DictionaryMeaningGroup`, `PolyglotEntry`, `VocabItem`, `VocabFilter`, `NetworkLike`, `CacheLike`, `StorageLike`).

- [ ] **Step 1: Create `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json`, `view.html`, `worker.html`, and `src/types.ts`**
- [ ] **Step 2: Run `npm install --ignore-scripts` and verify TypeScript setup**
- [ ] **Step 3: Commit scaffold**

---

### Task 2: German Wiktionary Parser, Curated Lexicon & Article Highlighter (`Agent 1`)

**Files:**
- Create: `src/engine/wiktionary.ts`
- Test: `tests/wiktionary.test.ts`

**Interfaces:**
- Consumes: `ArticleGender`, `GermanGrammarInfo`, `ExampleSentence`, `HighlightSegment`, `NetworkLike` from `src/types.ts`
- Produces:
  - `parseWiktionaryWikitext(word: string, wikitext: string): GermanGrammarInfo | null`
  - `fetchGermanWiktionary(network: NetworkLike, germanWord: string): Promise<{ grammar: GermanGrammarInfo | null; rawExamples: string[]; synonyms: string[] }>`
  - `lookupCuratedGermanGrammar(germanWord: string): GermanGrammarInfo | null`
  - `extractArticleAndNoun(germanPhrase: string): { article?: ArticleGender; noun: string }`
  - `segmentSentenceWithArticleHighlights(sentence: string, targetNoun?: string, defaultArticle?: ArticleGender): HighlightSegment[]`

- [ ] **Step 1: Write unit tests in `tests/wiktionary.test.ts` covering noun gender (`der/die/das`), plural extraction, verb conjugations (`Präsens`, `Präteritum`, `Perfekt`), `{{Beispiele}}` parsing, curated lexicon lookup, and `segmentSentenceWithArticleHighlights`**
- [ ] **Step 2: Implement `src/engine/wiktionary.ts` and verify all tests pass with `npx vitest run tests/wiktionary.test.ts`**

---

### Task 3: Trilingual Google Rich Dictionary, English Dictionary & Example Sentence Engine (`Agent 2`)

**Files:**
- Create: `src/engine/translators.ts`
- Test: `tests/translators.test.ts`

**Interfaces:**
- Consumes: `DictionaryMeaningGroup`, `ExampleSentence`, `GermanGrammarInfo`, `NetworkLike` from `src/types.ts`
- Produces:
  - `fetchGoogleRichTranslate(network: NetworkLike, params: { text: string; from: string; to: string }): Promise<GoogleRichResult>`
  - `fetchEnglishDictionary(network: NetworkLike, englishWord: string): Promise<{ ipa?: string; definitions: string[]; examples: string[]; synonyms: string[] }>`
  - `buildFallbackExamples(params: { deWord: string; enWord: string; trWord: string; grammar?: GermanGrammarInfo | null }): ExampleSentence[]`

- [ ] **Step 1: Write unit tests in `tests/translators.test.ts` for Google `translate_a/single` parser (`dt=t,bd,ex,ss,rm`), English Dictionary API parser, and fallback example sentence generator with German articles**
- [ ] **Step 2: Implement `src/engine/translators.ts` and verify all tests pass with `npx vitest run tests/translators.test.ts`**

---

### Task 4: Hybrid Polyglot Orchestrator, Cache & Optional AI Enrichment (`Agent 3`)

**Files:**
- Create: `src/engine/orchestrator.ts`
- Test: `tests/orchestrator.test.ts`

**Interfaces:**
- Consumes: `src/types.ts`, `src/engine/wiktionary.ts`, `src/engine/translators.ts`
- Produces:
  - `lookupPolyglot(deps: { network: NetworkLike; cache?: CacheLike }, query: string, opts?: { aiProvider?: string; aiApiKey?: string }): Promise<PolyglotEntry>`

- [ ] **Step 1: Write unit tests in `tests/orchestrator.test.ts` verifying trilingual resolution (`DE`, `EN`, `TR`), German grammar hydration, example translation into Turkish, caching, and graceful degradation**
- [ ] **Step 2: Implement `src/engine/orchestrator.ts` and verify all tests pass with `npx vitest run tests/orchestrator.test.ts`**

---

### Task 5: Vocabulary Book & Spaced-Repetition Flashcard Store (`Agent 4`)

**Files:**
- Create: `src/store/vocab.ts`
- Test: `tests/vocab.test.ts`

**Interfaces:**
- Consumes: `PolyglotEntry`, `VocabItem`, `VocabFilter`, `StorageLike` from `src/types.ts`
- Produces:
  - `saveWordToVocab(storage: StorageLike, entry: PolyglotEntry): Promise<VocabItem>`
  - `listVocabItems(storage: StorageLike): Promise<VocabItem[]>`
  - `filterVocabItems(items: VocabItem[], filter: VocabFilter, searchQuery?: string): VocabItem[]`
  - `toggleVocabFavorite(storage: StorageLike, id: string): Promise<VocabItem | null>`
  - `removeVocabItem(storage: StorageLike, id: string): Promise<void>`
  - `recordFlashcardReview(storage: StorageLike, id: string, outcome: "easy" | "again"): Promise<VocabItem | null>`
  - `getDueFlashcards(items: VocabItem[], filter?: VocabFilter): VocabItem[]`

- [ ] **Step 1: Write unit tests in `tests/vocab.test.ts` for saving, deduplicating, filtering by `der/die/das`/`verb`, and flashcard mastery progression**
- [ ] **Step 2: Implement `src/store/vocab.ts` and verify all tests pass with `npx vitest run tests/vocab.test.ts`**

---

### Task 6: UI Component — `PolyglotView.svelte` (`Agent 5`)

**Files:**
- Create: `src/views/PolyglotView.svelte`

**Interfaces:**
- Consumes: `lookupPolyglot`, `segmentSentenceWithArticleHighlights`, `saveWordToVocab`, `PolyglotEntry`
- Produces: `PolyglotView` Svelte 5 component for trilingual lookup, color-coded `der/die/das` badge, plural & verb conjugation cards, and article-highlighted example sentences.

---

### Task 7: UI Components — `VocabView.svelte` & `FlashcardView.svelte` (`Agent 6`)

**Files:**
- Create: `src/views/VocabView.svelte`
- Create: `src/views/FlashcardView.svelte`

**Interfaces:**
- Consumes: `src/store/vocab.ts`, `segmentSentenceWithArticleHighlights`, `VocabItem`
- Produces: `VocabView` and `FlashcardView` Svelte 5 components.

---

### Task 8: Worker & View Entrypoints, Build, Asyar Installation & GitHub Push (`Agent 7`)

**Files:**
- Create: `src/worker.ts`
- Create: `src/view.ts`
- Create: `README.md`

- [ ] **Step 1: Implement `src/worker.ts` and `src/view.ts`**
- [ ] **Step 2: Run full test suite (`npx vitest run`) and production build (`npm run build`)**
- [ ] **Step 3: Install built extension to `/Users/goktus/Library/Application Support/org.asyar.app/extensions/org.asyar.polyglot-dict` and update consent in `settings.dat`**
- [ ] **Step 4: Commit and push to `https://github.com/AzrielTheHellrazor/Asyar-language-extension`**
