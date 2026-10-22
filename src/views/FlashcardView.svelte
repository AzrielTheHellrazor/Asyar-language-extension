<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/awwwards.css";
  import {
    recordFlashcardReview,
    purgeStarterVocabOnce
  } from "../store/vocab";
  import type { VocabItem, ArticleGender } from "../types";

  let {
    context,
    actions,
    storage,
    interop,
    extensionId,
    embedded = false,
    onBackToDict
  } = $props();

  let deck = $state<VocabItem[]>([]);
  let currentIndex = $state(0);
  let mode = $state<"cloze" | "meaning">("cloze");
  let revealed = $state(false);
  let selectedArticle = $state<ArticleGender | null>(null);
  let scoreCorrect = $state(0);
  let scoreTotal = $state(0);

  const currentCard = $derived(deck[currentIndex] ?? null);

  function stripArticle(text: string): string {
    return text.replace(/^(der|die|das)\s+/i, "").trim();
  }

  function getClozeSentence(card: VocabItem): string {
    const ex = card.examples.find((e) => e.language === "de") ?? card.examples[0];
    if (!ex) return `___ ${stripArticle(card.deText)}`;
    return ex.sentence.replace(
      /\b(der|die|das|den|dem|des|ein|eine|einen|einem)\b/i,
      "___"
    );
  }

  function chooseArticle(guess: ArticleGender) {
    if (!currentCard || revealed) return;
    selectedArticle = guess;
    revealed = true;
  }

  async function nextCard(correct: boolean) {
    if (!currentCard) return;
    scoreTotal += 1;
    if (correct) scoreCorrect += 1;

    try {
      await recordFlashcardReview(
        storage,
        currentCard.id,
        correct ? "easy" : "again"
      );
    } catch {
      // ignore
    }

    revealed = false;
    selectedArticle = null;
    currentIndex = (currentIndex + 1) % Math.max(1, deck.length);
  }

  onMount(() => {
    (async () => {
      try {
        deck = await purgeStarterVocabOnce(storage);
      } catch {
        // ignore
      }
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!revealed && currentCard?.article) {
        if (e.key === "1") chooseArticle("der");
        if (e.key === "2") chooseArticle("die");
        if (e.key === "3") chooseArticle("das");
      }
      if (e.key === " ") {
        e.preventDefault();
        revealed = !revealed;
      }
      if (e.key === "Enter" && revealed) {
        e.preventDefault();
        const isOk =
          !selectedArticle || selectedArticle === currentCard?.article;
        nextCard(isOk);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class={embedded ? "cards-inner" : "launcher-wrap"}>
  <div class="cards-topbar">
    <div class="mode-switch">
      <button
        type="button"
        class="mode-btn {mode === 'cloze' ? 'is-active' : ''}"
        onclick={() => {
          mode = "cloze";
          revealed = false;
          selectedArticle = null;
        }}
      >
        Cümlede Artikel Tahmini
      </button>
      <button
        type="button"
        class="mode-btn {mode === 'meaning' ? 'is-active' : ''}"
        onclick={() => {
          mode = "meaning";
          revealed = false;
          selectedArticle = null;
        }}
      >
        Kelime &amp; Anlam Kartı
      </button>
    </div>

    <div class="score-pill">
      Kart {currentIndex + 1}/{Math.max(1, deck.length)} · Doğru: {scoreCorrect}/{scoreTotal}
    </div>
  </div>

  {#if !currentCard}
    <div class="card-box">
      Henüz kaydedilmiş kelime yok. Kartlarla çalışmak için sözlükten ★ Kaydet ile kelime ekleyin.
    </div>
  {:else}
    <div class="card-box {revealed && currentCard.article ? `card-box--${currentCard.article}` : ''}">
      <div class="card-meta">
        <span class="badge">{currentCard.cefrLevel || "A1"}</span>
        <span class="badge">🇹🇷 {currentCard.trText} · 🇬🇧 {currentCard.enText}</span>
      </div>

      {#if mode === "cloze"}
        <div class="card-prompt">
          <div class="prompt-word">
            {#if revealed && currentCard.article}
              <span class="art-{currentCard.article}">{currentCard.article}</span>
              {" "}{stripArticle(currentCard.deText)}
            {:else if currentCard.article}
              <span class="blank-slot">___</span> {stripArticle(currentCard.deText)}
            {:else}
              {currentCard.deText}
            {/if}
          </div>

          <p class="prompt-sentence">
            {revealed
              ? (currentCard.examples[0]?.sentence ?? currentCard.deText)
              : getClozeSentence(currentCard)}
          </p>
          {#if currentCard.examples[0]?.translationTr}
            <p class="prompt-tr">🇹🇷 {currentCard.examples[0].translationTr}</p>
          {/if}
        </div>
      {:else}
        <div class="card-prompt">
          <div class="prompt-word">
            {#if currentCard.article}
              <span class="art-{currentCard.article}">{currentCard.article}</span>
              {" "}{stripArticle(currentCard.deText)}
            {:else}
              {currentCard.deText}
            {/if}
          </div>
          {#if revealed}
            <p class="prompt-sentence">
              🇹🇷 <strong>{currentCard.trText}</strong> · 🇬🇧 <strong>{currentCard.enText}</strong>
            </p>
            {#if currentCard.examples[0]}
              <p class="prompt-tr">{currentCard.examples[0].sentence}</p>
            {/if}
          {:else}
            <p class="prompt-tr">Anlamı ve örnek cümleyi görmek için kartı çevirin.</p>
          {/if}
        </div>
      {/if}

      {#if currentCard.article && mode === "cloze" && !revealed}
        <div class="article-choices">
          <button
            type="button"
            class="choice-btn choice-btn--der"
            onclick={() => chooseArticle("der")}
          >
            <strong>1</strong> · der (Eril)
          </button>
          <button
            type="button"
            class="choice-btn choice-btn--die"
            onclick={() => chooseArticle("die")}
          >
            <strong>2</strong> · die (Dişil)
          </button>
          <button
            type="button"
            class="choice-btn choice-btn--das"
            onclick={() => chooseArticle("das")}
          >
            <strong>3</strong> · das (Nötr)
          </button>
        </div>
      {/if}

      {#if revealed}
        <div class="reveal-box">
          {#if selectedArticle && currentCard.article}
            <div class="feedback {selectedArticle === currentCard.article ? 'feedback--ok' : 'feedback--err'}">
              {#if selectedArticle === currentCard.article}
                ✓ Doğru! <strong>{currentCard.deText}</strong> ({currentCard.plural || "tekil"})
              {:else}
                ✗ Yanlış ({selectedArticle}). Doğrusu: <strong>{currentCard.deText}</strong> ({currentCard.plural || ""})
              {/if}
            </div>
          {/if}

          {#if currentCard.grammarTip}
            <div class="card-tip">{currentCard.grammarTip}</div>
          {/if}

          <div class="next-actions">
            <button
              type="button"
              class="eval-btn eval-btn--again"
              onclick={() => nextCard(false)}
            >
              Tekrar Sor
            </button>
            <button
              type="button"
              class="eval-btn eval-btn--ok"
              onclick={() => nextCard(true)}
            >
              Öğrendim / Sonraki →
            </button>
          </div>
        </div>
      {:else}
        <div class="next-actions">
          <button
            type="button"
            class="eval-btn"
            onclick={() => (revealed = true)}
          >
            Cevabı Göster (Space)
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cards-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cards-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mode-switch {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .mode-btn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .mode-btn.is-active {
    background: var(--surface-hover);
    color: var(--text);
  }

  .score-pill {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 10px;
  }

  .card-box {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card-box--der {
    border-left: 4px solid var(--der-text);
  }

  .card-box--die {
    border-left: 4px solid var(--die-text);
  }

  .card-box--das {
    border-left: 4px solid var(--das-text);
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .card-prompt {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 0;
  }

  .prompt-word {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
  }

  .blank-slot {
    display: inline-block;
    padding: 0 10px;
    border-bottom: 2px dashed var(--accent);
    color: var(--accent);
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

  .prompt-sentence {
    margin: 0;
    font-size: 15px;
    color: var(--text);
  }

  .prompt-tr {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .article-choices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .choice-btn {
    height: 40px;
    border-radius: 8px;
    font-size: 13px;
    border: 1px solid var(--border-strong);
    background: var(--bg);
  }

  .choice-btn--der {
    color: var(--der-text);
    border-color: var(--der-border);
  }

  .choice-btn--der:hover {
    background: var(--der-bg);
  }

  .choice-btn--die {
    color: var(--die-text);
    border-color: var(--die-border);
  }

  .choice-btn--die:hover {
    background: var(--die-bg);
  }

  .choice-btn--das {
    color: var(--das-text);
    border-color: var(--das-border);
  }

  .choice-btn--das:hover {
    background: var(--das-bg);
  }

  .reveal-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .feedback {
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
  }

  .feedback--ok {
    background: var(--das-bg);
    color: var(--das-text);
    border: 1px solid var(--das-border);
  }

  .feedback--err {
    background: var(--die-bg);
    color: var(--die-text);
    border: 1px solid var(--die-border);
  }

  .card-tip {
    font-size: 12px;
    color: var(--text-muted);
  }

  .next-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .eval-btn {
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }

  .eval-btn--ok {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .eval-btn--again:hover {
    background: var(--surface-hover);
  }
</style>
