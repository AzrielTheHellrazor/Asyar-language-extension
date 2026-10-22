<script lang="ts">
  import { onMount } from "svelte";
  import { ClipboardItemType } from "asyar-sdk/view";
  import { lookupPolyglot } from "../engine/orchestrator";
  import { segmentSentenceWithArticleHighlights } from "../engine/wiktionary";
  import { saveWordToVocab } from "../store/vocab";
  import type {
    PolyglotEntry,
    ArticleGender,
    HighlightSegment,
    ExampleSentence
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
    initialMode = "lookup" // "lookup" | "selection-lookup"
  } = $props();

  const QUICK_SUGGESTIONS: Array<{
    query: string;
    label: string;
    tag: string;
    gender?: ArticleGender;
  }> = [
    { query: "das Buch", label: "das Buch", tag: "Neutral · Nötr", gender: "das" },
    { query: "sprechen", label: "sprechen", tag: "Fiil · Verb" },
    { query: "anahtar", label: "anahtar", tag: "TR → DE/EN" },
    { query: "experience", label: "experience", tag: "EN → DE/TR" },
    { query: "der Tisch", label: "der Tisch", tag: "Maskulin · Eril", gender: "der" },
    { query: "die Entscheidung", label: "die Entscheidung", tag: "Feminin · Dişil", gender: "die" }
  ];

  let query = $state("");
  let entry = $state<PolyglotEntry | null>(null);
  let loading = $state(false);
  let errorMessage = $state<string | null>(null);
  let focusMode = $state<"all" | "de" | "en">("all");
  let savedFeedback = $state(false);
  let copiedKey = $state<string | null>(null);
  let recentQueries = $state<string[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  let activeLookupId = 0;

  const detectedLangLabel = $derived.by(() => {
    if (!entry) return "";
    const code = String(entry.detectedLang || "").toLowerCase();
    if (code === "de") return "🇩🇪 Almanca (DE)";
    if (code === "en") return "🇬🇧 İngilizce (EN)";
    if (code === "tr") return "🇹🇷 Türkçe (TR)";
    return `🌐 ${entry.detectedLang.toUpperCase()}`;
  });

  const deArticle = $derived.by<ArticleGender | undefined>(() => {
    return entry?.germanGrammar?.noun?.article ?? entry?.translations?.de?.article;
  });

  const dePlural = $derived.by<string | undefined>(() => {
    return entry?.germanGrammar?.noun?.plural ?? entry?.translations?.de?.plural;
  });

  const allSynonyms = $derived.by(() => {
    if (!entry) return { de: [] as string[], en: [] as string[] };
    const deSet = new Set<string>([
      ...(entry.synonyms?.de ?? []),
      ...(entry.germanGrammar?.synonyms ?? [])
    ]);
    const enSet = new Set<string>([
      ...(entry.synonyms?.en ?? []),
      ...(entry.englishDetails?.synonyms ?? [])
    ]);
    return {
      de: Array.from(deSet).filter(Boolean),
      en: Array.from(enSet).filter(Boolean)
    };
  });

  const filteredExamples = $derived.by<ExampleSentence[]>(() => {
    if (!entry?.examples) return [];
    if (focusMode === "de") {
      const deOnly = entry.examples.filter((ex) => ex.language === "de");
      return deOnly.length > 0 ? deOnly : entry.examples;
    }
    if (focusMode === "en") {
      const enOnly = entry.examples.filter((ex) => ex.language === "en");
      return enOnly.length > 0 ? enOnly : entry.examples;
    }
    return entry.examples;
  });

  function getArticleMeta(article?: ArticleGender): {
    article: ArticleGender;
    label: string;
    shortLabel: string;
    color: string;
  } | null {
    if (article === "der") {
      return {
        article: "der",
        label: "der · Maskulin (Eril)",
        shortLabel: "Maskulin (Eril)",
        color: "#3b82f6"
      };
    }
    if (article === "die") {
      return {
        article: "die",
        label: "die · Feminin (Dişil)",
        shortLabel: "Feminin (Dişil)",
        color: "#ec4899"
      };
    }
    if (article === "das") {
      return {
        article: "das",
        label: "das · Neutral (Nötr)",
        shortLabel: "Neutral (Nötr)",
        color: "#10b981"
      };
    }
    return null;
  }

  function getExampleSegments(ex: ExampleSentence): HighlightSegment[] {
    if (ex.highlightedSegments && ex.highlightedSegments.length > 0) {
      return ex.highlightedSegments;
    }
    if (ex.language === "de") {
      try {
        const segments = segmentSentenceWithArticleHighlights(
          ex.sentence,
          entry?.germanGrammar?.word ?? entry?.translations?.de?.primaryText,
          entry?.germanGrammar?.noun?.article ?? ex.articleUsed
        );
        if (Array.isArray(segments) && segments.length > 0) {
          return segments;
        }
      } catch {
        // Fallback to plain segment if highlighter fails
      }
    }
    return [{ text: ex.sentence }];
  }

  async function copyText(text: string, key: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    try {
      await clipboard?.copy?.({
        type: ClipboardItemType.Text,
        value: clean
      });
    } catch {
      try {
        await navigator.clipboard?.writeText(clean);
      } catch {
        // Ignore clipboard fallback error
      }
    }
    copiedKey = key;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedKey = null;
    }, 1800);
  }

  async function handleSaveToVocab(): Promise<void> {
    if (!entry) return;
    try {
      await saveWordToVocab(storage, entry);
      savedFeedback = true;
      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        savedFeedback = false;
      }, 2600);
    } catch (err) {
      console.warn("[PolyglotView] Failed to save word to vocab:", err);
    }
  }

  function openVocabView(): void {
    try {
      interop?.launchCommand?.(extensionId, "vocab");
    } catch (err) {
      console.warn("[PolyglotView] Failed to launch vocab command:", err);
    }
  }

  function openFlashcardsView(): void {
    try {
      interop?.launchCommand?.(extensionId, "flashcards");
    } catch (err) {
      console.warn("[PolyglotView] Failed to launch flashcards command:", err);
    }
  }

  function scheduleLookup(delayMs = 320): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    const trimmed = query.trim();
    if (!trimmed) {
      loading = false;
      errorMessage = null;
      return;
    }
    debounceTimer = setTimeout(() => {
      void performLookup(trimmed);
    }, delayMs);
  }

  function selectQuickQuery(targetQuery: string): void {
    query = targetQuery;
    if (debounceTimer) clearTimeout(debounceTimer);
    void performLookup(targetQuery);
  }

  async function performLookup(rawQuery?: string): Promise<void> {
    const target = (rawQuery ?? query).trim();
    if (!target) {
      entry = null;
      errorMessage = null;
      loading = false;
      return;
    }

    const requestId = ++activeLookupId;
    loading = true;
    errorMessage = null;
    savedFeedback = false;

    try {
      const prefs = (context?.preferences?.values ?? {}) as Record<string, unknown>;
      const aiProvider =
        typeof prefs.aiProvider === "string" ? prefs.aiProvider : "gemini";
      const aiApiKey =
        typeof prefs.aiApiKey === "string" && prefs.aiApiKey.trim()
          ? prefs.aiApiKey.trim()
          : undefined;

      const result = await lookupPolyglot(
        { network, cache, storage } as any,
        target,
        { aiProvider, aiApiKey } as any
      );

      if (requestId !== activeLookupId) return;
      entry = result;
      recentQueries = [
        target,
        ...recentQueries.filter((item) => item.toLowerCase() !== target.toLowerCase())
      ].slice(0, 8);
      syncAsyarActions();
    } catch (err: any) {
      if (requestId !== activeLookupId) return;
      errorMessage =
        err?.message || "Sözlük sorgusu sırasında bir hata oluştu. Lütfen tekrar deneyin.";
    } finally {
      if (requestId === activeLookupId) {
        loading = false;
      }
    }
  }

  function syncAsyarActions(): void {
    if (!actions) return;
    try {
      actions.setActions?.([
        {
          id: `act_${extensionId}_save-word`,
          title: "Kelime Defterine Kaydet",
          shortcut: "⌘S"
        },
        {
          id: `act_${extensionId}_copy-de`,
          title: "Almanca Karşılığı Kopyala",
          shortcut: "⌘1"
        },
        {
          id: `act_${extensionId}_copy-en`,
          title: "İngilizce Karşılığı Kopyala",
          shortcut: "⌘2"
        },
        {
          id: `act_${extensionId}_copy-tr`,
          title: "Türkçe Karşılığı Kopyala",
          shortcut: "⌘3"
        },
        {
          id: `act_${extensionId}_copy-example`,
          title: "İlk Örnek Cümleyi Kopyala",
          shortcut: "⌘E"
        },
        {
          id: `act_${extensionId}_open-vocab`,
          title: "Kelime Defterini Aç",
          shortcut: "⌘B"
        },
        {
          id: `act_${extensionId}_open-flashcards`,
          title: "Flashcard Tekrarını Aç",
          shortcut: "⌘F"
        }
      ]);
    } catch {
      // Ignore if host does not require setActions
    }
  }

  function registerAllActionHandlers(): void {
    if (!actions?.registerActionHandler) return;

    actions.registerActionHandler(`act_${extensionId}_save-word`, async () => {
      await handleSaveToVocab();
    });

    actions.registerActionHandler(`act_${extensionId}_copy-de`, async () => {
      if (!entry) return;
      const deVal = deArticle
        ? `${deArticle} ${entry.translations.de.primaryText}`
        : entry.translations.de.primaryText;
      await copyText(deVal, "de");
    });

    actions.registerActionHandler(`act_${extensionId}_copy-en`, async () => {
      if (!entry) return;
      await copyText(entry.translations.en.primaryText, "en");
    });

    actions.registerActionHandler(`act_${extensionId}_copy-tr`, async () => {
      if (!entry) return;
      await copyText(entry.translations.tr.primaryText, "tr");
    });

    actions.registerActionHandler(`act_${extensionId}_copy-example`, async () => {
      const firstEx = entry?.examples?.[0];
      if (!firstEx) return;
      await copyText(
        `${firstEx.sentence} — ${firstEx.translationTr}`,
        `ex-${firstEx.id}`
      );
    });

    actions.registerActionHandler(`act_${extensionId}_open-vocab`, () => {
      openVocabView();
    });

    actions.registerActionHandler(`act_${extensionId}_open-flashcards`, () => {
      openFlashcardsView();
    });
  }

  onMount(() => {
    registerAllActionHandlers();
    syncAsyarActions();

    // Respect defaultFocus preference if configured
    const prefFocus = context?.preferences?.values?.defaultFocus;
    if (prefFocus === "de" || prefFocus === "en" || prefFocus === "all") {
      focusMode = prefFocus;
    }

    // Listen to searchBarAccessory dropdown changes if supported
    try {
      searchBarAccessory?.onChange?.((val: string) => {
        if (val === "all" || val === "de" || val === "en") {
          focusMode = val;
        }
      });
    } catch {
      // Ignore accessory binding error
    }

    const onWindowMessage = (e: MessageEvent) => {
      if (e.source === window.parent && e.data?.type === "asyar:view:search") {
        query = e.data.payload?.query ?? "";
        scheduleLookup();
      }
    };

    window.addEventListener("message", onWindowMessage);

    void (async () => {
      try {
        const pending = await storage?.get?.("ui:pendingQuery");
        if (typeof pending === "string" && pending.trim().length > 0) {
          const cleanPending = pending.trim();
          query = cleanPending;
          await storage?.delete?.("ui:pendingQuery");
          await performLookup(cleanPending);
          return;
        }
      } catch {
        // Ignore storage read error
      }

      if (initialMode === "selection-lookup") {
        try {
          const selectedText = await selection?.getSelectedText?.();
          if (typeof selectedText === "string" && selectedText.trim().length > 0) {
            const cleanSelection = selectedText.trim();
            query = cleanSelection;
            await performLookup(cleanSelection);
          }
        } catch {
          // Ignore selection read error
        }
      }
    })();

    return () => {
      window.removeEventListener("message", onWindowMessage);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (feedbackTimer) clearTimeout(feedbackTimer);
      if (copyTimer) clearTimeout(copyTimer);
    };
  });
