import type {
  ArticleGender,
  PolyglotEntry,
  StorageLike,
  VocabFilter,
  VocabItem
} from "../types";

export const VOCAB_ITEM_PREFIX = "vocab:item:";
export const VOCAB_SEEDED_KEY = "vocab:seeded";

const REVIEW_INTERVAL_HOURS = [1, 6, 24, 72, 168] as const;

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingGermanArticle(value: string): string {
  return normalizeText(value).replace(/^(der|die|das)\s+/i, "");
}

function normalizeGermanKey(text: string, article?: ArticleGender): string {
  const norm = normalizeText(text);
  if (!norm) return "";
  const stripped = stripLeadingGermanArticle(norm);
  const resolvedArticle =
    article ??
    (norm.startsWith("der ")
      ? "der"
      : norm.startsWith("die ")
        ? "die"
        : norm.startsWith("das ")
          ? "das"
          : undefined);
  return resolvedArticle ? `${resolvedArticle} ${stripped}` : stripped;
}

function createDeterministicId(deText: string, enText: string): string {
  const base = stripLeadingGermanArticle(deText) || normalizeText(enText) || "word";
  const slug = base
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `word-${Date.now()}`;
}

function parseVocabItem(raw: unknown): VocabItem | null {
  if (!raw) return null;
  try {
    const parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as Partial<VocabItem>)
        : (raw as Partial<VocabItem>);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.id !== "string" ||
      typeof parsed.deText !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      deText: parsed.deText,
      enText: typeof parsed.enText === "string" ? parsed.enText : "",
      trText: typeof parsed.trText === "string" ? parsed.trText : "",
      pos: parsed.pos ?? "other",
      article: parsed.article,
      plural: parsed.plural,
      verbConjugation: parsed.verbConjugation,
      cefrLevel: parsed.cefrLevel,
      ipa: parsed.ipa,
      grammarTip: parsed.grammarTip,
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      favorite: Boolean(parsed.favorite),
      masteryLevel:
        typeof parsed.masteryLevel === "number"
          ? Math.max(0, Math.min(5, parsed.masteryLevel))
          : 0,
      reviewCount: typeof parsed.reviewCount === "number" ? parsed.reviewCount : 0,
      lastReviewedAt: parsed.lastReviewedAt,
      nextReviewAt: parsed.nextReviewAt
    };
  } catch {
    return null;
  }
}

async function persistVocabItem(
  storage: StorageLike,
  item: VocabItem,
  storageKey = `${VOCAB_ITEM_PREFIX}${item.id}`
): Promise<void> {
  await storage.set(storageKey, JSON.stringify(item));
}

async function findStoredItemById(
  storage: StorageLike,
  id: string
): Promise<{ key: string; item: VocabItem } | null> {
  const directKey = `${VOCAB_ITEM_PREFIX}${id}`;
  const directRaw = await storage.get(directKey);
  const directParsed = parseVocabItem(directRaw);
  if (directParsed && directParsed.id === id) {
    return { key: directKey, item: directParsed };
  }

  const all = await storage.getAll();
  for (const [key, raw] of Object.entries(all)) {
    if (!key.startsWith(VOCAB_ITEM_PREFIX)) continue;
    const item = parseVocabItem(raw);
    if (item && item.id === id) {
      return { key, item };
    }
  }
  return null;
}

export async function listVocabItems(storage: StorageLike): Promise<VocabItem[]> {
  const all = await storage.getAll();
  const items: VocabItem[] = [];

  for (const [key, raw] of Object.entries(all)) {
    if (!key.startsWith(VOCAB_ITEM_PREFIX)) continue;
    const parsed = parseVocabItem(raw);
    if (parsed) {
      items.push(parsed);
    }
  }

  items.sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });

  return items;
}

