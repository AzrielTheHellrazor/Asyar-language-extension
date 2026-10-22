<script lang="ts">
  import { onMount } from "svelte";
  import type {
    ArticleGender,
    ExampleSentence,
    HighlightSegment,
    StorageLike,
    VocabFilter,
    VocabItem
  } from "../types";
  import {
    filterVocabItems,
    listVocabItems,
    removeVocabItem,
    seedStarterGermanVocabIfEmpty,
    toggleVocabFavorite
  } from "../store/vocab";
  import { segmentSentenceWithArticleHighlights } from "../engine/wiktionary";

  let {
    context,
    actions,
    clipboard,
    storage,
    interop,
    searchBarAccessory,
    extensionId
  }: {
    context?: any;
    actions?: any;
    clipboard?: any;
    storage: StorageLike;
    interop?: any;
    searchBarAccessory?: any;
    extensionId?: string;
  } = $props();

  let items = $state<VocabItem[]>([]);
  let loading = $state<boolean>(true);
  let activeFilter = $state<VocabFilter>("all");
  let searchQuery = $state<string>("");
  let selectedId = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);

  const filterCategories: Array<{
    id: VocabFilter;
    label: string;
    dot?: ArticleGender;
    icon?: string;
  }> = [
    { id: "all", label: "Tümü" },
    { id: "der", label: "der", dot: "der" },
    { id: "die", label: "die", dot: "die" },
    { id: "das", label: "das", dot: "das" },
    { id: "verb", label: "Fiiller", icon: "⚡" },
    { id: "favorites", label: "Favoriler", icon: "⭐" }
  ];

  let filteredItems = $derived(
    filterVocabItems(items, activeFilter, searchQuery)
  );

  let categoryCounts = $derived({
    all: filterVocabItems(items, "all", searchQuery).length,
    der: filterVocabItems(items, "der", searchQuery).length,
    die: filterVocabItems(items, "die", searchQuery).length,
    das: filterVocabItems(items, "das", searchQuery).length,
    verb: filterVocabItems(items, "verb", searchQuery).length,
    english: filterVocabItems(items, "english", searchQuery).length,
    favorites: filterVocabItems(items, "favorites", searchQuery).length
  });

  let selected = $derived.by(() => {
    if (filteredItems.length === 0) return null;
    if (selectedId) {
      const found = filteredItems.find((item) => item.id === selectedId);
      if (found) return found;
    }
    return filteredItems[0];
  });

  function isValidFilter(val: string): val is VocabFilter {
    return (
      val === "all" ||
      val === "der" ||
      val === "die" ||
      val === "das" ||
      val === "verb" ||
      val === "english" ||
      val === "favorites"
    );
  }

  function stripLeadingArticle(text: string): string {
    return text.replace(/^(der|die|das)\s+/i, "").trim();
  }

  function getArticleGenderLabel(article?: ArticleGender): string {
    if (article === "der") return "Maskulin (Eril)";
    if (article === "die") return "Feminin (Dişil)";
    if (article === "das") return "Neutral (Nötr)";
    return "";
  }

  function getPosLabel(pos: VocabItem["pos"]): string {
    switch (pos) {
      case "noun":
        return "İsim (Nomen)";
      case "verb":
        return "Fiil (Verb)";
      case "adjective":
        return "Sıfat (Adjektiv)";
      case "adverb":
        return "Zarf (Adverb)";
      case "phrase":
        return "İfade / Kalıp";
      default:
        return "Kelime";
    }
  }

  function getSentenceSegments(
    example: ExampleSentence,
    item: VocabItem
  ): HighlightSegment[] {
    if (example.highlightedSegments && example.highlightedSegments.length > 0) {
      return example.highlightedSegments;
    }
    return segmentSentenceWithArticleHighlights(
      example.sentence,
      stripLeadingArticle(item.deText),
      example.articleUsed ?? item.article
    );
  }

  async function loadVocabulary() {
    loading = true;
    try {
      await seedStarterGermanVocabIfEmpty(storage);
      const loaded = await listVocabItems(storage);
      items = loaded;
      if (loaded.length > 0 && !selectedId) {
        selectedId = loaded[0].id;
      }
    } finally {
      loading = false;
    }
  }

  async function handleToggleFavorite(id: string, event?: MouseEvent) {
    event?.stopPropagation();
    const updated = await toggleVocabFavorite(storage, id);
    if (updated) {
      items = items.map((item) => (item.id === id ? updated : item));
    } else {
      items = await listVocabItems(storage);
    }
  }

  async function handleRemoveItem(id: string) {
    await removeVocabItem(storage, id);
    items = items.filter((item) => item.id !== id);
    if (selectedId === id) {
      selectedId = filteredItems[0]?.id ?? null;
    }
  }

  async function navigateToCommand(commandId: "lookup" | "flashcards") {
    const extId = extensionId || "org.asyar.polyglot-dict";
    try {
      await storage?.set?.("ui:activeCommand", commandId);
    } catch {
      // ignore storage errors
    }

    window.dispatchEvent(
      new CustomEvent("polyglot:navigate", {
        detail: { commandId, extensionId: extId }
      })
    );
    window.dispatchEvent(
      new CustomEvent("asyar:navigate", {
        detail: { commandId, extensionId: extId }
      })
    );

    try {
      if (typeof interop?.launchCommand === "function") {
        await interop.launchCommand({ extensionId: extId, commandId });
        return;
      }
      if (typeof interop?.invokeCommand === "function") {
        await interop.invokeCommand(extId, commandId);
        return;
      }
      if (typeof interop?.executeCommand === "function") {
        await interop.executeCommand(commandId);
        return;
      }
      if (typeof context?.request === "function") {
        await context.request("navigate", { commandId });
      }
    } catch {
      // Fallback handled by custom events
    }
  }

  async function handleOpenInDictionary(item: VocabItem) {
    const cleanWord = stripLeadingArticle(item.deText);
    await storage.set("ui:pendingQuery", cleanWord || item.deText);
    await navigateToCommand("lookup");
  }

  async function handleOpenFlashcards() {
    await navigateToCommand("flashcards");
  }

  async function handleCopyText(text: string, label: string) {
    try {
      if (typeof clipboard?.writeText === "function") {
        await clipboard.writeText(text);
      } else if (typeof clipboard?.copy === "function") {
        await clipboard.copy(text);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      copyFeedback = `${label} kopyalandı`;
      setTimeout(() => {
        copyFeedback = null;
      }, 1800);
    } catch {
      // ignore clipboard error
    }
  }

  onMount(() => {
    void loadVocabulary();

    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "asyar:view:search") {
        const q = data.payload?.query ?? data.query ?? "";
        searchQuery = typeof q === "string" ? q : "";
      } else if (
        data.type === "asyar:view:accessory" ||
        data.type === "asyar:view:accessory-change"
      ) {
        const val = data.payload?.value ?? data.value ?? "";
        if (typeof val === "string" && isValidFilter(val)) {
          activeFilter = val;
        }
      }
    };

    window.addEventListener("message", handleWindowMessage);

    let unsubscribeAccessory: (() => void) | undefined;
    try {
      if (typeof searchBarAccessory?.onChange === "function") {
        const maybeUnsub = searchBarAccessory.onChange((value: string) => {
          if (typeof value === "string" && isValidFilter(value)) {
            activeFilter = value;
          }
        });
        if (typeof maybeUnsub === "function") {
          unsubscribeAccessory = maybeUnsub;
        }
      }
    } catch {
      // ignore accessory binding error
    }

    try {
      const extId = extensionId || "org.asyar.polyglot-dict";
      if (typeof actions?.registerActionHandler === "function") {
        actions.registerActionHandler(`act_${extId}_open_lookup`, () => {
          if (selected) void handleOpenInDictionary(selected);
        });
        actions.registerActionHandler(`act_${extId}_open_flashcards`, () => {
          void handleOpenFlashcards();
        });
        actions.registerActionHandler(`act_${extId}_toggle_fav`, () => {
          if (selected) void handleToggleFavorite(selected.id);
        });
      }
    } catch {
      // ignore action registration error
    }

    return () => {
      window.removeEventListener("message", handleWindowMessage);
      unsubscribeAccessory?.();
    };
  });
