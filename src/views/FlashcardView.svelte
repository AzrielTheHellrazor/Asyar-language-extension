<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    VocabItem,
    VocabFilter,
    ArticleGender,
    HighlightSegment
  } from "../types";
  import {
    seedStarterGermanVocabIfEmpty,
    listVocabItems,
    getDueFlashcards,
    recordFlashcardReview
  } from "../store/vocab";
  import { segmentSentenceWithArticleHighlights } from "../engine/wiktionary";

  let {
    context,
    actions,
    storage,
    interop,
    extensionId
  } = $props();

  type QuizMode = "card" | "article-cloze";

  let allItems = $state<VocabItem[]>([]);
  let activeFilter = $state<VocabFilter>("all");
  let quizMode = $state<QuizMode>("card");
  let currentIndex = $state(0);
  let flipped = $state(false);
  let selectedArticleGuess = $state<ArticleGender | null>(null);
  let sessionReviewed = $state(0);
  let sessionCorrect = $state(0);
  let loading = $state(true);

  const deck = $derived.by(() => {
    const filtered = getDueFlashcards(allItems, activeFilter);
    if (quizMode === "article-cloze") {
      const withArticles = filtered.filter((item) => Boolean(item.article));
      return withArticles.length > 0 ? withArticles : filtered;
    }
    return filtered;
  });

  const currentCard = $derived(
    deck.length > 0 && currentIndex < deck.length ? deck[currentIndex] : null
  );

  const isSessionComplete = $derived(
    !loading && deck.length > 0 && currentIndex >= deck.length
  );

  function getArticleBadgeClass(article?: ArticleGender): string {
    if (article === "der") return "badge--der";
    if (article === "die") return "badge--die";
    if (article === "das") return "badge--das";
    return "badge--neutral";
  }

  function stripLeadingArticle(text: string): string {
    return text.replace(/^(der|die|das)\s+/i, "").trim();
  }

  function getPrimaryDeExample(card: VocabItem) {
    return card.examples.find((e) => e.language === "de") ?? card.examples[0] ?? null;
  }

  function getClozeSegments(card: VocabItem): HighlightSegment[] {
    const ex = getPrimaryDeExample(card);
    if (!ex) return [];
    const segs =
      ex.highlightedSegments ??
      segmentSentenceWithArticleHighlights(
        ex.sentence,
        stripLeadingArticle(card.deText),
        card.article
      );
    return segs;
  }

  async function loadDeck() {
    loading = true;
    try {
      await seedStarterGermanVocabIfEmpty(storage);
      allItems = await listVocabItems(storage);
      currentIndex = 0;
      flipped = false;
      selectedArticleGuess = null;
    } finally {
      loading = false;
    }
  }

  function setFilter(f: VocabFilter) {
    activeFilter = f;
    currentIndex = 0;
    flipped = false;
    selectedArticleGuess = null;
  }

  function setMode(m: QuizMode) {
    quizMode = m;
    currentIndex = 0;
    flipped = false;
    selectedArticleGuess = null;
  }

  function flipCard() {
    if (!currentCard) return;
    flipped = !flipped;
  }

  function guessArticle(guess: ArticleGender) {
    if (!currentCard) return;
    selectedArticleGuess = guess;
    flipped = true;
  }

  async function answerCard(outcome: "easy" | "again") {
    if (!currentCard) return;
    const cardId = currentCard.id;
    sessionReviewed += 1;
    if (outcome === "easy") {
      sessionCorrect += 1;
    }
    await recordFlashcardReview(storage, cardId, outcome);
    flipped = false;
    selectedArticleGuess = null;
    currentIndex += 1;
  }

  async function restartSession() {
    allItems = await listVocabItems(storage);
    currentIndex = 0;
    flipped = false;
    selectedArticleGuess = null;
    sessionReviewed = 0;
    sessionCorrect = 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!currentCard) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flipCard();
    } else if (e.key === "1" || e.key === "ArrowLeft") {
      e.preventDefault();
      answerCard("again");
    } else if (e.key === "2" || e.key === "ArrowRight") {
      e.preventDefault();
      answerCard("easy");
    }
  }

  onMount(() => {
    loadDeck();
    window.addEventListener("keydown", handleKeydown);
    actions?.registerActionHandler?.(`act_${extensionId}_flip-card`, flipCard);
    actions?.registerActionHandler?.(`act_${extensionId}_open-vocab`, () => {
      interop?.launchCommand?.(extensionId, "vocab");
    });
    actions?.registerActionHandler?.(`act_${extensionId}_open-lookup`, () => {
      interop?.launchCommand?.(extensionId, "lookup");
    });
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div class="flashcard-view">
  <header class="fc-header">
    <div class="fc-header__top">
      <div class="fc-modes">
        <button
          type="button"
          class="mode-btn"
          class:mode-btn--active={quizMode === "card"}
          onclick={() => setMode("card")}
        >
          🎴 Kelime & Artikel Kartı
        </button>
        <button
          type="button"
          class="mode-btn"
          class:mode-btn--active={quizMode === "article-cloze"}
          onclick={() => setMode("article-cloze")}
        >
          🎯 Cümle İçinde Artikel Tahmini
        </button>
      </div>

      <div class="fc-nav-actions">
        <button
          type="button"
          class="nav-link-btn"
          onclick={() => interop?.launchCommand?.(extensionId, "vocab")}
        >
          📚 Kelime Defteri
        </button>
        <button
          type="button"
          class="nav-link-btn"
          onclick={() => interop?.launchCommand?.(extensionId, "lookup")}
        >
          🔍 Sözlük
        </button>
      </div>
    </div>

    <div class="fc-filters">
      <button
        type="button"
        class="filter-pill"
        class:filter-pill--active={activeFilter === "all"}
        onclick={() => setFilter("all")}
      >
        Tümü ({allItems.length})
      </button>
      <button
        type="button"
        class="filter-pill filter-pill--der"
        class:filter-pill--active={activeFilter === "der"}
        onclick={() => setFilter("der")}
      >
        <span class="dot dot--der"></span> der
      </button>
      <button
        type="button"
        class="filter-pill filter-pill--die"
        class:filter-pill--active={activeFilter === "die"}
        onclick={() => setFilter("die")}
      >
        <span class="dot dot--die"></span> die
      </button>
      <button
        type="button"
        class="filter-pill filter-pill--das"
        class:filter-pill--active={activeFilter === "das"}
        onclick={() => setFilter("das")}
      >
        <span class="dot dot--das"></span> das
      </button>
      <button
        type="button"
        class="filter-pill"
        class:filter-pill--active={activeFilter === "verb"}
        onclick={() => setFilter("verb")}
      >
        ⚡ Fiiller
      </button>
      <button
        type="button"
        class="filter-pill"
        class:filter-pill--active={activeFilter === "favorites"}
        onclick={() => setFilter("favorites")}
      >
        ⭐ Favoriler
      </button>
    </div>

    {#if deck.length > 0}
      <div class="fc-progress">
        <div class="fc-progress__bar">
          <div
            class="fc-progress__fill"
            style={`width: ${Math.min(100, Math.round((currentIndex / deck.length) * 100))}%`}
          ></div>
        </div>
        <span class="fc-progress__text">
          Kart {Math.min(currentIndex + 1, deck.length)} / {deck.length} · Doğru: {sessionCorrect}
        </span>
      </div>
    {/if}
  </header>

  {#if loading}
    <div class="fc-empty">Kartlar yükleniyor…</div>
  {:else if deck.length === 0}
    <div class="fc-empty">
      <p>Bu filtrede henüz kayıtlı kelime bulunmuyor.</p>
      <button
        type="button"
        class="action-btn action-btn--easy"
        onclick={() => setFilter("all")}
      >
        Tüm Kelimeleri Göster
      </button>
    </div>
  {:else if isSessionComplete}
    <div class="fc-complete">
      <div class="fc-complete__icon">🎉</div>
      <h2>Tekrar Oturumu Tamamlandı!</h2>
      <p>
        Toplam <strong>{sessionReviewed}</strong> kelime çalıştın ({sessionCorrect} "Öğrendim",
        {sessionReviewed - sessionCorrect} "Tekrar Et").
      </p>
      <div class="fc-complete__actions">
        <button type="button" class="action-btn action-btn--easy" onclick={restartSession}>
          🔄 Baştan Başla
        </button>
        <button
          type="button"
          class="action-btn action-btn--secondary"
          onclick={() => interop?.launchCommand?.(extensionId, "vocab")}
        >
          📚 Kelime Defterine Git
        </button>
      </div>
    </div>
  {:else if currentCard}
    {@const primaryEx = getPrimaryDeExample(currentCard)}
    <div class="fc-stage">
      <div
        class="fc-card"
        class:fc-card--flipped={flipped}
        role="button"
        tabindex="0"
        onclick={flipCard}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            flipCard();
          }
        }}
      >
        <!-- FRONT SIDE -->
        {#if !flipped}
          <div class="fc-card__face fc-card__front">
            <div class="fc-card__meta">
              <span class="pos-tag">{currentCard.pos.toUpperCase()}</span>
              {#if currentCard.cefrLevel}
                <span class="cefr-tag">{currentCard.cefrLevel}</span>
              {/if}
              <span class="mastery-tag">Seviye {currentCard.masteryLevel}/5</span>
            </div>

            {#if quizMode === "article-cloze" && currentCard.article}
              <div class="cloze-prompt">
                <p class="cloze-hint">Doğru Artikeli Seç:</p>
                <h2 class="cloze-word">
                  <span class="cloze-blank">[ der / die / das? ]</span>
                  {stripLeadingArticle(currentCard.deText)}
                </h2>
                <p class="cloze-meanings">
                  🇹🇷 {currentCard.trText} · 🇬🇧 {currentCard.enText}
                </p>

                {#if primaryEx}
                  <div class="cloze-sentence-box">
                    <p class="cloze-sentence">
                      {#each getClozeSegments(currentCard) as seg}
                        {#if seg.isArticle}
                          <span class="cloze-mask">[___]</span>
                        {:else if seg.isTargetWord}
                          <strong>{seg.text}</strong>
                        {:else}
                          {seg.text}
                        {/if}
                      {/each}
                    </p>
                    <p class="cloze-sentence-tr">🇹🇷 {primaryEx.translationTr}</p>
                  </div>
                {/if}

                <!-- Quick Article Buttons -->
                <div class="article-guess-row">
                  <button
                    type="button"
                    class="guess-btn guess-btn--der"
                    onclick={(e) => {
                      e.stopPropagation();
                      guessArticle("der");
                    }}
                  >
                    der (Eril)
                  </button>
                  <button
                    type="button"
                    class="guess-btn guess-btn--die"
                    onclick={(e) => {
                      e.stopPropagation();
                      guessArticle("die");
                    }}
                  >
                    die (Dişil)
                  </button>
                  <button
                    type="button"
                    class="guess-btn guess-btn--das"
                    onclick={(e) => {
                      e.stopPropagation();
                      guessArticle("das");
                    }}
                  >
                    das (Nötr)
                  </button>
                </div>
              </div>
            {:else}
              <div class="standard-prompt">
                <div class="prompt-langs">
                  <span class="prompt-tr">🇹🇷 {currentCard.trText}</span>
                  <span class="prompt-en">🇬🇧 {currentCard.enText}</span>
                </div>
                <h2 class="prompt-de">
                  {#if currentCard.article}
                    <span class="cloze-blank">[ ? ]</span>
                    {stripLeadingArticle(currentCard.deText)}
                  {:else}
                    🇩🇪 ?
                  {/if}
                </h2>
                {#if primaryEx}
                  <p class="prompt-example-tr">
                    💡 Örnek Cümle: "{primaryEx.translationTr}"
                  </p>
                {/if}
              </div>
            {/if}

            <p class="flip-hint">Kartı çevirmek için Space / Enter veya tıkla</p>
          </div>
        {:else}
          <!-- BACK SIDE (REVEAL) -->
          <div class="fc-card__face fc-card__back">
            {#if selectedArticleGuess && currentCard.article}
              <div
                class="guess-feedback"
                class:guess-feedback--correct={selectedArticleGuess === currentCard.article}
                class:guess-feedback--wrong={selectedArticleGuess !== currentCard.article}
              >
                {#if selectedArticleGuess === currentCard.article}
                  ✅ Doğru! Artikel: <strong>{currentCard.article}</strong>
                {:else}
                  ❌ Seçimin: {selectedArticleGuess} — Doğrusu: <strong>{currentCard.article}</strong>
                {/if}
              </div>
            {/if}

            <div class="reveal-header">
              {#if currentCard.article}
                <span class={`article-badge ${getArticleBadgeClass(currentCard.article)}`}>
                  {currentCard.article}
                </span>
              {/if}
              <h2 class="reveal-word">{stripLeadingArticle(currentCard.deText)}</h2>
              {#if currentCard.plural}
                <span class="reveal-plural">Çoğul: <strong>{currentCard.plural}</strong></span>
              {/if}
            </div>

            <div class="reveal-translations">
              <span>🇹🇷 <strong>{currentCard.trText}</strong></span>
              <span>·</span>
              <span>🇬🇧 <strong>{currentCard.enText}</strong></span>
              {#if currentCard.ipa}
                <span>·</span>
                <span class="reveal-ipa">/{currentCard.ipa}/</span>
              {/if}
            </div>

            {#if currentCard.verbConjugation}
              <div class="reveal-verb">
                <span>Präsens: <strong>{currentCard.verbConjugation.praesensErSieEs ?? "-"}</strong></span>
                <span>Präteritum: <strong>{currentCard.verbConjugation.praeteritumIch ?? "-"}</strong></span>
                <span>Perfekt: <strong>{currentCard.verbConjugation.perfekt ?? "-"}</strong></span>
              </div>
            {/if}

            {#if currentCard.grammarTip}
              <p class="reveal-tip">💡 {currentCard.grammarTip}</p>
            {/if}

            {#if currentCard.examples.length > 0}
              <div class="reveal-examples">
                {#each currentCard.examples.slice(0, 2) as ex}
                  <div class="reveal-example-item">
                    <p class="reveal-example-de">
                      {ex.language === "de" ? "🇩🇪" : "🇬🇧"}
                      {#if ex.language === "de"}
                        {#each ex.highlightedSegments ?? segmentSentenceWithArticleHighlights(ex.sentence, stripLeadingArticle(currentCard.deText), currentCard.article) as seg}
                          {#if seg.isArticle}
                            <span class={`hl-article hl-article--${seg.articleGender ?? currentCard.article ?? "der"}`}>
                              {seg.text}
                            </span>
                          {:else if seg.isTargetWord}
                            <strong class={`hl-word hl-word--${seg.articleGender ?? currentCard.article ?? "der"}`}>
                              {seg.text}
                            </strong>
                          {:else}
                            {seg.text}
                          {/if}
                        {/each}
                      {:else}
                        {ex.sentence}
                      {/if}
                    </p>
                    <p class="reveal-example-tr">🇹🇷 {ex.translationTr}</p>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- REVIEW CONTROLS -->
      <div class="fc-controls">
        <button
          type="button"
          class="action-btn action-btn--again"
          onclick={() => answerCard("again")}
        >
          🔁 Tekrar Et (1 / ←)
        </button>
        <button
          type="button"
          class="action-btn action-btn--flip"
          onclick={flipCard}
        >
          🔄 Kartı Çevir (Space)
        </button>
        <button
          type="button"
          class="action-btn action-btn--easy"
          onclick={() => answerCard("easy")}
        >
          ✅ Öğrendim (2 / →)
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .flashcard-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    color: var(--text-primary, #f3f4f6);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .fc-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fc-header__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .fc-modes {
    display: flex;
    gap: 6px;
  }

  .mode-btn,
  .nav-link-btn {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.12));
    background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
    color: var(--text-secondary, #9ca3af);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .mode-btn--active {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: var(--text-primary, #ffffff);
  }

  .fc-nav-actions {
    display: flex;
    gap: 6px;
  }

  .fc-filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.1));
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.04));
    color: var(--text-secondary, #9ca3af);
    font-size: 12px;
    cursor: pointer;
  }

  .filter-pill--active {
    background: var(--bg-selected, rgba(255, 255, 255, 0.15));
    color: var(--text-primary, #ffffff);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot--der {
    background: #3b82f6;
  }
  .dot--die {
    background: #ec4899;
  }
  .dot--das {
    background: #10b981;
  }

  .fc-progress {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .fc-progress__bar {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }

  .fc-progress__fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    transition: width 0.25s ease;
  }

  .fc-progress__text {
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
  }

  .fc-stage {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fc-card {
    min-height: 250px;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.14));
    background: var(--bg-secondary, rgba(255, 255, 255, 0.04));
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
  }

  .fc-card__meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
    color: var(--text-secondary, #9ca3af);
  }

  .pos-tag,
  .cefr-tag,
  .mastery-tag {
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.08));
  }

  .cloze-prompt,
  .standard-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    margin: 12px 0;
  }

  .cloze-word,
  .prompt-de {
    font-size: 24px;
    margin: 0;
  }

  .cloze-blank,
  .cloze-mask {
    color: #fbbf24;
    font-weight: 700;
    padding: 0 4px;
  }

  .cloze-sentence-box {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
    width: 100%;
    max-width: 560px;
  }

  .cloze-sentence {
    margin: 0 0 4px 0;
    font-size: 15px;
  }

  .cloze-sentence-tr {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary, #9ca3af);
  }

  .article-guess-row {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  .guess-btn {
    padding: 8px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .guess-btn--der {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
  }
  .guess-btn--die {
    background: rgba(236, 72, 153, 0.2);
    border-color: #ec4899;
    color: #f472b6;
  }
  .guess-btn--das {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #34d399;
  }

  .prompt-langs {
    display: flex;
    gap: 14px;
    font-size: 16px;
    font-weight: 600;
  }

  .flip-hint {
    margin: 0;
    text-align: center;
    font-size: 11px;
    color: var(--text-tertiary, #6b7280);
  }

  .guess-feedback {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .guess-feedback--correct {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }
  .guess-feedback--wrong {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .reveal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .article-badge {
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 18px;
  }
  .badge--der {
    background: rgba(59, 130, 246, 0.22);
    color: #60a5fa;
    border: 1px solid #3b82f6;
  }
  .badge--die {
    background: rgba(236, 72, 153, 0.22);
    color: #f472b6;
    border: 1px solid #ec4899;
  }
  .badge--das {
    background: rgba(16, 185, 129, 0.22);
    color: #34d399;
    border: 1px solid #10b981;
  }

  .reveal-word {
    margin: 0;
    font-size: 24px;
  }

  .reveal-plural {
    font-size: 13px;
    color: var(--text-secondary, #9ca3af);
  }

  .reveal-translations {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin: 8px 0;
    font-size: 14px;
  }

  .reveal-verb {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
  }

  .reveal-tip {
    margin: 6px 0;
    font-size: 12px;
    color: #fbbf24;
  }

  .reveal-examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .reveal-example-item {
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
  }

  .reveal-example-de {
    margin: 0 0 3px 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .reveal-example-tr {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
  }

  .hl-article {
    padding: 1px 6px;
    border-radius: 5px;
    font-weight: 700;
  }
  .hl-article--der {
    background: rgba(59, 130, 246, 0.25);
    color: #60a5fa;
  }
  .hl-article--die {
    background: rgba(236, 72, 153, 0.25);
    color: #f472b6;
  }
  .hl-article--das {
    background: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .hl-word--der {
    color: #93c5fd;
    text-decoration: underline;
  }
  .hl-word--die {
    color: #f9a8d4;
    text-decoration: underline;
  }
  .hl-word--das {
    color: #6ee7b7;
    text-decoration: underline;
  }

  .fc-controls {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .action-btn {
    flex: 1;
    padding: 10px 14px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid var(--separator, rgba(255, 255, 255, 0.14));
  }

  .action-btn--again {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .action-btn--flip {
    background: var(--bg-secondary, rgba(255, 255, 255, 0.07));
    color: var(--text-primary, #ffffff);
  }

  .action-btn--easy {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.45);
  }

  .fc-empty,
  .fc-complete {
    padding: 32px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .fc-complete__icon {
    font-size: 40px;
  }

  .fc-complete__actions {
    display: flex;
    gap: 10px;
  }
</style>