export async function saveWordToVocab(
  storage: StorageLike,
  entry: PolyglotEntry
): Promise<VocabItem> {
  const now = Date.now();
  const deText = entry.translations.de.primaryText;
  const enText = entry.translations.en.primaryText;
  const trText = entry.translations.tr.primaryText;
  const pos = entry.germanGrammar?.pos ?? "other";
  const article = entry.germanGrammar?.noun?.article ?? entry.translations.de.article;
  const plural = entry.germanGrammar?.noun?.plural ?? entry.translations.de.plural;
  const verbConjugation = entry.germanGrammar?.verb;
  const cefrLevel = entry.germanGrammar?.cefrLevel;
  const ipa = entry.germanGrammar?.ipa ?? entry.englishDetails?.ipa;
  const grammarTip = entry.germanGrammar?.grammarTip;
  const examples = entry.examples ?? [];

  const targetDeNorm = normalizeText(deText);
  const targetDeKey = normalizeGermanKey(deText, article);
  const targetDeBare = stripLeadingGermanArticle(deText);
  const targetEnNorm = normalizeText(enText);

  const all = await storage.getAll();
  for (const [key, raw] of Object.entries(all)) {
    if (!key.startsWith(VOCAB_ITEM_PREFIX)) continue;
    const existing = parseVocabItem(raw);
    if (!existing) continue;

    const existingDeNorm = normalizeText(existing.deText);
    const existingDeKey = normalizeGermanKey(existing.deText, existing.article);
    const existingDeBare = stripLeadingGermanArticle(existing.deText);
    const existingEnNorm = normalizeText(existing.enText);

    const sameDe =
      Boolean(targetDeNorm) &&
      (existingDeNorm === targetDeNorm ||
        existingDeKey === targetDeKey ||
        ( (!existing.article || !article || existing.article === article) &&
          Boolean(targetDeBare) &&
          existingDeBare === targetDeBare ));
    const sameEn = Boolean(targetEnNorm) && existingEnNorm === targetEnNorm;

    if (sameDe || sameEn) {
      const updatedItem: VocabItem = {
        ...existing,
        updatedAt: now,
        deText: deText || existing.deText,
        enText: enText || existing.enText,
        trText: trText || existing.trText,
        pos: entry.germanGrammar?.pos ?? existing.pos,
        article: article ?? existing.article,
        plural: plural ?? existing.plural,
        verbConjugation: verbConjugation ?? existing.verbConjugation,
        cefrLevel: cefrLevel ?? existing.cefrLevel,
        ipa: ipa ?? existing.ipa,
        grammarTip: grammarTip ?? existing.grammarTip,
        examples: examples.length > 0 ? examples : existing.examples,
        favorite: existing.favorite,
        masteryLevel: existing.masteryLevel,
        reviewCount: existing.reviewCount
      };
      await persistVocabItem(storage, updatedItem, key);
      return updatedItem;
    }
  }

  const id = createDeterministicId(deText, enText);
  const newItem: VocabItem = {
    id,
    createdAt: now,
    updatedAt: now,
    deText,
    enText,
    trText,
    pos,
    article,
    plural,
    verbConjugation,
    cefrLevel,
    ipa,
    grammarTip,
    examples,
    favorite: false,
    masteryLevel: 0,
    reviewCount: 0,
    nextReviewAt: now
  };

  await persistVocabItem(storage, newItem);
  return newItem;
}

export function filterVocabItems(
  items: VocabItem[],
  filter: VocabFilter,
  searchQuery?: string
): VocabItem[] {
  const byCategory = items.filter((item) => {
    switch (filter) {
      case "all":
        return true;
      case "der":
        return item.article === "der";
      case "die":
        return item.article === "die";
      case "das":
        return item.article === "das";
      case "verb":
        return item.pos === "verb" || Boolean(item.verbConjugation);
      case "english":
        return Boolean(item.enText);
      case "favorites":
        return item.favorite === true;
      default:
        return true;
    }
  });

  const q = normalizeText(searchQuery);
  if (!q) {
    return byCategory;
  }

  return byCategory.filter((item) => {
    const deWithArticle = item.article ? `${item.article} ${item.deText}` : item.deText;
    if (normalizeText(item.deText).includes(q)) return true;
    if (normalizeText(deWithArticle).includes(q)) return true;
    if (normalizeText(item.enText).includes(q)) return true;
    if (normalizeText(item.trText).includes(q)) return true;
    if (item.plural && normalizeText(item.plural).includes(q)) return true;
    if (
      item.examples.some(
        (ex) =>
          normalizeText(ex.sentence).includes(q) ||
          normalizeText(ex.translationTr).includes(q)
      )
    ) {
      return true;
    }
    return false;
  });
}