</script>

<div class="polyglot-shell">
  <!-- Top Search & Navigation Bar -->
  <header class="top-bar">
    <div class="search-row">
      <div class="search-input-wrap">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          class="search-input"
          placeholder="Almanca, İngilizce veya Türkçe kelime/cümle yazın (örn. das Buch, sprechen, anahtar)..."
          bind:value={query}
          oninput={() => scheduleLookup(320)}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              if (debounceTimer) clearTimeout(debounceTimer);
              void performLookup(query);
            } else if (e.key === "Escape" && query) {
              query = "";
              entry = null;
              errorMessage = null;
            }
          }}
        />
        {#if loading}
          <span class="loading-spinner" aria-label="Yükleniyor"></span>
        {/if}
        {#if query.length > 0}
          <button
            type="button"
            class="clear-btn"
            title="Aramayı Temizle"
            onclick={() => {
              query = "";
              entry = null;
              errorMessage = null;
            }}
          >
            ✕
          </button>
        {/if}
      </div>

      <div class="nav-actions">
        {#if entry}
          <button
            type="button"
            class="save-vocab-btn {savedFeedback ? 'is-saved' : ''}"
            onclick={handleSaveToVocab}
          >
            {#if savedFeedback}
              <span>✅ Kelime Defterine Kaydedildi</span>
            {:else}
              <span>⭐ Kelime Defterine Kaydet</span>
            {/if}
          </button>
        {/if}

        <button
          type="button"
          class="secondary-nav-btn"
          title="Kelime Defterini Aç"
          onclick={openVocabView}
        >
          📚 Kelime Defteri
        </button>

        <button
          type="button"
          class="secondary-nav-btn"
          title="Flashcard Tekrarını Aç"
          onclick={openFlashcardsView}
        >
          🎴 Flashcards
        </button>
      </div>
    </div>

    <!-- Subbar: Focus Filter + Detected Language + Quick Chips -->
    <div class="sub-bar">
      <div class="focus-tabs" role="tablist" aria-label="Görünüm Odağı">
        <button
          type="button"
          class="focus-tab {focusMode === 'all' ? 'active' : ''}"
          onclick={() => (focusMode = "all")}
        >
          Tümü (DE · EN · TR)
        </button>
        <button
          type="button"
          class="focus-tab {focusMode === 'de' ? 'active' : ''}"
          onclick={() => (focusMode = "de")}
        >
          🇩🇪 Almanca & Artikel
        </button>
        <button
          type="button"
          class="focus-tab {focusMode === 'en' ? 'active' : ''}"
          onclick={() => (focusMode = "en")}
        >
          🇬🇧 İngilizce Sözlük
        </button>
      </div>

      {#if entry}
        <div class="meta-pills">
          <span class="detected-pill">Kaynak: {detectedLangLabel}</span>
          {#if entry.germanGrammar?.cefrLevel}
            <span class="cefr-pill">CEFR {entry.germanGrammar.cefrLevel}</span>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="content-scroll">
    {#if errorMessage}
      <div class="error-banner" role="alert">
        <div class="error-title">⚠️ Sorgu Hatası</div>
        <p class="error-desc">{errorMessage}</p>
        <button
          type="button"
          class="retry-btn"
          onclick={() => performLookup(query)}
        >
          Tekrar Dene
        </button>
      </div>
    {/if}

    {#if !entry && !loading && !errorMessage}
      <!-- Empty / Welcome State with Quick Suggestion Chips -->
      <section class="empty-state">
        <div class="empty-hero">
          <div class="empty-flags">🇩🇪 · 🇬🇧 · 🇹🇷</div>
          <h1 class="empty-title">Polyglot Sözlük & Almanca Gramer</h1>
          <p class="empty-subtitle">
            Üç dilli anlık çeviri, renk kodlu Almanca <strong>der / die / das</strong> artikel
            analizi, çoğul & fiil çekim tabloları ve bağlamsal örnek cümleler.
          </p>
        </div>

        <div class="suggestions-panel">
          <div class="panel-label">✨ Hızlı Örnek Sorgular (Tıklayın)</div>
          <div class="suggestion-chips">
            {#each QUICK_SUGGESTIONS as item}
              <button
                type="button"
                class="suggestion-chip {item.gender ? `gender-${item.gender}` : ''}"
                onclick={() => selectQuickQuery(item.query)}
              >
                <span class="chip-word">{item.label}</span>
                <span class="chip-tag">{item.tag}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="article-legend-grid">
          <div class="legend-card gender-der">
            <div class="legend-badge">der</div>
            <div class="legend-info">
              <strong>Maskulin (Eril)</strong>
              <span>Mavi renk kodu (#3b82f6) · örn. der Tisch</span>
            </div>
          </div>
          <div class="legend-card gender-die">
            <div class="legend-badge">die</div>
            <div class="legend-info">
              <strong>Feminin (Dişil)</strong>
              <span>Pembe/Gül renk kodu (#ec4899) · örn. die Entscheidung</span>
            </div>
          </div>
          <div class="legend-card gender-das">
            <div class="legend-badge">das</div>
            <div class="legend-info">
              <strong>Neutral (Nötr)</strong>
              <span>Zümrüt yeşili renk kodu (#10b981) · örn. das Buch</span>
            </div>
          </div>
        </div>
      </section>
    {/if}

    {#if loading && !entry}
      <section class="skeleton-wrap" aria-busy="true">
        <div class="skeleton-grid">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
        <div class="skeleton-wide"></div>
        <div class="skeleton-wide"></div>
      </section>
    {/if}

    {#if entry}
      <!-- 1. Trilingual Translation Header Grid (DE · EN · TR) -->
      <section class="trilingual-grid" aria-label="Üç Dilli Çeviri Kartları">
        <!-- German Card -->
        <article
          class="lang-card de-card {deArticle ? `card-gender-${deArticle}` : ''} {focusMode === 'de' ? 'is-focused' : ''}"
        >
          <div class="lang-card-header">
            <div class="lang-title">
              <span class="lang-flag">🇩🇪</span>
              <span class="lang-name">Almanca (Deutsch)</span>
            </div>
            <button
              type="button"
              class="copy-icon-btn"
              title="Almanca karşılığı kopyala"
              onclick={() =>
                copyText(
                  deArticle
                    ? `${deArticle} ${entry!.translations.de.primaryText}`
                    : entry!.translations.de.primaryText,
                  "de"
                )}
            >
              {copiedKey === "de" ? "✓ Kopyalandı" : "📋 Kopyala"}
            </button>
          </div>

          <div class="lang-primary-row">
            {#if deArticle}
              <span class="article-pill pill-{deArticle}">{deArticle}</span>
            {/if}
            <span class="primary-word">{entry.translations.de.primaryText}</span>
          </div>

          {#if dePlural || entry.germanGrammar?.ipa || entry.translations.de.pronunciation}
            <div class="lang-submeta">
              {#if dePlural}
                <span class="plural-badge">Pl: {dePlural}</span>
              {/if}
              {#if entry.germanGrammar?.ipa || entry.translations.de.pronunciation}
                <span class="ipa-text">
                  /{entry.germanGrammar?.ipa ?? entry.translations.de.pronunciation}/
                </span>
              {/if}
            </div>
          {/if}

          {#if entry.translations.de.alternatives?.length > 0}
            <div class="alt-list">
              {#each entry.translations.de.alternatives.slice(0, 5) as alt}
                <button
                  type="button"
                  class="alt-chip"
                  onclick={() => selectQuickQuery(alt)}
                >
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </article>

        <!-- English Card -->
        <article class="lang-card en-card {focusMode === 'en' ? 'is-focused' : ''}">
          <div class="lang-card-header">
            <div class="lang-title">
              <span class="lang-flag">🇬🇧</span>
              <span class="lang-name">İngilizce (English)</span>
            </div>
            <button
              type="button"
              class="copy-icon-btn"
              title="İngilizce karşılığı kopyala"
              onclick={() => copyText(entry!.translations.en.primaryText, "en")}
            >
              {copiedKey === "en" ? "✓ Kopyalandı" : "📋 Kopyala"}
            </button>
          </div>

          <div class="lang-primary-row">
            <span class="primary-word">{entry.translations.en.primaryText}</span>
          </div>

          {#if entry.translations.en.pronunciation || entry.englishDetails?.ipa}
            <div class="lang-submeta">
              <span class="ipa-text">
                {entry.translations.en.pronunciation ?? entry.englishDetails?.ipa}
              </span>
            </div>
          {/if}

          {#if entry.translations.en.alternatives?.length > 0}
            <div class="alt-list">
              {#each entry.translations.en.alternatives.slice(0, 5) as alt}
                <button
                  type="button"
                  class="alt-chip"
                  onclick={() => selectQuickQuery(alt)}
                >
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </article>

        <!-- Turkish Card -->
        <article class="lang-card tr-card">
          <div class="lang-card-header">
            <div class="lang-title">
              <span class="lang-flag">🇹🇷</span>
              <span class="lang-name">Türkçe (Turkish)</span>
            </div>
            <button
              type="button"
              class="copy-icon-btn"
              title="Türkçe karşılığı kopyala"
              onclick={() => copyText(entry!.translations.tr.primaryText, "tr")}
            >
              {copiedKey === "tr" ? "✓ Kopyalandı" : "📋 Kopyala"}
            </button>
          </div>

          <div class="lang-primary-row">
            <span class="primary-word">{entry.translations.tr.primaryText}</span>
          </div>

          {#if entry.translations.tr.alternatives?.length > 0}
            <div class="alt-list">
              {#each entry.translations.tr.alternatives.slice(0, 5) as alt}
                <button
                  type="button"
                  class="alt-chip"
                  onclick={() => selectQuickQuery(alt)}
                >
                  {alt}
                </button>
              {/each}
            </div>
          {/if}
        </article>
      </section>

      <!-- 2. Almanca Gramer & Artikel Kartı (German Grammar Card) -->
      {#if entry.germanGrammar && focusMode !== "en"}
        {@const grammar = entry.germanGrammar}
        {@const nounMeta = getArticleMeta(grammar.noun?.article)}
        <section
          class="grammar-section {nounMeta ? `grammar-theme-${nounMeta.article}` : ''}"
          aria-label="Almanca Gramer ve Artikel Kartı"
        >
          <div class="section-header">
            <div class="section-title-group">
              <h2 class="section-title">🇩🇪 Almanca Gramer & Artikel Kartı</h2>
              <span class="pos-badge">{grammar.pos.toUpperCase()}</span>
              {#if grammar.cefrLevel}
                <span class="cefr-badge">Seviye: {grammar.cefrLevel}</span>
              {/if}
              {#if grammar.ipa}
                <span class="ipa-badge">/{grammar.ipa}/</span>
              {/if}
            </div>
          </div>

          {#if grammar.noun && nounMeta}
            <!-- Noun Article & Declension Grid -->
            <div class="noun-showcase">
              <div class="giant-article-banner banner-{nounMeta.article}">
                <span class="giant-article-word">{nounMeta.article}</span>
                <div class="giant-article-details">
                  <span class="giant-article-label">{nounMeta.label}</span>
                  <span class="giant-noun-full">
                    {nounMeta.article} {grammar.noun.singular}
                  </span>
                </div>
              </div>

              <div class="noun-forms-grid">
                <div class="form-box">
                  <span class="form-label">Tekil (Singular)</span>
                  <strong class="form-value">
                    <span class="inline-art art-{nounMeta.article}">{nounMeta.article}</span>
                    {grammar.noun.singular}
                  </strong>
                </div>

                <div class="form-box">
                  <span class="form-label">Çoğul (Plural)</span>
                  <strong class="form-value">
                    {grammar.noun.plural || "—"}
                  </strong>
                </div>

                {#if grammar.noun.genitive}
                  <div class="form-box">
                    <span class="form-label">Genitiv (-s/-es)</span>
                    <strong class="form-value">{grammar.noun.genitive}</strong>
                  </div>
                {/if}

                {#if grammar.cefrLevel}
                  <div class="form-box">
                    <span class="form-label">CEFR Seviyesi</span>
                    <strong class="form-value cefr-highlight">{grammar.cefrLevel}</strong>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          {#if grammar.verb}
            <!-- Verb Conjugation Grid -->
            <div class="verb-showcase">
              <div class="verb-meta-bar">
                {#if grammar.verb.auxiliary}
                  <span class="aux-badge aux-{grammar.verb.auxiliary}">
                    Yardımcı Fiil (Hilfsverb): <strong>{grammar.verb.auxiliary}</strong>
                  </span>
                {/if}
                {#if grammar.verb.separable}
                  <span class="separable-badge">
                    ✂️ Ayrılabilir Fiil (Trennbares Verb)
                  </span>
                {/if}
              </div>

              <div class="verb-conj-grid">
                <div class="form-box">
                  <span class="form-label">Infinitiv (Mastar)</span>
                  <strong class="form-value">{grammar.verb.infinitive}</strong>
                </div>

                <div class="form-box">
                  <span class="form-label">Präsens (du / er,sie,es)</span>
                  <strong class="form-value">
                    {#if grammar.verb.praesensDu && grammar.verb.praesensErSieEs}
                      {grammar.verb.praesensDu} · {grammar.verb.praesensErSieEs}
                    {:else}
                      {grammar.verb.praesensErSieEs ?? grammar.verb.praesensIch ?? "—"}
                    {/if}
                  </strong>
                </div>

                <div class="form-box">
                  <span class="form-label">Präteritum (ich / er)</span>
                  <strong class="form-value">
                    {grammar.verb.praeteritumIch || "—"}
                  </strong>
                </div>

                <div class="form-box">
                  <span class="form-label">Perfekt (hat/ist + Partizip II)</span>
                  <strong class="form-value">
                    {grammar.verb.perfekt ?? grammar.verb.partizipII ?? "—"}
                  </strong>
                </div>
              </div>
            </div>
          {/if}

          {#if grammar.grammarTip}
            <div class="grammar-tip-box">
              <span class="tip-icon">💡</span>
              <div class="tip-content">
                <strong>Gramer & Artikel İpucu:</strong>
                <span>{grammar.grammarTip}</span>
              </div>
            </div>
          {/if}
        </section>
      {/if}

      <!-- 3. Artikel Vurgulu Örnek Cümleler (CRITICAL FEATURE) -->
      {#if filteredExamples.length > 0}
        <section class="examples-section" aria-label="Bağlam ve Artikel Vurgulu Örnek Cümleler">
          <div class="section-header">
            <div class="section-title-group">
              <h2 class="section-title">📝 Bağlam & Artikel Vurgulu Örnek Cümleler</h2>
              <span class="count-badge">{filteredExamples.length} cümle</span>
            </div>
            <div class="inline-article-key">
              <span class="key-dot dot-der">der</span>
              <span class="key-dot dot-die">die</span>
              <span class="key-dot dot-das">das</span>
            </div>
          </div>

          <div class="examples-list">
            {#each filteredExamples as ex (ex.id)}
              {@const segments = getExampleSegments(ex)}
              <article class="example-card">
                <div class="example-top">
                  <div class="example-sentence-wrap">
                    <span class="example-lang-flag" title={ex.language === "de" ? "Almanca Örnek" : "İngilizce Örnek"}>
                      {ex.language === "de" ? "🇩🇪" : "🇬🇧"}
                    </span>
                    <p class="example-sentence">
                      {#if ex.language === "de"}
                        {#each segments as seg}
                          {#if seg.isArticle}
                            <span
                              class="seg-article seg-gender-{seg.articleGender ?? ex.articleUsed ?? deArticle ?? 'der'}"
                            >{seg.text}</span>
                          {:else if seg.isTargetWord}
                            <span
                              class="seg-target seg-target-{seg.articleGender ?? ex.articleUsed ?? deArticle ?? 'neutral'}"
                            >{seg.text}</span>
                          {:else}
                            <span>{seg.text}</span>
                          {/if}
                        {/each}
                      {:else}
                        {ex.sentence}
                      {/if}
                    </p>
                  </div>

                  <div class="example-card-actions">
                    {#if ex.articleUsed}
                      <span class="ex-article-tag pill-{ex.articleUsed}">
                        {ex.articleUsed}
                      </span>
                    {/if}
                    <button
                      type="button"
                      class="copy-ex-btn"
                      title="Örnek cümleyi kopyala"
                      onclick={() =>
                        copyText(`${ex.sentence} — ${ex.translationTr}`, `ex-${ex.id}`)}
                    >
                      {copiedKey === `ex-${ex.id}` ? "✓" : "📋"}
                    </button>
                  </div>
                </div>

                <div class="example-translations">
                  <div class="tr-translation">
                    <span class="tr-flag">🇹🇷</span>
                    <span>{ex.translationTr}</span>
                  </div>
                  {#if ex.translationEnOrDe}
                    <div class="cross-translation">
                      <span class="cross-flag">{ex.language === "de" ? "🇬🇧" : "🇩🇪"}</span>
                      <span>{ex.translationEnOrDe}</span>
                    </div>
                  {/if}
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      <!-- 4. Eş Anlamlılar (Synonyms) & İngilizce Tanımlar -->
      {#if allSynonyms.de.length > 0 || allSynonyms.en.length > 0 || (entry.englishDetails?.definitions?.length ?? 0) > 0}
        <section class="details-grid">
          {#if allSynonyms.de.length > 0 || allSynonyms.en.length > 0}
            <div class="detail-panel">
              <h3 class="subsection-title">🔗 Eş Anlamlılar (Synonyme / Synonyms)</h3>

              {#if allSynonyms.de.length > 0}
                <div class="synonym-group">
                  <span class="syn-lang-label">🇩🇪 Almanca:</span>
                  <div class="synonym-pills">
                    {#each allSynonyms.de as syn}
                      <button
                        type="button"
                        class="synonym-pill"
                        onclick={() => selectQuickQuery(syn)}
                      >
                        {syn}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if allSynonyms.en.length > 0}
                <div class="synonym-group">
                  <span class="syn-lang-label">🇬🇧 İngilizce:</span>
                  <div class="synonym-pills">
                    {#each allSynonyms.en as syn}
                      <button
                        type="button"
                        class="synonym-pill"
                        onclick={() => selectQuickQuery(syn)}
                      >
                        {syn}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if entry.englishDetails?.definitions && entry.englishDetails.definitions.length > 0}
            <div class="detail-panel">
              <h3 class="subsection-title">
                🇬🇧 İngilizce Sözlük Tanımları ({entry.englishDetails.word})
              </h3>
              <ul class="en-definitions-list">
                {#each entry.englishDetails.definitions.slice(0, 5) as def}
                  <li>{def}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}

      <!-- 5. Kelime Türleri & Sözlük Detayları (entry.meanings) -->
      {#if entry.meanings && entry.meanings.length > 0}
        <section class="meanings-section" aria-label="Sözlük Anlam Grupları ve Kelime Türleri">
          <div class="section-header">
            <h2 class="section-title">📖 Kelime Türleri & Kapsamlı Sözlük Karşılıkları</h2>
          </div>

          <div class="meanings-grid">
            {#each entry.meanings as group}
              <div class="meaning-card">
                <div class="meaning-card-header">
                  <span class="meaning-lang">
                    {group.language === "de" ? "🇩🇪 DE" : group.language === "en" ? "🇬🇧 EN" : "🇹🇷 TR"}
                  </span>
                  <span class="meaning-pos">{group.pos}</span>
                </div>

                <div class="meaning-terms">
                  {#each group.terms.slice(0, 6) as term}
                    <div class="meaning-term-row">
                      <button
                        type="button"
                        class="term-word-btn"
                        onclick={() => selectQuickQuery(term.word)}
                      >
                        {#if term.article}
                          <span class="mini-article pill-{term.article}">{term.article}</span>
                        {/if}
                        <strong>{term.word}</strong>
                      </button>
                      {#if term.reverseTranslations?.length > 0}
                        <span class="term-reverse">
                          {term.reverseTranslations.slice(0, 4).join(", ")}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Quick Suggestions Footer Bar -->
      <footer class="footer-suggestions">
        <span class="footer-label">Hızlı Geçiş:</span>
        <div class="footer-chips">
          {#each QUICK_SUGGESTIONS as item}
            <button
              type="button"
              class="mini-chip"
              onclick={() => selectQuickQuery(item.query)}
            >
              {item.label}
            </button>
          {/each}
        </div>
      </footer>
    {/if}
  </main>
</div>

<style>
  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
  }

  .polyglot-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background: var(--bg-primary, #0f1117);
    color: var(--text-primary, #f3f4f6);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", sans-serif;
    overflow: hidden;
  }

  /* Header & Search Bar */
  .top-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 10px;
    background: var(--bg-secondary, #161922);
    border-bottom: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .search-input-wrap {
    position: relative;
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-md, 10px);
    padding: 0 10px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .search-input-wrap:focus-within {
    border-color: var(--accent-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .search-icon {
    font-size: 14px;
    opacity: 0.7;
    margin-right: 8px;
    user-select: none;
  }

  .search-input {
    width: 100%;
    height: 36px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary, #f3f4f6);
    font-size: var(--font-size-md, 14px);
  }

  .search-input::placeholder {
    color: var(--text-tertiary, #6b7280);
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    padding: 4px 6px;
    font-size: 12px;
    border-radius: 6px;
  }

  .clear-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--text-primary, #ffffff);
  }

  .loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(59, 130, 246, 0.3);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
    margin-right: 6px;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .save-vocab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.14);
    color: #fbbf24;
    font-size: var(--font-size-sm, 12.5px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .save-vocab-btn:hover {
    background: rgba(245, 158, 11, 0.24);
    transform: translateY(-1px);
  }

  .save-vocab-btn.is-saved {
    border-color: rgba(16, 185, 129, 0.55);
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
  }

  .secondary-nav-btn {
    padding: 7px 11px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-secondary, #d1d5db);
    font-size: var(--font-size-sm, 12.5px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .secondary-nav-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #ffffff);
  }

  .sub-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .focus-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .focus-tab {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary, #9ca3af);
    font-size: var(--font-size-xs, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .focus-tab:hover {
    color: var(--text-primary, #f3f4f6);
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  }

  .focus-tab.active {
    background: rgba(59, 130, 246, 0.16);
    border-color: rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    font-weight: 600;
  }

  .meta-pills {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .detected-pill,
  .cefr-pill {
    font-size: 11.5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-secondary, #d1d5db);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
  }

  .cefr-pill {
    background: rgba(139, 92, 246, 0.16);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-weight: 600;
  }

  /* Main Scrollable Body */
  .content-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 8px;
    max-width: 820px;
    margin: 0 auto;
    width: 100%;
  }

  .empty-hero {
    text-align: center;
    padding: 14px 12px;
  }

  .empty-flags {
    font-size: 28px;
    margin-bottom: 8px;
  }

  .empty-title {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  .empty-subtitle {
    margin: 0 auto;
    max-width: 560px;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-secondary, #9ca3af);
  }

  .suggestions-panel {
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 12px);
    padding: 14px;
  }

  .panel-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #9ca3af);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .suggestion-chips {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .suggestion-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    border-radius: 9px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-primary, #f3f4f6);
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease;
  }

  .suggestion-chip:hover {
    transform: translateY(-1px);
    border-color: var(--accent-primary, #3b82f6);
  }

  .suggestion-chip.gender-der {
    border-left: 3px solid #3b82f6;
  }
  .suggestion-chip.gender-die {
    border-left: 3px solid #ec4899;
  }
  .suggestion-chip.gender-das {
    border-left: 3px solid #10b981;
  }

  .chip-word {
    font-weight: 600;
    font-size: 13.5px;
  }

  .chip-tag {
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
  }

  .article-legend-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .legend-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    border-radius: 10px;
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
  }

  .legend-badge {
    font-weight: 800;
    font-size: 14px;
    padding: 5px 10px;
    border-radius: 7px;
    color: #ffffff;
  }

  .legend-card.gender-der .legend-badge {
    background: #3b82f6;
  }
  .legend-card.gender-die .legend-badge {
    background: #ec4899;
  }
  .legend-card.gender-das .legend-badge {
    background: #10b981;
  }

  .legend-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
  }

  .legend-info span {
    color: var(--text-secondary, #9ca3af);
    font-size: 11px;
  }

  /* Trilingual Cards Grid */
  .trilingual-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .lang-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: var(--radius-md, 12px);
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.09));
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .lang-card.is-focused {
    border-color: var(--accent-primary, #3b82f6);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.25);
  }

  .lang-card.card-gender-der {
    border-top: 3px solid #3b82f6;
  }
  .lang-card.card-gender-die {
    border-top: 3px solid #ec4899;
  }
  .lang-card.card-gender-das {
    border-top: 3px solid #10b981;
  }

  .lang-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .lang-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #9ca3af);
  }

  .copy-icon-btn {
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, #9ca3af);
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .copy-icon-btn:hover {
    color: var(--text-primary, #ffffff);
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  }

  .lang-primary-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .primary-word {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
    word-break: break-word;
  }

  .article-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 800;
    color: #ffffff;
  }

  .pill-der {
    background: #3b82f6;
  }
  .pill-die {
    background: #ec4899;
  }
  .pill-das {
    background: #10b981;
  }

  .lang-submeta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
  }

  .plural-badge {
    padding: 2px 7px;
    border-radius: 5px;
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-secondary, #d1d5db);
    font-weight: 500;
  }

  .ipa-text {
    color: var(--text-secondary, #9ca3af);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
  }

  .alt-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
  }

  .alt-chip {
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.07));
    color: var(--text-secondary, #d1d5db);
    font-size: 11.5px;
    cursor: pointer;
  }

  .alt-chip:hover {
    color: var(--text-primary, #ffffff);
    border-color: var(--accent-primary, #3b82f6);
  }

  /* German Grammar Section */
  .grammar-section {
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 12px);
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .grammar-section.grammar-theme-der {
    border-left: 4px solid #3b82f6;
  }
  .grammar-section.grammar-theme-die {
    border-left: 4px solid #ec4899;
  }
  .grammar-section.grammar-theme-das {
    border-left: 4px solid #10b981;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .section-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .section-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  .pos-badge,
  .cefr-badge,
  .ipa-badge,
  .count-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-secondary, #d1d5db);
  }

  .cefr-badge {
    background: rgba(139, 92, 246, 0.18);
    color: #c4b5fd;
  }

  .noun-showcase {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .giant-article-banner {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 10px;
  }

  .giant-article-banner.banner-der {
    background: rgba(59, 130, 246, 0.14);
    border: 1px solid rgba(59, 130, 246, 0.38);
  }
  .giant-article-banner.banner-die {
    background: rgba(236, 72, 153, 0.14);
    border: 1px solid rgba(236, 72, 153, 0.38);
  }
  .giant-article-banner.banner-das {
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.38);
  }

  .giant-article-word {
    font-size: 26px;
    font-weight: 900;
    padding: 6px 14px;
    border-radius: 8px;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .banner-der .giant-article-word {
    background: #3b82f6;
  }
  .banner-die .giant-article-word {
    background: #ec4899;
  }
  .banner-das .giant-article-word {
    background: #10b981;
  }

  .giant-article-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .giant-article-label {
    font-size: 12.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.9;
  }

  .giant-noun-full {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary, #ffffff);
  }

  .noun-forms-grid,
  .verb-conj-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }

  .form-box {
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.07));
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-label {
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-value {
    font-size: 14.5px;
    color: var(--text-primary, #f9fafb);
  }

  .inline-art {
    font-weight: 800;
    margin-right: 3px;
  }
  .art-der {
    color: #3b82f6;
  }
  .art-die {
    color: #ec4899;
  }
  .art-das {
    color: #10b981;
  }

  .verb-showcase {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .verb-meta-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .aux-badge,
  .separable-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
  }

  .aux-haben {
    border-color: rgba(59, 130, 246, 0.4);
    color: #93c5fd;
  }

  .aux-sein {
    border-color: rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
  }

  .grammar-tip-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.09);
    border: 1px solid rgba(59, 130, 246, 0.25);
    font-size: 13px;
    line-height: 1.45;
  }

  .tip-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Examples Section */
  .examples-section {
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 12px);
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .inline-article-key {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .key-dot {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    color: #ffffff;
  }

  .dot-der {
    background: #3b82f6;
  }
  .dot-die {
    background: #ec4899;
  }
  .dot-das {
    background: #10b981;
  }

  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .example-card {
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .example-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .example-sentence-wrap {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .example-lang-flag {
    font-size: 15px;
    flex-shrink: 0;
  }

  .example-sentence {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--text-primary, #f9fafb);
  }

  .seg-article {
    display: inline-block;
    padding: 1px 6px;
    margin: 0 1px;
    border-radius: 5px;
    font-weight: 800;
    color: #ffffff;
  }

  .seg-gender-der {
    background: #3b82f6;
  }
  .seg-gender-die {
    background: #ec4899;
  }
  .seg-gender-das {
    background: #10b981;
  }

  .seg-target {
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 2px;
  }

  .seg-target-der {
    text-decoration-color: #3b82f6;
    color: #93c5fd;
  }
  .seg-target-die {
    text-decoration-color: #ec4899;
    color: #f9a8d4;
  }
  .seg-target-das {
    text-decoration-color: #10b981;
    color: #6ee7b7;
  }
  .seg-target-neutral {
    text-decoration-color: #60a5fa;
  }

  .example-card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .ex-article-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    color: #ffffff;
  }

  .copy-ex-btn {
    background: transparent;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    color: var(--text-secondary, #9ca3af);
    border-radius: 6px;
    padding: 3px 7px;
    font-size: 12px;
    cursor: pointer;
  }

  .copy-ex-btn:hover {
    color: var(--text-primary, #ffffff);
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  .example-translations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 24px;
    border-left: 2px solid var(--separator, rgba(255, 255, 255, 0.12));
  }

  .tr-translation,
  .cross-translation {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13.5px;
    color: var(--text-secondary, #d1d5db);
  }

  .cross-translation {
    font-size: 12.5px;
    opacity: 0.82;
  }

  /* Synonyms & English Details */
  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .detail-panel {
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.09));
    border-radius: var(--radius-md, 12px);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .subsection-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  .synonym-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .syn-lang-label {
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
    font-weight: 600;
  }

  .synonym-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .synonym-pill {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.12));
    background: var(--bg-tertiary, #1f2430);
    color: var(--text-primary, #e5e7eb);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .synonym-pill:hover {
    border-color: var(--accent-primary, #3b82f6);
    color: #60a5fa;
  }

  .en-definitions-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary, #d1d5db);
    line-height: 1.45;
  }

  /* Meanings Section */
  .meanings-section {
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.09));
    border-radius: var(--radius-md, 12px);
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .meanings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
  }

  .meaning-card {
    background: var(--bg-tertiary, #1f2430);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.07));
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .meaning-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-secondary, #9ca3af);
    text-transform: uppercase;
  }

  .meaning-terms {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .meaning-term-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }

  .term-word-btn {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--text-primary, #f3f4f6);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-align: left;
  }

  .term-word-btn:hover strong {
    color: #60a5fa;
    text-decoration: underline;
  }

  .mini-article {
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    color: #ffffff;
  }

  .term-reverse {
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
    text-align: right;
  }

  /* Footer Quick Suggestions */
  .footer-suggestions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  .footer-label {
    font-size: 11.5px;
    color: var(--text-secondary, #9ca3af);
  }

  .footer-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mini-chip {
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    background: var(--bg-secondary, #161922);
    color: var(--text-secondary, #d1d5db);
    font-size: 11.5px;
    cursor: pointer;
  }

  .mini-chip:hover {
    color: var(--text-primary, #ffffff);
    border-color: var(--accent-primary, #3b82f6);
  }

  /* Error & Skeletons */
  .error-banner {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .error-title {
    font-weight: 700;
    font-size: 13.5px;
    color: #f87171;
  }

  .error-desc {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-secondary, #d1d5db);
  }

  .retry-btn {
    align-self: flex-start;
    padding: 5px 11px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    font-size: 12px;
    cursor: pointer;
  }

  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .skeleton-card {
    height: 110px;
    border-radius: 12px;
    background: var(--bg-secondary, #161922);
    animation: pulse 1.3s ease-in-out infinite;
  }

  .skeleton-wide {
    height: 130px;
    border-radius: 12px;
    background: var(--bg-secondary, #161922);
    animation: pulse 1.3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (max-width: 760px) {
    .trilingual-grid,
    .article-legend-grid,
    .skeleton-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
