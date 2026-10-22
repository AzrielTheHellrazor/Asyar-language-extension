import { describe, expect, it, vi } from "vitest";
import {
  filterVocabItems,
  getDueFlashcards,
  listVocabItems,
  recordFlashcardReview,
  removeVocabItem,
  saveWordToVocab,
  seedStarterGermanVocabIfEmpty,
  toggleVocabFavorite,
  VOCAB_ITEM_PREFIX,
  VOCAB_SEEDED_KEY
} from "../src/store/vocab";
import type { PolyglotEntry, StorageLike } from "../src/types";

function createMockStorage(initial: Record<string, unknown> = {}): StorageLike {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    async get(key: string): Promise<unknown> {
      return store.get(key);
    },
    async set(key: string, value: unknown): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async getAll(): Promise<Record<string, unknown>> {
      return Object.fromEntries(store.entries());
    },
    async clear(): Promise<void> {
      store.clear();
    }
  };
}

function makeSampleEntry(overrides: Partial<PolyglotEntry> = {}): PolyglotEntry {
  return {
    query: "Tisch",
    detectedLang: "de",
    timestamp: 1700000000000,
    translations: {
      de: {
        lang: "de",
        label: "Deutsch",
        flag: "🇩🇪",
        primaryText: "Tisch",
        alternatives: ["Tafel"],
        article: "der",
        plural: "die Tische"
      },
      en: {
        lang: "en",
        label: "English",
        flag: "🇬🇧",
        primaryText: "table",
        alternatives: ["desk"]
      },
      tr: {
        lang: "tr",
        label: "Türkçe",
        flag: "🇹🇷",
        primaryText: "masa",
        alternatives: ["tablo"]
      }
    },
    germanGrammar: {
      word: "Tisch",
      pos: "noun",
      cefrLevel: "A1",
      ipa: "/tɪʃ/",
      noun: {
        article: "der",
        genderLabel: "Maskulin (Eril)",
        singular: "der Tisch",
        plural: "die Tische"
      },
      grammarTip: "Eril (der) isimdir; çoğulu 'die Tische' olur."
    },
    meanings: [],
    examples: [
      {
        id: "ex-tisch-1",
        language: "de",
        sentence: "Das Buch liegt auf dem Tisch.",
        translationTr: "Kitap masanın üzerinde duruyor.",
        translationEnOrDe: "The book is on the table.",
        articleUsed: "der",
        highlightedSegments: [
          { text: "Das Buch liegt auf " },
          { text: "dem", isArticle: true, articleGender: "der" },
          { text: " " },
          { text: "Tisch", isTargetWord: true, articleGender: "der" },
          { text: "." }
        ],
        source: "curated"
      }
    ],
    synonyms: { de: ["Tafel"], en: ["desk"] },
    ...overrides
  };
}