export async function toggleVocabFavorite(
  storage: StorageLike,
  id: string
): Promise<VocabItem | null> {
  const found = await findStoredItemById(storage, id);
  if (!found) return null;

  const updated: VocabItem = {
    ...found.item,
    favorite: !found.item.favorite,
    updatedAt: Date.now()
  };

  await persistVocabItem(storage, updated, found.key);
  return updated;
}

export async function removeVocabItem(
  storage: StorageLike,
  id: string
): Promise<void> {
  const found = await findStoredItemById(storage, id);
  if (found) {
    await storage.delete(found.key);
    return;
  }
  await storage.delete(`${VOCAB_ITEM_PREFIX}${id}`);
}

export async function recordFlashcardReview(
  storage: StorageLike,
  id: string,
  outcome: "easy" | "again"
): Promise<VocabItem | null> {
  const found = await findStoredItemById(storage, id);
  if (!found) return null;

  const now = Date.now();
  const prevMastery = found.item.masteryLevel;
  let masteryLevel: number;
  let nextReviewAt: number;

  if (outcome === "easy") {
    masteryLevel = Math.min(5, prevMastery + 1);
    const hours = REVIEW_INTERVAL_HOURS[Math.max(0, Math.min(4, masteryLevel - 1))];
    nextReviewAt = now + hours * 60 * 60 * 1000;
  } else {
    masteryLevel = Math.max(0, prevMastery - 1);
    nextReviewAt = now;
  }

  const updated: VocabItem = {
    ...found.item,
    masteryLevel,
    reviewCount: found.item.reviewCount + 1,
    lastReviewedAt: now,
    nextReviewAt,
    updatedAt: now
  };

  await persistVocabItem(storage, updated, found.key);
  return updated;
}

export function getDueFlashcards(
  items: VocabItem[],
  filter: VocabFilter = "all"
): VocabItem[] {
  const filtered = filterVocabItems(items, filter);
  return [...filtered].sort((a, b) => {
    if (a.masteryLevel !== b.masteryLevel) {
      return a.masteryLevel - b.masteryLevel;
    }
    const nextA = a.nextReviewAt ?? 0;
    const nextB = b.nextReviewAt ?? 0;
    if (nextA !== nextB) {
      return nextA - nextB;
    }
    return b.updatedAt - a.updatedAt;
  });
}

