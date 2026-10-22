<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/awwwards.css";
  import { lookupPolyglot } from "../engine/orchestrator";
  import { segmentSentenceWithArticleHighlights } from "../engine/wiktionary";
  import {
    saveWordToVocab,
    listVocabItems,
    seedStarterGermanVocabIfEmpty
  } from "../store/vocab";
  import VocabView from "./VocabView.svelte";
  import FlashcardView from "./FlashcardView.svelte";
  import type {
    PolyglotEntry,
    ArticleGender,
    HighlightSegment
  } from "../types";

  let {
    context,
    network,
    actions,
    clipboard,
    storage,
    cache,
    interop,
    selection,
    searchBarAccessory,
    extensionId,
    initialMode = "lookup"
  } = $props();

  const DEFAULT_ENTRY: PolyglotEntry = {
    query: "das Buch",
    detectedLang: "de",
    timestamp: Date.now(),
    translations: {
      de: {
        lang: "de",
        primaryText: "das Buch",
        alternatives: ["das Werk", "der Band", "die Lektüre"],
        pronunciation: "buːx"
      },
      en: {
        lang: "en",
        primaryText: "book",
        alternatives: ["volume", "work", "publication"],
        pronunciation: "bʊk"
      },
      tr: {
        lang: "tr",
        primaryText: "kitap",
        alternatives: ["eser", "cilt", "yapıt"]
      }
    },
    germanGrammar: {
      word: "Buch",
      pos: "noun",
      cefrLevel: "A1",
      ipa: "buːx",
      noun: {
        article: "das",
        genderLabel: "Neutral (Nötr)",
        singular: "Buch",
        plural: "die Bücher",
        genitive: "des Buches"
      },
      grammarTip:
        "Nötr (das) isimdir; çoğulda kök ünlüsü Umlaut alır ve -er eki gelir: das Buch → die Bücher.",
      synonyms: ["Werk", "Band"]
    },
    englishDetails: {
      word: "book",
      ipa: "/bʊk/",
      definitions: ["A written or printed work consisting of pages bound in covers."],
      synonyms: ["volume", "tome"]
    },
    meanings: [],
    examples: [
      {
        id: "buch-1",
        language: "de",
        sentence: "Ich lese jeden Abend ein spannendes Buch auf Deutsch.",
        translationTr: "Her akşam Almanca heyecan verici bir kitap okuyorum.",
        translationEnOrDe: "I read an exciting book in German every evening.",
        articleUsed: "das",
        highlightedSegments: [
          { text: "Ich lese jeden Abend " },
          { text: "ein", isArticle: true, articleGender: "das" },
          { text: " spannendes " },
          { text: "Buch", isTargetWord: true, articleGender: "das" },
          { text: " auf Deutsch." }
        ],
        source: "curated"
      },
      {
        id: "buch-2",
        language: "de",
        sentence: "Die neuen Bücher liegen schon auf dem Schreibtisch.",
        translationTr: "Yeni kitaplar şimdiden çalışma masasının üzerinde duruyor.",
        translationEnOrDe: "The new books are already on the desk.",
        articleUsed: "das",
        highlightedSegments: [
          { text: "Die", isArticle: true, articleGender: "das" },
          { text: " neuen " },
          { text: "Bücher", isTargetWord: true, articleGender: "das" },
          { text: " liegen schon auf " },
          { text: "dem", isArticle: true, articleGender: "der" },
          { text: " Schreibtisch." }
        ],
        source: "curated"
      }
    ],
    synonyms: {
      de: ["das Werk", "der Band"],
      en: ["volume", "publication"]
    }
  };

  const QUICK_WORDS = [
    { label: "das Buch", gender: "das" as ArticleGender },
    { label: "der Schlüssel", gender: "der" as ArticleGender },
    { label: "die Entscheidung", gender: "die" as ArticleGender },
    { label: "verstehen" },
    { label: "sprechen" },
    { label: "experience" }
  ];

  let activeTab = $state<"dict" | "vocab" | "cards">("dict");
  let query = $state("das Buch");
  let entry = $state<PolyglotEntry>(DEFAULT_ENTRY);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let savedCount = $state(0);
  let savedToast = $state(false);
  let copiedKey = $state<string | null>(null);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function getSegments(ex: PolyglotEntry["examples"][number]): HighlightSegment[] {
    if (ex.highlightedSegments && ex.highlightedSegments.length > 0) {
      return ex.highlightedSegments;
    }
    if (ex.language === "de") {
      return segmentSentenceWithArticleHighlights(
        ex.sentence,
        entry.germanGrammar?.word ?? entry.translations.de.primaryText,
        entry.germanGrammar?.noun?.article
      );
    }
    return [{ text: ex.sentence }];
  }

  async function runLookup(rawQuery: string) {
    const clean = rawQuery.trim();
    if (!clean) return;
    query = clean;
    errorMsg = null;
    loading = true;

    try {
      const res = await lookupPolyglot(clean, { network, cache, storage });
      if (res) {
        entry = res;
      }
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Çeviri alınırken bir hata oluştu.";
    } finally {
      loading = false;
    }
  }

  function onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    query = val;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!val.trim()) return;
    debounceTimer = setTimeout(() => {
      runLookup(val);
    }, 240);
  }

  function onSubmit(e: Event) {
    e.preventDefault();
    if (debounceTimer) clearTimeout(debounceTimer);
    runLookup(query);
  }

  async function saveCurrent() {
    try {
      await saveWordToVocab(storage, entry);
      const all = await listVocabItems(storage);
      savedCount = all.length;
      savedToast = true;
      setTimeout(() => (savedToast = false), 1500);
    } catch {
      savedToast = true;
    }
  }

  async function copyText(text: string, key: string) {
    try {
      if (clipboard?.copyText) {
        await clipboard.copyText(text);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      copiedKey = key;
      setTimeout(() => {
        if (copiedKey === key) copiedKey = null;
      }, 1200);
    } catch {
      copiedKey = key;
    }
  }

  onMount(() => {
    searchInputEl?.focus();

    (async () => {
      try {
        const seeded = await seedStarterGermanVocabIfEmpty(storage);
        savedCount = seeded.length;
      } catch {
        // ignore
      }

      if (initialMode === "selection-lookup" && selection?.getSelectedText) {
        try {
          const text = await selection.getSelectedText();
          if (text && text.trim()) {
            await runLookup(text.trim());
          }
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  const article = $derived(entry.germanGrammar?.noun?.article);
  const noun = $derived(entry.germanGrammar?.noun);
  const verb = $derived(entry.germanGrammar?.verb);
</script>

{#if activeTab === "vocab"}
  <div class="launcher-wrap">
    <div class="top-nav-only">
      <div class="mode-tabs">
        <button type="button" class="tab-btn" onclick={() => (activeTab = "dict")}>
          Sözlük
        </button>
        <button type="button" class="tab-btn is-active" onclick={() => (activeTab = "vocab")}>
          Kelimelerim ({savedCount})
        </button>
        <button type="button" class="tab-btn" onclick={() => (activeTab = "cards")}>
          Kartlar
        </button>
      </div>
    </div>
    <VocabView
      {context}
      {actions}
      {clipboard}
      {storage}
      {interop}
      {searchBarAccessory}
      {extensionId}
      embedded={true}
      onOpenWord={(w: string) => {
        activeTab = "dict";
        runLookup(w);
      }}
      onStartCards={() => {
        activeTab = "cards";
      }}
    />
  </div>
{:else if activeTab === "cards"}
  <div class="launcher-wrap">
    <div class="top-nav-only">
      <div class="mode-tabs">
        <button type="button" class="tab-btn" onclick={() => (activeTab = "dict")}>
          Sözlük
        </button>
        <button type="button" class="tab-btn" onclick={() => (activeTab = "vocab")}>
          Kelimelerim ({savedCount})
        </button>
        <button type="button" class="tab-btn is-active" onclick={() => (activeTab = "cards")}>
          Kartlar
        </button>
      </div>
    </div>
    <FlashcardView
      {context}
      {actions}
      {storage}
      {interop}
      {extensionId}
      embedded={true}
      onBackToDict={() => (activeTab = "dict")}
    />
  </div>
{:else}
  <div class="launcher-wrap">
    <!-- TOP SEARCH & TAB BAR -->
    <div class="top-bar">
      <form class="search-box" onsubmit={onSubmit}>
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input
          bind:this={searchInputEl}
          type="search"
          class="search-input"
          value={query}
          oninput={onInput}
          placeholder="Almanca, İngilizce veya Türkçe kelime yazın..."
          autocomplete="off"
          spellcheck="false"
        />
        {#if loading}
          <span class="loading-dot">Çevriliyor…</span>
        {/if}
      </form>

      <div class="mode-tabs">
        <button type="button" class="tab-btn is-active" onclick={() => (activeTab = "dict")}>
          Sözlük
        </button>
        <button type="button" class="tab-btn" onclick={() => (activeTab = "vocab")}>
          Kelimelerim ({savedCount})
        </button>
        <button type="button" class="tab-btn" onclick={() => (activeTab = "cards")}>
          Kartlar
        </button>
      </div>
    </div>

    <!-- QUICK WORD CHIPS -->
    <div class="quick-bar">
      {#each QUICK_WORDS as item}
        <button
          type="button"
          class="quick-chip {item.gender ? `quick-chip--${item.gender}` : ''} {query.toLowerCase() === item.label.toLowerCase() ? 'is-selected' : ''}"
          onclick={() => runLookup(item.label)}
        >
          {item.label}
        </button>
      {/each}
    </div>

    {#if errorMsg}
      <div class="error-box" role="alert">{errorMsg}</div>
    {/if}

    <!-- WORD HEADER & GRAMMAR SUMMARY CARD -->
    <section class="word-card {article ? `word-card--${article}` : ''}">
      <div class="word-header">
        <div class="word-title-group">
          <h1 class="word-title">
            {#if noun}
              <span class="art-prefix art-prefix--{noun.article}">{noun.article}</span>
              {noun.singular}
            {:else if verb}
              {verb.infinitive}
            {:else}
              {entry.translations.de.primaryText}
            {/if}
          </h1>

          <div class="word-badges">
            {#if noun}
              <span class="badge badge--{noun.article}">
                {noun.genderLabel}
              </span>
              {#if noun.plural}
                <span class="badge">Çoğul: <strong>{noun.plural}</strong></span>
              {/if}
              {#if noun.genitive}
                <span class="badge">Genitiv: {noun.genitive}</span>
              {/if}
            {:else if verb}
              <span class="badge">Fiil ({verb.auxiliary || "haben"})</span>
              {#if verb.praesensErSieEs}
                <span class="badge">er/sie/es: <strong>{verb.praesensErSieEs}</strong></span>
              {/if}
              {#if verb.praeteritumIch}
                <span class="badge">Prät: <strong>{verb.praeteritumIch}</strong></span>
              {/if}
              {#if verb.perfekt}
                <span class="badge">Perfekt: <strong>{verb.perfekt}</strong></span>
              {/if}
            {/if}

            {#if entry.germanGrammar?.cefrLevel}
              <span class="badge">{entry.germanGrammar.cefrLevel}</span>
            {/if}
            {#if entry.germanGrammar?.ipa}
              <span class="badge">/{entry.germanGrammar.ipa}/</span>
            {/if}
          </div>
        </div>

        <div class="word-actions">
          <button type="button" class="action-btn" onclick={saveCurrent}>
            {savedToast ? "✓ Kaydedildi" : "★ Kaydet"}
          </button>
          <button
            type="button"
            class="action-btn"
            onclick={() =>
              copyText(
                `${entry.translations.de.primaryText} — ${entry.translations.en.primaryText} — ${entry.translations.tr.primaryText}`,
                "main"
              )}
          >
            {copiedKey === "main" ? "✓ Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </div>

      <!-- 3-LANGUAGE TRANSLATION ROW -->
      <div class="lang-grid">
        <div class="lang-cell">
          <div class="lang-label">🇩🇪 ALMANCA</div>
          <div class="lang-main">{entry.translations.de.primaryText}</div>
          {#if entry.translations.de.alternatives.length > 0}
            <div class="lang-alts">
              {#each entry.translations.de.alternatives.slice(0, 3) as alt}
                <button type="button" class="alt-tag" onclick={() => runLookup(alt)}>
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="lang-cell">
          <div class="lang-label">🇬🇧 İNGİLİZCE</div>
          <div class="lang-main">{entry.translations.en.primaryText}</div>
          {#if entry.translations.en.alternatives.length > 0}
            <div class="lang-alts">
              {#each entry.translations.en.alternatives.slice(0, 3) as alt}
                <button type="button" class="alt-tag" onclick={() => runLookup(alt)}>
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="lang-cell">
          <div class="lang-label">🇹🇷 TÜRKÇE</div>
          <div class="lang-main">{entry.translations.tr.primaryText}</div>
          {#if entry.translations.tr.alternatives.length > 0}
            <div class="lang-alts">
              {#each entry.translations.tr.alternatives.slice(0, 3) as alt}
                <button type="button" class="alt-tag" onclick={() => runLookup(alt)}>
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      {#if entry.germanGrammar?.grammarTip}
        <div class="grammar-tip">
          <span class="tip-label">İpucu:</span> {entry.germanGrammar.grammarTip}
        </div>
      {/if}
    </section>

    <!-- EXAMPLE SENTENCES -->
    <section class="examples-box">
      <div class="examples-header">
        <span class="section-label">ÖRNEK CÜMLELER &amp; ARTİKEL KULLANIMI</span>
        <div class="legend">
          <span class="legend-item legend-item--der">der/den/dem</span>
          <span class="legend-item legend-item--die">die/eine</span>
          <span class="legend-item legend-item--das">das/ein</span>
        </div>
      </div>

      <div class="examples-list">
        {#each entry.examples.slice(0, 3) as ex (ex.id)}
          <div class="example-item">
            <div class="example-content">
              <p class="example-de">
                {#each getSegments(ex) as seg}
                  {#if seg.isArticle}
                    <span class="hl-{seg.articleGender || article || 'das'}">{seg.text}</span>
                  {:else if seg.isTargetWord}
                    <span class="hl-target">{seg.text}</span>
                  {:else}
                    {seg.text}
                  {/if}
                {/each}
              </p>
              <p class="example-tr">
                🇹🇷 {ex.translationTr}
                {#if ex.translationEnOrDe}
                  <span class="example-en"> · 🇬🇧 {ex.translationEnOrDe}</span>
                {/if}
              </p>
            </div>
            <button
              type="button"
              class="copy-mini"
              onclick={() => copyText(ex.sentence, ex.id)}
              title="Cümleyi kopyala"
            >
              {copiedKey === ex.id ? "✓" : "Kopyala"}
            </button>
          </div>
        {/each}
      </div>
    </section>
  </div>
{/if}

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .top-nav-only {
    display: flex;
    justify-content: flex-end;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 0 10px;
    height: 38px;
  }

  .search-box:focus-within {
    border-color: var(--accent);
  }

  .search-icon {
    color: var(--text-muted);
    font-size: 15px;
    user-select: none;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 14px;
    height: 100%;
  }

  .search-input::placeholder {
    color: var(--text-subtle);
  }

  .loading-dot {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .mode-tabs {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .tab-btn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--text);
  }

  .tab-btn.is-active {
    background: var(--surface-hover);
    color: var(--text);
  }

  .quick-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .quick-chip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 9px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .quick-chip:hover,
  .quick-chip.is-selected {
    background: var(--surface-hover);
    color: var(--text);
    border-color: var(--border-strong);
  }

  .quick-chip--der {
    border-left: 3px solid var(--der-text);
  }

  .quick-chip--die {
    border-left: 3px solid var(--die-text);
  }

  .quick-chip--das {
    border-left: 3px solid var(--das-text);
  }

  .error-box {
    padding: 8px 12px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #FCA5A5;
    font-size: 12px;
  }

  .word-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .word-card--der {
    border-left: 4px solid var(--der-text);
  }

  .word-card--die {
    border-left: 4px solid var(--die-text);
  }

  .word-card--das {
    border-left: 4px solid var(--das-text);
  }

  .word-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .word-title-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .word-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .art-prefix--der {
    color: var(--der-text);
  }

  .art-prefix--die {
    color: var(--die-text);
  }

  .art-prefix--das {
    color: var(--das-text);
  }

  .word-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .word-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }

  .action-btn:hover {
    background: var(--surface-hover);
  }

  .lang-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .lang-cell {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lang-label {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .lang-main {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .lang-alts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .alt-tag {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .alt-tag:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }

  .grammar-tip {
    font-size: 12px;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    padding: 6px 10px;
  }

  .tip-label {
    color: var(--text);
    font-weight: 600;
  }

  .examples-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .examples-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .section-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .legend {
    display: flex;
    gap: 6px;
    font-size: 11px;
    font-family: var(--font-mono);
  }

  .legend-item {
    padding: 1px 6px;
    border-radius: 4px;
  }

  .legend-item--der {
    color: var(--der-text);
    background: var(--der-bg);
  }

  .legend-item--die {
    color: var(--die-text);
    background: var(--die-bg);
  }

  .legend-item--das {
    color: var(--das-text);
    background: var(--das-bg);
  }

  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .example-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
  }

  .example-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .example-de {
    margin: 0;
    font-size: 14px;
    color: var(--text);
    line-height: 1.4;
  }

  .example-tr {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .example-en {
    color: var(--text-subtle);
  }

  .copy-mini {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .copy-mini:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }

  @media (max-width: 600px) {
    .top-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .lang-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