describe("vocab store & flashcard review engine", () => {
  it("saves a new PolyglotEntry and deduplicates while preserving favorite and mastery metadata", async () => {
    const storage = createMockStorage();
    const entry = makeSampleEntry();

    const created = await saveWordToVocab(storage, entry);
    expect(created.deText).toBe("Tisch");
    expect(created.enText).toBe("table");
    expect(created.trText).toBe("masa");
    expect(created.article).toBe("der");
    expect(created.plural).toBe("die Tische");
    expect(created.cefrLevel).toBe("A1");
    expect(created.ipa).toBe("/tɪʃ/");
    expect(created.favorite).toBe(false);
    expect(created.masteryLevel).toBe(0);
    expect(created.reviewCount).toBe(0);

    // Flip favorite and record a review before saving a duplicate
    await toggleVocabFavorite(storage, created.id);
    await recordFlashcardReview(storage, created.id, "easy");

    const updatedEntry = makeSampleEntry({
      germanGrammar: {
        word: "Tisch",
        pos: "noun",
        cefrLevel: "A2",
        ipa: "/tɪʃ/",
        noun: {
          article: "der",
          genderLabel: "Maskulin (Eril)",
          singular: "der Tisch",
          plural: "die Tische"
        },
        grammarTip: "Güncellenmiş ipucu: 'auf dem Tisch' (Dativ) / 'auf den Tisch' (Akkusativ)."
      },
      examples: [
        {
          id: "ex-tisch-2",
          language: "de",
          sentence: "Der Tisch aus Holz ist neu.",
          translationTr: "Ahşap masa yeni.",
          source: "curated"
        }
      ]
    });

    const deduplicated = await saveWordToVocab(storage, updatedEntry);
    const allItems = await listVocabItems(storage);

    expect(allItems).toHaveLength(1);
    expect(deduplicated.id).toBe(created.id);
    expect(deduplicated.favorite).toBe(true);
    expect(deduplicated.masteryLevel).toBe(1);
    expect(deduplicated.reviewCount).toBe(1);
    expect(deduplicated.cefrLevel).toBe("A2");
    expect(deduplicated.grammarTip).toContain("Güncellenmiş ipucu");
    expect(deduplicated.examples[0].sentence).toBe("Der Tisch aus Holz ist neu.");
  });

  it("lists items sorted by favorite first and newest updatedAt first, ignoring invalid entries", async () => {
    const storage = createMockStorage({
      [`${VOCAB_ITEM_PREFIX}corrupt`]: "{not-valid-json",
      "other:key": "ignored"
    });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
      const first = await saveWordToVocab(storage, makeSampleEntry());

      vi.setSystemTime(new Date("2026-01-01T10:05:00Z"));
      const second = await saveWordToVocab(
        storage,
        makeSampleEntry({
          query: "Lampe",
          translations: {
            de: {
              lang: "de",
              label: "Deutsch",
              flag: "🇩🇪",
              primaryText: "Lampe",
              alternatives: [],
              article: "die",
              plural: "die Lampen"
            },
            en: {
              lang: "en",
              label: "English",
              flag: "🇬🇧",
              primaryText: "lamp",
              alternatives: []
            },
            tr: {
              lang: "tr",
              label: "Türkçe",
              flag: "🇹🇷",
              primaryText: "lamba",
              alternatives: []
            }
          },
          germanGrammar: {
            word: "Lampe",
            pos: "noun",
            noun: {
              article: "die",
              genderLabel: "Feminin (Dişil)",
              singular: "die Lampe",
              plural: "die Lampen"
            }
          }
        })
      );

      // Before favoriting, newer item (second) comes first
      let list = await listVocabItems(storage);
      expect(list.map((i) => i.id)).toEqual([second.id, first.id]);

      // Mark older item as favorite -> it should now appear first
      vi.setSystemTime(new Date("2026-01-01T10:01:00Z"));
      await toggleVocabFavorite(storage, first.id);

      list = await listVocabItems(storage);
      expect(list.map((i) => i.id)).toEqual([first.id, second.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("seeds 6 rich starter German vocab items only when empty and filters across categories and queries", async () => {
    const storage = createMockStorage();

    const seeded = await seedStarterGermanVocabIfEmpty(storage);
    expect(seeded).toHaveLength(6);
    expect(await storage.get(VOCAB_SEEDED_KEY)).toBe("true");

    // Calling again should not duplicate items
    const secondCall = await seedStarterGermanVocabIfEmpty(storage);
    expect(secondCall).toHaveLength(6);

    // Filter checks: der, die, das, verb, english, favorites
    expect(filterVocabItems(seeded, "all")).toHaveLength(6);
    expect(filterVocabItems(seeded, "der").map((i) => i.deText)).toEqual(["Schlüssel"]);
    expect(filterVocabItems(seeded, "das").map((i) => i.deText)).toEqual(["Buch"]);
    expect(filterVocabItems(seeded, "die").map((i) => i.deText).sort()).toEqual([
      "Entscheidung",
      "Erfahrung"
    ]);
    expect(filterVocabItems(seeded, "verb").map((i) => i.deText).sort()).toEqual([
      "sprechen",
      "verstehen"
    ]);
    expect(filterVocabItems(seeded, "english")).toHaveLength(6);
    expect(filterVocabItems(seeded, "favorites").map((i) => i.deText)).toEqual(["Buch"]);

    // Search query checks on deText, enText, trText, plural, example sentence & translationTr
    expect(filterVocabItems(seeded, "all", "Bücher")).toHaveLength(1);
    expect(filterVocabItems(seeded, "all", "anahtar")[0]?.deText).toBe("Schlüssel");
    expect(filterVocabItems(seeded, "all", "decision")[0]?.deText).toBe("Entscheidung");
    expect(filterVocabItems(seeded, "all", "Wohnung")[0]?.deText).toBe("Schlüssel");
    expect(filterVocabItems(seeded, "all", "okuyorum")[0]?.deText).toBe("Buch");
  });

  it("toggles favorites and removes vocab items cleanly", async () => {
    const storage = createMockStorage();
    const item = await saveWordToVocab(storage, makeSampleEntry());

    const favOn = await toggleVocabFavorite(storage, item.id);
    expect(favOn?.favorite).toBe(true);

    const favOff = await toggleVocabFavorite(storage, item.id);
    expect(favOff?.favorite).toBe(false);

    expect(await toggleVocabFavorite(storage, "non-existent")).toBeNull();

    await removeVocabItem(storage, item.id);
    expect(await listVocabItems(storage)).toHaveLength(0);
  });

  it("records flashcard reviews ('easy' & 'again'), schedules nextReviewAt, and orders due cards", async () => {
    const storage = createMockStorage();
    vi.useFakeTimers();
    try {
      const baseMs = new Date("2026-05-01T12:00:00Z").getTime();
      vi.setSystemTime(baseMs);

      const item = await saveWordToVocab(storage, makeSampleEntry());
      expect(item.masteryLevel).toBe(0);

      // Easy #1 -> mastery 1, +1 hour
      const r1 = await recordFlashcardReview(storage, item.id, "easy");
      expect(r1?.masteryLevel).toBe(1);
      expect(r1?.reviewCount).toBe(1);
      expect(r1?.nextReviewAt).toBe(baseMs + 1 * 60 * 60 * 1000);

      // Easy #2 -> mastery 2, +6 hours
      const r2 = await recordFlashcardReview(storage, item.id, "easy");
      expect(r2?.masteryLevel).toBe(2);
      expect(r2?.nextReviewAt).toBe(baseMs + 6 * 60 * 60 * 1000);

      // Again -> mastery decrements to 1, nextReviewAt = now
      const r3 = await recordFlashcardReview(storage, item.id, "again");
      expect(r3?.masteryLevel).toBe(1);
      expect(r3?.reviewCount).toBe(3);
      expect(r3?.nextReviewAt).toBe(baseMs);

      // Add a second new card (mastery 0) and check getDueFlashcards ordering
      const second = await saveWordToVocab(
        storage,
        makeSampleEntry({
          query: "Haus",
          translations: {
            de: {
              lang: "de",
              label: "Deutsch",
              flag: "🇩🇪",
              primaryText: "Haus",
              alternatives: [],
              article: "das",
              plural: "die Häuser"
            },
            en: {
              lang: "en",
              label: "English",
              flag: "🇬🇧",
              primaryText: "house",
              alternatives: []
            },
            tr: {
              lang: "tr",
              label: "Türkçe",
              flag: "🇹🇷",
              primaryText: "ev",
              alternatives: []
            }
          }
        })
      );

      const all = await listVocabItems(storage);
      const due = getDueFlashcards(all, "all");
      expect(due.map((d) => d.id)).toEqual([second.id, item.id]);
    } finally {
      vi.useRealTimers();
    }
  });
});