function buildStarterGermanVocab(baseTime: number): VocabItem[] {
  return [
    {
      id: "buch",
      createdAt: baseTime - 5000,
      updatedAt: baseTime - 5000,
      deText: "Buch",
      enText: "book",
      trText: "kitap",
      pos: "noun",
      article: "das",
      plural: "die Bücher",
      cefrLevel: "A1",
      ipa: "/buːx/",
      grammarTip:
        "Nötr (das) isimdir; çoğulda Umlaut alır ve '-er' ekiyle 'die Bücher' olur.",
      examples: [
        {
          id: "starter-buch-de-1",
          language: "de",
          sentence: "Ich lese das Buch jeden Abend.",
          translationTr: "Kitabı her akşam okuyorum.",
          translationEnOrDe: "I read the book every evening.",
          articleUsed: "das",
          highlightedSegments: [
            { text: "Ich lese " },
            { text: "das", isArticle: true, articleGender: "das" },
            { text: " " },
            { text: "Buch", isTargetWord: true, articleGender: "das" },
            { text: " jeden Abend." }
          ],
          source: "curated"
        },
        {
          id: "starter-buch-en-1",
          language: "en",
          sentence: "This book explains German grammar clearly.",
          translationTr: "Bu kitap Almanca dilbilgisini açıkça anlatıyor.",
          translationEnOrDe: "Dieses Buch erklärt die deutsche Grammatik klar.",
          source: "curated"
        }
      ],
      favorite: true,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime - 5000
    },
    {
      id: "schluessel",
      createdAt: baseTime - 4000,
      updatedAt: baseTime - 4000,
      deText: "Schlüssel",
      enText: "key",
      trText: "anahtar",
      pos: "noun",
      article: "der",
      plural: "die Schlüssel",
      cefrLevel: "A1",
      ipa: "/ˈʃlʏsl̩/",
      grammarTip:
        "'-el' ile biten çoğu isim gibi eril (der) artikel alır ve çoğul hali tekille aynı kalır (die Schlüssel).",
      examples: [
        {
          id: "starter-schluessel-de-1",
          language: "de",
          sentence: "Wo ist der Schlüssel für die Wohnung?",
          translationTr: "Dairenin anahtarı nerede?",
          translationEnOrDe: "Where is the key for the apartment?",
          articleUsed: "der",
          highlightedSegments: [
            { text: "Wo ist " },
            { text: "der", isArticle: true, articleGender: "der" },
            { text: " " },
            { text: "Schlüssel", isTargetWord: true, articleGender: "der" },
            { text: " für die Wohnung?" }
          ],
          source: "curated"
        },
        {
          id: "starter-schluessel-en-1",
          language: "en",
          sentence: "Consistency is the key to learning a new language.",
          translationTr: "İstikrar yeni bir dil öğrenmenin anahtarıdır.",
          translationEnOrDe: "Beständigkeit ist der Schlüssel zum Erlernen einer neuen Sprache.",
          source: "curated"
        }
      ],
      favorite: false,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime - 4000
    },
    {
      id: "entscheidung",
      createdAt: baseTime - 3000,
      updatedAt: baseTime - 3000,
      deText: "Entscheidung",
      enText: "decision",
      trText: "karar",
      pos: "noun",
      article: "die",
      plural: "die Entscheidungen",
      cefrLevel: "B1",
      ipa: "/ɛntˈʃaɪ̯dʊŋ/",
      grammarTip:
        "'-ung' sonekiyle biten tüm Almanca isimler daima dişil (die) artikel alır; çoğulu '-en' ile yapılır.",
      examples: [
        {
          id: "starter-entscheidung-de-1",
          language: "de",
          sentence: "Das war eine wichtige Entscheidung.",
          translationTr: "Bu önemli bir karardı.",
          translationEnOrDe: "That was an important decision.",
          articleUsed: "die",
          highlightedSegments: [
            { text: "Das war " },
            { text: "eine", isArticle: true, articleGender: "die" },
            { text: " wichtige " },
            { text: "Entscheidung", isTargetWord: true, articleGender: "die" },
            { text: "." }
          ],
          source: "curated"
        },
        {
          id: "starter-entscheidung-en-1",
          language: "en",
          sentence: "We need to make a final decision by tomorrow.",
          translationTr: "Yarına kadar nihai bir karar vermemiz gerekiyor.",
          translationEnOrDe: "Wir müssen bis morgen eine endgültige Entscheidung treffen.",
          source: "curated"
        }
      ],
      favorite: false,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime - 3000
    },
    {
      id: "sprechen",
      createdAt: baseTime - 2000,
      updatedAt: baseTime - 2000,
      deText: "sprechen",
      enText: "to speak",
      trText: "konuşmak",
      pos: "verb",
      verbConjugation: {
        infinitive: "sprechen",
        praesensIch: "spreche",
        praesensDu: "sprichst",
        praesensErSieEs: "spricht",
        praeteritumIch: "sprach",
        perfekt: "hat gesprochen",
        auxiliary: "haben",
        partizipII: "gesprochen",
        separable: false
      },
      cefrLevel: "A1",
      ipa: "/ˈʃpʁɛçn̩/",
      grammarTip:
        "Düzensiz (güçlü) fiildir: du/er/sie/es çekiminde kök ünlüsü 'e → i' olur (sprichst, spricht). 'über + Akkusativ' veya 'mit + Dativ' ile kullanılır.",
      examples: [
        {
          id: "starter-sprechen-de-1",
          language: "de",
          sentence: "Sie spricht fließend Deutsch und Englisch.",
          translationTr: "O akıcı bir şekilde Almanca ve İngilizce konuşuyor.",
          translationEnOrDe: "She speaks German and English fluently.",
          highlightedSegments: [
            { text: "Sie " },
            { text: "spricht", isTargetWord: true },
            { text: " fließend Deutsch und Englisch." }
          ],
          source: "curated"
        },
        {
          id: "starter-sprechen-en-1",
          language: "en",
          sentence: "Can I speak with you for a moment?",
          translationTr: "Sizinle bir dakika konuşabilir miyim?",
          translationEnOrDe: "Kann ich kurz mit dir sprechen?",
          source: "curated"
        }
      ],
      favorite: false,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime - 2000
    },
    {
      id: "erfahrung",
      createdAt: baseTime - 1000,
      updatedAt: baseTime - 1000,
      deText: "Erfahrung",
      enText: "experience",
      trText: "deneyim",
      pos: "noun",
      article: "die",
      plural: "die Erfahrungen",
      cefrLevel: "B1",
      ipa: "/ɛɐ̯ˈfaːʁʊŋ/",
      grammarTip:
        "'-ung' ile bittiği için dişil (die) isimdir. Genellikle 'Erfahrungen sammeln' (deneyim kazanmak) kalıbıyla kullanılır.",
      examples: [
        {
          id: "starter-erfahrung-de-1",
          language: "de",
          sentence: "Die Erfahrung im Ausland war sehr wertvoll.",
          translationTr: "Yurt dışındaki deneyim çok değerliydi.",
          translationEnOrDe: "The experience abroad was very valuable.",
          articleUsed: "die",
          highlightedSegments: [
            { text: "Die", isArticle: true, articleGender: "die" },
            { text: " " },
            { text: "Erfahrung", isTargetWord: true, articleGender: "die" },
            { text: " im Ausland war sehr wertvoll." }
          ],
          source: "curated"
        },
        {
          id: "starter-erfahrung-en-1",
          language: "en",
          sentence: "She has five years of experience in software engineering.",
          translationTr: "Yazılım mühendisliğinde beş yıllık deneyime sahip.",
          translationEnOrDe: "Sie hat fünf Jahre Erfahrung in der Softwareentwicklung.",
          source: "curated"
        }
      ],
      favorite: false,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime - 1000
    },
    {
      id: "verstehen",
      createdAt: baseTime,
      updatedAt: baseTime,
      deText: "verstehen",
      enText: "to understand",
      trText: "anlamak",
      pos: "verb",
      verbConjugation: {
        infinitive: "verstehen",
        praesensIch: "verstehe",
        praesensDu: "verstehst",
        praesensErSieEs: "versteht",
        praeteritumIch: "verstand",
        perfekt: "hat verstanden",
        auxiliary: "haben",
        partizipII: "verstanden",
        separable: false
      },
      cefrLevel: "A1",
      ipa: "/fɛɐ̯ˈʃteːən/",
      grammarTip:
        "'ver-' ayrılmaz önek (untrennbares Präfix) olduğu için Partizip II formunda '-ge-' almaz: 'hat verstanden'.",
      examples: [
        {
          id: "starter-verstehen-de-1",
          language: "de",
          sentence: "Ich verstehe deine Frage vollkommen.",
          translationTr: "Sorunu tamamen anlıyorum.",
          translationEnOrDe: "I understand your question completely.",
          highlightedSegments: [
            { text: "Ich " },
            { text: "verstehe", isTargetWord: true },
            { text: " deine Frage vollkommen." }
          ],
          source: "curated"
        },
        {
          id: "starter-verstehen-en-1",
          language: "en",
          sentence: "It is easy to understand the rule with examples.",
          translationTr: "Örneklerle kuralı anlamak kolaydır.",
          translationEnOrDe: "Es ist einfach, die Regel mit Beispielen zu verstehen.",
          source: "curated"
        }
      ],
      favorite: false,
      masteryLevel: 0,
      reviewCount: 0,
      nextReviewAt: baseTime
    }
  ];
}

export async function seedStarterGermanVocabIfEmpty(
  storage: StorageLike
): Promise<VocabItem[]> {
  const alreadySeeded = await storage.get(VOCAB_SEEDED_KEY);
  const existing = await listVocabItems(storage);

  if (alreadySeeded || existing.length > 0) {
    return existing;
  }

  const starterItems = buildStarterGermanVocab(Date.now());
  for (const item of starterItems) {
    await persistVocabItem(storage, item);
  }
  await storage.set(VOCAB_SEEDED_KEY, "true");

  return listVocabItems(storage);
}

export async function purgeStarterVocabOnce(
  storage: StorageLike
): Promise<VocabItem[]> {
  const purged = await storage.get("vocab:starter_purged");
  if (!purged) {
    const starterIds = [
      "buch",
      "schluessel",
      "entscheidung",
      "sprechen",
      "erfahrung",
      "verstehen"
    ];
    for (const id of starterIds) {
      await storage.delete(`${VOCAB_ITEM_PREFIX}${id}`);
    }
    await storage.delete(VOCAB_SEEDED_KEY);
    await storage.set("vocab:starter_purged", "true");
  }
  return listVocabItems(storage);
}
