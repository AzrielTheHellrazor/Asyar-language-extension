<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/awwwards.css";
  import {
    listVocabItems,
    removeVocabItem,
    toggleVocabFavorite,
    filterVocabItems,
    purgeStarterVocabOnce
  } from "../store/vocab";
  import { segmentSentenceWithArticleHighlights } from "../engine/wiktionary";
  import type {
    VocabItem,
    VocabFilter,
    HighlightSegment,
    ExampleSentence
  } from "../types";

  let {
    context,
    actions,
    clipboard,
    storage,
    interop,
    searchBarAccessory,
    extensionId,
    embedded = false,
    onCountChange,
    onOpenWord,
    onStartCards
  } = $props();

  let items = $state<VocabItem[]>([]);
  let activeFilter = $state<VocabFilter>("all");
  let searchQuery = $state("");
  let copiedId = $state<string | null>(null);

  const FILTERS: Array<{ id: VocabFilter; label: string; gender?: "der" | "die" | "das" }> = [
    { id: "all", label: "Tümü" },
    { id: "der", label: "der (Eril)", gender: "der" },
    { id: "die", label: "die (Dişil)", gender: "die" },
    { id: "das", label: "das (Nötr)", gender: "das" },
    { id: "verb", label: "Fiiller" }
  ];

  const filtered = $derived(filterVocabItems(items, activeFilter, searchQuery));

  function getSegments(ex: ExampleSentence, item: VocabItem): HighlightSegment[] {
    if (ex.highlightedSegments && ex.highlightedSegments.length > 0) {
      return ex.highlightedSegments;
    }
    const cleanDe = item.deText.replace(/^(der|die|das)\s+/i, "");
    return segmentSentenceWithArticleHighlights(ex.sentence, cleanDe, item.article);
  }

  async function refresh() {
    try {
      items = await purgeStarterVocabOnce(storage);
      onCountChange?.(items.length);
    } catch {
      // ignore
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeVocabItem(storage, id);
      items = await listVocabItems(storage);
      onCountChange?.(items.length);
    } catch {
      items = items.filter((i) => i.id !== id);
      onCountChange?.(items.length);
    }
  }

  async function handleToggleFav(id: string) {
    try {
      await toggleVocabFavorite(storage, id);
      items = await listVocabItems(storage);
    } catch {
      // ignore
    }
  }

  async function handleCopy(item: VocabItem) {
    const text = `${item.deText} — ${item.enText} — ${item.trText}`;
    try {
      if (clipboard?.copyText) {
        await clipboard.copyText(text);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      copiedId = item.id;
      setTimeout(() => {
        if (copiedId === item.id) copiedId = null;
      }, 1200);
    } catch {
      copiedId = item.id;
    }
  }

  onMount(() => {
    refresh();
  });
</script>

<div class={embedded ? "vocab-inner" : "launcher-wrap"}>
  <div class="vocab-top">
    <input
      type="search"
      class="vocab-search"
       bind:value={searchQuery}
      placeholder="Kaydedilen kelimelerde ara..."
      autocomplete="off"
    />

    {#if onStartCards}
      <button type="button" class="start-cards-btn" onclick={onStartCards}>
        Kartlarla Çalış →
      </button>
    {/if}
  </div>

  <div class="filter-bar">
    {#each FILTERS as f}
      <button
        type="button"
        class="filter-pill {f.gender ? `filter-pill--${f.gender}` : ''} {activeFilter === f.id ? 'is-active' : ''}"
        onclick={() => (activeFilter = f.id)}
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if filtered.length === 0}
    <div class="empty-state">
      {items.length === 0
        ? "Henüz kaydedilmiş kelime yok. Sözlükten ★ Kaydet ile kelime ekleyebilirsiniz."
        : "Bu filtreye uygun kayıtlı kelime bulunamadı."}
    </div>
  {:else}
    <div class="vocab-list">
      {#each filtered as item (item.id)}
        <div class="vocab-item {item.article ? `vocab-item--${item.article}` : ''}">
          <div class="vocab-main-row">
            <div class="vocab-word-group">
              <button
                type="button"
                class="vocab-word-btn"
                onclick={() => onOpenWord?.(item.deText)}
              >
                {#if item.article}
                  <span class="art-{item.article}">{item.article}</span>
                  {" "}{item.deText.replace(/^(der|die|das)\s+/i, "")}
                {:else}
                  {item.deText}
                {/if}
              </button>

              {#if item.plural}
                <span class="badge">Çoğul: {item.plural}</span>
              {:else if item.verbConjugation?.perfekt}
                <span class="badge">{item.verbConjugation.perfekt}</span>
              {/if}
              {#if item.cefrLevel}
                <span class="badge">{item.cefrLevel}</span>
              {/if}
            </div>

            <div class="vocab-meanings">
              <span class="meaning-tr">🇹🇷 {item.trText}</span>
              <span class="meaning-sep">·</span>
              <span class="meaning-en">🇬🇧 {item.enText}</span>
            </div>

            <div class="vocab-actions">
              <button
                type="button"
                class="icon-btn"
                onclick={() => handleToggleFav(item.id)}
                title="Favori"
              >
                {item.favorite ? "★" : "☆"}
              </button>
              <button
                type="button"
                class="icon-btn"
                onclick={() => handleCopy(item)}
              >
                {copiedId === item.id ? "✓" : "Kopyala"}
              </button>
              <button
                type="button"
                class="icon-btn icon-btn--del"
                onclick={() => handleRemove(item.id)}
              >
                Sil
              </button>
            </div>
          </div>

          {#if item.examples.length > 0}
            {@const ex = item.examples[0]}
            <div class="vocab-example">
              <span class="ex-de">
                {#each getSegments(ex, item) as seg}
                  {#if seg.isArticle}
                    <span class="hl-{seg.articleGender || item.article || 'das'}">{seg.text}</span>
                  {:else if seg.isTargetWord}
                    <span class="hl-target">{seg.text}</span>
                  {:else}
                    {seg.text}
                  {/if}
                {/each}
              </span>
              <span class="ex-tr"> — {ex.translationTr}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .vocab-inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vocab-top {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .vocab-search {
    flex: 1;
    height: 36px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 0 10px;
    color: var(--text);
    outline: none;
  }

  .vocab-search:focus {
    border-color: var(--accent);
  }

  .start-cards-btn {
    height: 36px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .filter-pill {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 9px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .filter-pill.is-active {
    background: var(--surface-hover);
    color: var(--text);
    border-color: var(--border-strong);
    font-weight: 600;
  }

  .filter-pill--der {
    border-left: 3px solid var(--der-text);
  }

  .filter-pill--die {
    border-left: 3px solid var(--die-text);
  }

  .filter-pill--das {
    border-left: 3px solid var(--das-text);
  }

  .empty-state {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
  }

  .vocab-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vocab-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .vocab-item--der {
    border-left: 4px solid var(--der-text);
  }

  .vocab-item--die {
    border-left: 4px solid var(--die-text);
  }

  .vocab-item--das {
    border-left: 4px solid var(--das-text);
  }

  .vocab-main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .vocab-word-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .vocab-word-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }

  .vocab-word-btn:hover {
    text-decoration: underline;
  }

  .art-der {
    color: var(--der-text);
  }

  .art-die {
    color: var(--die-text);
  }

  .art-das {
    color: var(--das-text);
  }

  .vocab-meanings {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .meaning-tr {
    color: var(--text);
    font-weight: 500;
  }

  .meaning-sep {
    color: var(--text-subtle);
  }

  .meaning-en {
    color: var(--text-muted);
  }

  .vocab-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 7px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .icon-btn:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }

  .icon-btn--del:hover {
    color: #FCA5A5;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .vocab-example {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg);
    border-radius: 6px;
    padding: 5px 8px;
  }

  .ex-de {
    color: var(--text);
  }

  .ex-tr {
    color: var(--text-muted);
  }
</style>