</script>

<div class="vocab-shell">
  <!-- Top Filter & Search Bar -->
  <header class="vocab-toolbar">
    <div class="filter-pills" role="tablist" aria-label="Kelime Filtreleri">
      {#each filterCategories as cat (cat.id)}
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === cat.id}
          class="filter-pill"
          class:active={activeFilter === cat.id}
          class:pill-der={cat.dot === "der"}
          class:pill-die={cat.dot === "die"}
          class:pill-das={cat.dot === "das"}
          onclick={() => {
            activeFilter = cat.id;
          }}
        >
          {#if cat.dot}
            <span class="article-dot dot-{cat.dot}" aria-hidden="true"></span>
          {:else if cat.icon}
            <span class="pill-icon" aria-hidden="true">{cat.icon}</span>
          {/if}
          <span class="pill-label">{cat.label}</span>
          <span class="pill-count">{categoryCounts[cat.id]}</span>
        </button>
      {/each}
    </div>

    <div class="toolbar-right">
      <div class="inline-search">
        <span class="search-icon" aria-hidden="true">🔎</span>
        <input
          type="search"
          class="search-input"
          placeholder="Kelime ara (DE / EN / TR)..."
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button
            type="button"
            class="clear-btn"
            onclick={() => (searchQuery = "")}
            aria-label="Aramayı temizle"
          >
            ✕
          </button>
        {/if}
      </div>

      <button
        type="button"
        class="flashcard-cta-btn"
        onclick={handleOpenFlashcards}
      >
        🎴 Flashcard Çalış
      </button>
    </div>
  </header>

  {#if copyFeedback}
    <div class="toast-banner" role="status">{copyFeedback}</div>
  {/if}

  {#if loading}
    <div class="empty-state">
      <div class="spinner"></div>
      <p>Kelime defteri yükleniyor...</p>
    </div>
  {:else if filteredItems.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📚</div>
      <h3>Eşleşen kelime bulunamadı</h3>
      <p>
        {#if searchQuery || activeFilter !== "all"}
          Arama veya filtre kriterlerinize uygun kayıtlı kelime yok.
        {:else}
          Henüz kelime defterinizde kayıtlı kelime bulunmuyor.
        {/if}
      </p>
      {#if searchQuery || activeFilter !== "all"}
        <button
          type="button"
          class="reset-filter-btn"
          onclick={() => {
            activeFilter = "all";
            searchQuery = "";
          }}
        >
          Filtreleri Temizle
        </button>
      {/if}
    </div>
  {:else}
    <!-- Two-Pane Master-Detail Layout -->
    <div class="master-detail-grid">
      <!-- Left Pane: Word List -->
      <aside class="word-list-pane" aria-label="Kayıtlı Kelimeler">
        {#each filteredItems as item (item.id)}
          {@const isSelected = selected?.id === item.id}
          <div
            role="button"
            tabindex="0"
            class="word-row"
            class:selected={isSelected}
            onclick={() => (selectedId = item.id)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectedId = item.id;
              }
            }}
          >
            <div class="word-row-top">
              <div class="word-title-group">
                {#if item.article}
                  <span class="article-badge badge-{item.article}">
                    {item.article}
                  </span>
                {:else if item.pos === "verb"}
                  <span class="pos-badge badge-verb">Fiil</span>
                {:else}
                  <span class="pos-badge">{item.pos}</span>
                {/if}
                <span class="word-de">{stripLeadingArticle(item.deText)}</span>
              </div>

              <button
                type="button"
                class="fav-star-btn"
                class:is-fav={item.favorite}
                title={item.favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                onclick={(e) => handleToggleFavorite(item.id, e)}
              >
                {item.favorite ? "⭐" : "☆"}
              </button>
            </div>

            <div class="word-row-sub">
              <span class="sub-tr">🇹🇷 {item.trText}</span>
              <span class="sub-sep">·</span>
              <span class="sub-en">🇬🇧 {item.enText}</span>
            </div>

            <div class="word-row-footer">
              <div
                class="mastery-dots"
                title="Öğrenme Seviyesi: {item.masteryLevel} / 5"
                aria-label="Öğrenme Seviyesi {item.masteryLevel} / 5"
              >
                {#each [1, 2, 3, 4, 5] as dotIndex (dotIndex)}
                  <span
                    class="mastery-dot"
                    class:filled={item.masteryLevel >= dotIndex}
                  ></span>
                {/each}
              </div>

              {#if item.cefrLevel}
                <span class="cefr-mini">{item.cefrLevel}</span>
              {/if}
            </div>
          </div>
        {/each}
      </aside>

      <!-- Right Pane: Selected Word Detail Card -->
      <main class="detail-pane">
        {#if selected}
          <article class="detail-card">
            <!-- Header & Actions -->
            <div class="detail-header">
              <div class="detail-headline">
                <div class="headline-badges">
                  {#if selected.article}
                    <span class="article-hero-badge badge-{selected.article}">
                      {selected.article}
                    </span>
                    <span class="gender-tag tag-{selected.article}">
                      {getArticleGenderLabel(selected.article)}
                    </span>
                  {:else if selected.pos === "verb"}
                    <span class="pos-hero-badge badge-verb">Fiil · Verb</span>
                  {:else}
                    <span class="pos-hero-badge">{getPosLabel(selected.pos)}</span>
                  {/if}

                  {#if selected.cefrLevel}
                    <span class="cefr-badge">{selected.cefrLevel}</span>
                  {/if}

                  {#if selected.ipa}
                    <span class="ipa-badge">{selected.ipa}</span>
                  {/if}
                </div>

                <h2 class="hero-word">
                  {#if selected.article}
                    <span class="hero-article text-{selected.article}">
                      {selected.article}
                    </span>
                  {/if}
                  <span>{stripLeadingArticle(selected.deText)}</span>
                </h2>

                {#if selected.plural}
                  <div class="plural-line">
                    <span class="plural-label">Çoğul (Plural):</span>
                    <span class="plural-val">die {selected.plural.replace(/^die\s+/i, "")}</span>
                  </div>
                {/if}
              </div>

              <div class="mastery-box">
                <span class="mastery-label">Seviye ({selected.masteryLevel}/5)</span>
                <div class="mastery-dots large">
                  {#each [1, 2, 3, 4, 5] as dotIndex (dotIndex)}
                    <span
                      class="mastery-dot"
                      class:filled={selected.masteryLevel >= dotIndex}
                    ></span>
                  {/each}
                </div>
                <span class="review-stat">{selected.reviewCount} tekrar</span>
              </div>
            </div>

            <!-- Action Buttons Bar -->
            <div class="action-bar">
              <button
                type="button"
                class="action-btn primary"
                onclick={() => selected && handleOpenInDictionary(selected)}
              >
                🔍 Sözlükte Aç
              </button>

              <button
                type="button"
                class="action-btn accent"
                onclick={handleOpenFlashcards}
              >
                🎴 Flashcard Çalış
              </button>

              <button
                type="button"
                class="action-btn"
                class:fav-active={selected.favorite}
                onclick={() => selected && handleToggleFavorite(selected.id)}
              >
                ⭐ Favori {selected.favorite ? "(Açık)" : ""}
              </button>

              <button
                type="button"
                class="action-btn danger"
                onclick={() => selected && handleRemoveItem(selected.id)}
              >
                🗑️ Sil
              </button>
            </div>

            <!-- Trilingual Card Grid (DE / EN / TR) -->
            <section class="trilingual-grid" aria-label="Üç Dilli Karşılıklar">
              <div class="lang-card lang-de">
                <div class="lang-card-header">
                  <span class="lang-flag">🇩🇪 Almanca (DE)</span>
                  <button
                    type="button"
                    class="mini-copy"
                    onclick={() =>
                      selected &&
                      handleCopyText(
                        selected.article
                          ? `${selected.article} ${stripLeadingArticle(selected.deText)}`
                          : selected.deText,
                        "Almanca"
                      )}
                  >
                    Kopyala
                  </button>
                </div>
                <div class="lang-primary">
                  {#if selected.article}
                    <span class="inline-article text-{selected.article}">
                      {selected.article}
                    </span>
                  {/if}
                  {stripLeadingArticle(selected.deText)}
                </div>
                {#if selected.plural}
                  <div class="lang-meta">Çoğul: die {selected.plural.replace(/^die\s+/i, "")}</div>
                {/if}
              </div>

              <div class="lang-card lang-en">
                <div class="lang-card-header">
                  <span class="lang-flag">🇬🇧 İngilizce (EN)</span>
                  <button
                    type="button"
                    class="mini-copy"
                    onclick={() =>
                      selected && handleCopyText(selected.enText, "İngilizce")}
                  >
                    Kopyala
                  </button>
                </div>
                <div class="lang-primary">{selected.enText}</div>
                <div class="lang-meta">{getPosLabel(selected.pos)}</div>
              </div>

              <div class="lang-card lang-tr">
                <div class="lang-card-header">
                  <span class="lang-flag">🇹🇷 Türkçe (TR)</span>
                  <button
                    type="button"
                    class="mini-copy"
                    onclick={() =>
                      selected && handleCopyText(selected.trText, "Türkçe")}
                  >
                    Kopyala
                  </button>
                </div>
                <div class="lang-primary">{selected.trText}</div>
                <div class="lang-meta">Ana Anlam</div>
              </div>
            </section>

            <!-- Verb Conjugation Card (if Verb) -->
            {#if selected.verbConjugation}
              <section class="grammar-section verb-card">
                <div class="section-header">
                  <h3>⚡ Fiil Çekimi (Präsens · Präteritum · Perfekt)</h3>
                  <div class="verb-tags">
                    {#if selected.verbConjugation.auxiliary}
                      <span class="aux-tag">
                        Hilfsverb: <strong>{selected.verbConjugation.auxiliary}</strong>
                      </span>
                    {/if}
                    {#if selected.verbConjugation.separable}
                      <span class="sep-tag">Ayrılabilir Fiil (Trennbar)</span>
                    {/if}
                  </div>
                </div>

                <div class="conjugation-grid">
                  {#if selected.verbConjugation.praesensIch}
                    <div class="conj-item">
                      <span class="conj-label">Präsens (ich)</span>
                      <span class="conj-val">{selected.verbConjugation.praesensIch}</span>
                    </div>
                  {/if}
                  {#if selected.verbConjugation.praesensDu}
                    <div class="conj-item">
                      <span class="conj-label">Präsens (du)</span>
                      <span class="conj-val">{selected.verbConjugation.praesensDu}</span>
                    </div>
                  {/if}
                  {#if selected.verbConjugation.praesensErSieEs}
                    <div class="conj-item">
                      <span class="conj-label">Präsens (er/sie/es)</span>
                      <span class="conj-val">{selected.verbConjugation.praesensErSieEs}</span>
                    </div>
                  {/if}
                  {#if selected.verbConjugation.praeteritumIch}
                    <div class="conj-item">
                      <span class="conj-label">Präteritum</span>
                      <span class="conj-val">{selected.verbConjugation.praeteritumIch}</span>
                    </div>
                  {/if}
                  {#if selected.verbConjugation.perfekt}
                    <div class="conj-item highlight">
                      <span class="conj-label">Perfekt</span>
                      <span class="conj-val">{selected.verbConjugation.perfekt}</span>
                    </div>
                  {/if}
                </div>
              </section>
            {/if}

            <!-- Grammar Tip -->
            {#if selected.grammarTip}
              <section class="grammar-tip-box">
                <span class="tip-icon">💡</span>
                <div class="tip-content">
                  <strong>Gramer & Artikel İpucu:</strong>
                  <p>{selected.grammarTip}</p>
                </div>
              </section>
            {/if}

            <!-- Saved Example Sentences with Highlighted German Articles -->
            <section class="examples-section">
              <div class="section-header">
                <h3>📝 Artikel Vurgulu Örnek Cümleler ({selected.examples.length})</h3>
                <div class="legend-pills">
                  <span class="legend-item">
                    <span class="article-dot dot-der"></span> der (Eril)
                  </span>
                  <span class="legend-item">
                    <span class="article-dot dot-die"></span> die (Dişil)
                  </span>
                  <span class="legend-item">
                    <span class="article-dot dot-das"></span> das (Nötr)
                  </span>
                </div>
              </div>

              {#if selected.examples.length === 0}
                <p class="no-examples">Bu kelime için henüz örnek cümle eklenmemiş.</p>
              {:else}
                <div class="examples-list">
                  {#each selected.examples as ex (ex.id)}
                    {@const segments = getSentenceSegments(ex, selected)}
                    <div class="example-card">
                      <div class="example-sentence-line">
                        <span class="example-lang-tag">
                          {ex.language === "de" ? "🇩🇪 DE" : "🇬🇧 EN"}
                        </span>
                        <p class="sentence-text">
                          {#each segments as seg, idx (idx)}
                            {#if seg.isArticle && seg.articleGender}
                              <span class="hl-article hl-{seg.articleGender}">
                                {seg.text}
                              </span>
                            {:else if seg.isTargetWord}
                              <mark class="hl-target">{seg.text}</mark>
                            {:else}
                              <span>{seg.text}</span>
                            {/if}
                          {/each}
                        </p>
                      </div>

                      <div class="example-translations">
                        <div class="tr-line">
                          <span class="tr-flag">🇹🇷</span>
                          <span>{ex.translationTr}</span>
                        </div>
                        {#if ex.translationEnOrDe}
                          <div class="en-line">
                            <span class="tr-flag">🇬🇧</span>
                            <span>{ex.translationEnOrDe}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          </article>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  .vocab-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background: var(--bg-primary, #0f1117);
    color: var(--text-primary, #f3f4f6);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }

  .vocab-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-secondary, #161922);
    border-bottom: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
  }

  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.04));
    color: var(--text-secondary, #9ca3af);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-pill:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--text-primary, #f3f4f6);
  }

  .filter-pill.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.55);
    color: #fff;
  }

  .filter-pill.pill-der.active {
    background: rgba(59, 130, 246, 0.22);
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .filter-pill.pill-die.active {
    background: rgba(244, 63, 94, 0.22);
    border-color: #f43f5e;
    color: #fda4af;
  }

  .filter-pill.pill-das.active {
    background: rgba(16, 185, 129, 0.22);
    border-color: #10b981;
    color: #6ee7b7;
  }

  .article-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot-der {
    background: #3b82f6;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.6);
  }

  .dot-die {
    background: #f43f5e;
    box-shadow: 0 0 6px rgba(244, 63, 94, 0.6);
  }

  .dot-das {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .pill-count {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary, #e5e7eb);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inline-search {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 4px 10px;
  }

  .search-icon {
    font-size: 12px;
    margin-right: 6px;
    opacity: 0.7;
  }

  .search-input {
    background: transparent;
    border: none;
    color: var(--text-primary, #f3f4f6);
    font-size: 12.5px;
    width: 170px;
    outline: none;
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
  }

  .flashcard-cta-btn {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(139, 92, 246, 0.45);
    background: rgba(139, 92, 246, 0.18);
    color: #ddd6fe;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .flashcard-cta-btn:hover {
    background: rgba(139, 92, 246, 0.3);
  }

  .toast-banner {
    padding: 6px 16px;
    background: rgba(16, 185, 129, 0.18);
    border-bottom: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
    font-size: 12px;
    text-align: center;
  }

  /* Two-pane Master-Detail */
  .master-detail-grid {
    display: grid;
    grid-template-columns: 310px 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .word-list-pane {
    border-right: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-secondary, #13161f);
  }

  .word-row {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
    cursor: pointer;
    transition: all 0.14s ease;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .word-row:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  }

  .word-row.selected {
    background: var(--bg-selected, rgba(99, 102, 241, 0.15));
    border-color: rgba(99, 102, 241, 0.45);
  }

  .word-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .word-title-group {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .article-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .badge-der {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .badge-die {
    background: rgba(244, 63, 94, 0.2);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.4);
  }

  .badge-das {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.4);
  }

  .pos-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(168, 85, 247, 0.18);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.35);
  }

  .word-de {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #f9fafb);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fav-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    line-height: 1;
    opacity: 0.65;
    color: #fbbf24;
  }

  .fav-star-btn.is-fav,
  .fav-star-btn:hover {
    opacity: 1;
  }

  .word-row-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub-sep {
    opacity: 0.4;
  }

  .word-row-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mastery-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .mastery-dots.large .mastery-dot {
    width: 9px;
    height: 9px;
  }

  .mastery-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
  }

  .mastery-dot.filled {
    background: #10b981;
    box-shadow: 0 0 5px rgba(16, 185, 129, 0.6);
  }

  .cefr-mini {
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary, #d1d5db);
  }

  /* Right Pane Detail */
  .detail-pane {
    overflow-y: auto;
    padding: 18px 22px;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 820px;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    border-radius: 14px;
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
  }

  .headline-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .article-hero-badge,
  .pos-hero-badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .gender-tag {
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .tag-der {
    background: rgba(59, 130, 246, 0.12);
    color: #93c5fd;
  }

  .tag-die {
    background: rgba(244, 63, 94, 0.12);
    color: #fda4af;
  }

  .tag-das {
    background: rgba(16, 185, 129, 0.12);
    color: #6ee7b7;
  }

  .cefr-badge {
    font-size: 11.5px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.18);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .ipa-badge {
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
    font-family: monospace;
  }

  .hero-word {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .text-der {
    color: #60a5fa;
  }

  .text-die {
    color: #fb7185;
  }

  .text-das {
    color: #34d399;
  }

  .plural-line {
    margin-top: 6px;
    font-size: 13px;
    color: var(--text-secondary, #9ca3af);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .plural-val {
    color: var(--text-primary, #f3f4f6);
    font-weight: 600;
  }

  .mastery-box {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.06));
  }

  .mastery-label {
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
  }

  .review-stat {
    font-size: 11px;
    color: var(--text-tertiary, #6b7280);
  }

  /* Action Bar */
  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 9px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.12));
    background: var(--bg-secondary, #161922);
    color: var(--text-primary, #f3f4f6);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .action-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  .action-btn.primary {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(59, 130, 246, 0.45);
    color: #93c5fd;
  }

  .action-btn.accent {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ddd6fe;
  }

  .action-btn.fav-active {
    background: rgba(245, 158, 11, 0.18);
    border-color: rgba(245, 158, 11, 0.45);
    color: #fde68a;
  }

  .action-btn.danger {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    margin-left: auto;
  }

  /* Trilingual Grid */
  .trilingual-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .lang-card {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .lang-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .lang-flag {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary, #9ca3af);
  }

  .mini-copy {
    background: none;
    border: none;
    color: var(--text-tertiary, #6b7280);
    font-size: 11px;
    cursor: pointer;
    padding: 0;
  }

  .mini-copy:hover {
    color: var(--text-primary, #f3f4f6);
  }

  .lang-primary {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  .lang-meta {
    font-size: 11.5px;
    color: var(--text-secondary, #9ca3af);
  }

  /* Verb Conjugation */
  .grammar-section {
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bg-secondary, #161922);
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .section-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
  }

  .verb-tags {
    display: flex;
    gap: 6px;
    font-size: 11.5px;
  }

  .aux-tag,
  .sep-tag {
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(168, 85, 247, 0.16);
    color: #d8b4fe;
  }

  .conjugation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
    gap: 8px;
  }

  .conj-item {
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .conj-item.highlight {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(168, 85, 247, 0.1);
  }

  .conj-label {
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
  }

  .conj-val {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary, #f3f4f6);
  }

  /* Grammar Tip */
  .grammar-tip-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    font-size: 13px;
  }

  .tip-content p {
    margin: 4px 0 0;
    color: var(--text-secondary, #d1d5db);
    line-height: 1.45;
  }

  /* Examples Section */
  .examples-section {
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bg-secondary, #161922);
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.08));
  }

  .legend-pills {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11.5px;
    color: var(--text-secondary, #9ca3af);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .example-card {
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .example-sentence-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .example-lang-tag {
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary, #d1d5db);
    flex-shrink: 0;
  }

  .sentence-text {
    margin: 0;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--text-primary, #f9fafb);
  }

  .hl-article {
    display: inline-block;
    padding: 1px 6px;
    margin: 0 1px;
    border-radius: 5px;
    font-weight: 700;
  }

  .hl-der {
    background: rgba(59, 130, 246, 0.22);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.45);
  }

  .hl-die {
    background: rgba(244, 63, 94, 0.22);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.45);
  }

  .hl-das {
    background: rgba(16, 185, 129, 0.22);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.45);
  }

  .hl-target {
    background: rgba(250, 204, 21, 0.16);
    color: #fef08a;
    padding: 1px 4px;
    border-radius: 4px;
    font-weight: 700;
  }

  .example-translations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 4px;
    font-size: 12.5px;
    color: var(--text-secondary, #9ca3af);
  }

  .tr-line,
  .en-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px;
    text-align: center;
    color: var(--text-secondary, #9ca3af);
  }

  .empty-icon {
    font-size: 36px;
  }

  .reset-filter-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid rgba(99, 102, 241, 0.45);
    background: rgba(99, 102, 241, 0.18);
    color: #c7d2fe;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
  }
</style>
