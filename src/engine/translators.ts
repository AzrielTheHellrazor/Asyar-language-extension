import type {
  ArticleGender,
  DictionaryMeaningGroup,
  ExampleSentence,
  GermanGrammarInfo,
  HighlightSegment,
  NetworkLike,
  SupportedLang,
} from "../types";

export interface GoogleRichResult {
  translatedText: string;
  detectedFrom: string;
  pronunciation?: string;
  alternatives: string[];
  meanings: DictionaryMeaningGroup[];
  rawExamples: string[];
  synonyms: string[];
}

const GERMAN_ARTICLES = new Set(["der", "die", "das"]);
const INFLECTED_GERMAN_ARTICLES: Record<string, ArticleGender> = {
  der: "der",
  die: "die",
  das: "das",
  den: "der",
  dem: "der",
  des: "der",
  ein: "der",
  eine: "die",
  einen: "der",
  einem: "der",
  einer: "die",
  eines: "der",
};

function stripHtmlTags(input: string): string {
  return input
    .replace(/<\/?b>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractLeadingGermanArticle(text: string): {
  article?: ArticleGender;
  stem: string;
} {
  const trimmed = text.trim();
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (!match) {
    return { stem: trimmed };
  }
  const lowerArticle = match[1].toLowerCase();
  if (GERMAN_ARTICLES.has(lowerArticle)) {
    return {
      article: lowerArticle as ArticleGender,
      stem: match[2].trim(),
    };
  }
  return { stem: trimmed };
}

function addUnique(target: string[], value: string, maxCount = 20): void {
  const cleaned = value.trim();
  if (!cleaned || target.length >= maxCount) return;
  const exists = target.some(
    (item) => item.toLowerCase() === cleaned.toLowerCase()
  );
  if (!exists) {
    target.push(cleaned);
  }
}

/**
 * Parses the nested array returned by Google Translate's `translate_a/single` endpoint
 * (`client=gtx&dt=t&dt=bd&dt=ex&dt=ss&dt=md&dt=rm`).
 */
export function parseGoogleRichResponse(
  rawJson: unknown,
  requestedFrom: string,
  targetLang: SupportedLang
): GoogleRichResult {
  const result: GoogleRichResult = {
    translatedText: "",
    detectedFrom: requestedFrom === "auto" ? "en" : requestedFrom,
    alternatives: [],
    meanings: [],
    rawExamples: [],
    synonyms: [],
  };

  if (!Array.isArray(rawJson)) {
    return result;
  }

  // rawJson[0]: translation segments & pronunciation
  const segments = rawJson[0];
  if (Array.isArray(segments)) {
    const textParts: string[] = [];
    for (const chunk of segments) {
      if (!Array.isArray(chunk)) continue;
      if (typeof chunk[0] === "string") {
        textParts.push(chunk[0]);
      }
      if (!result.pronunciation) {
        if (typeof chunk[2] === "string" && chunk[2].trim().length > 0) {
          result.pronunciation = chunk[2].trim();
        } else if (typeof chunk[3] === "string" && chunk[3].trim().length > 0) {
          result.pronunciation = chunk[3].trim();
        }
      }
    }
    result.translatedText = textParts.join("").trim();
  }

  // rawJson[2]: detected source language
  if (typeof rawJson[2] === "string" && rawJson[2].trim().length > 0) {
    result.detectedFrom = rawJson[2].trim();
  }

  // rawJson[1]: dictionary entries (dt=bd)
  const dictEntries = rawJson[1];
  if (Array.isArray(dictEntries)) {
    for (const entry of dictEntries) {
      if (!Array.isArray(entry)) continue;
      const pos =
        typeof entry[0] === "string" && entry[0].trim().length > 0
          ? entry[0].trim()
          : "other";
      const termsArray = Array.isArray(entry[1]) ? entry[1] : [];
      const detailedEntriesArray = Array.isArray(entry[2]) ? entry[2] : [];

      for (const alt of termsArray) {
        if (typeof alt === "string" && alt.trim().length > 0) {
          if (
            alt.trim().toLowerCase() !== result.translatedText.toLowerCase()
          ) {
            addUnique(result.alternatives, alt);
          }
        }
      }

      const terms: DictionaryMeaningGroup["terms"] = [];

      if (detailedEntriesArray.length > 0) {
        for (const detail of detailedEntriesArray) {
          if (!Array.isArray(detail) || typeof detail[0] !== "string") continue;
          const word = detail[0].trim();
          if (!word) continue;

          if (word.toLowerCase() !== result.translatedText.toLowerCase()) {
            addUnique(result.alternatives, word);
          }

          const reverseRaw = Array.isArray(detail[1]) ? detail[1] : [];
          const reverseTranslations = reverseRaw
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);

          const termEntry: DictionaryMeaningGroup["terms"][number] = {
            word,
            reverseTranslations,
          };

          if (targetLang === "de") {
            const { article } = extractLeadingGermanArticle(word);
            if (article) {
              termEntry.article = article;
            }
          }

          terms.push(termEntry);
        }
      } else {
        for (const rawTerm of termsArray) {
          if (typeof rawTerm !== "string" || !rawTerm.trim()) continue;
          const word = rawTerm.trim();
          const termEntry: DictionaryMeaningGroup["terms"][number] = {
            word,
            reverseTranslations: [],
          };
          if (targetLang === "de") {
            const { article } = extractLeadingGermanArticle(word);
            if (article) {
              termEntry.article = article;
            }
          }
          terms.push(termEntry);
        }
      }

      if (terms.length > 0) {
        result.meanings.push({
          pos,
          language: targetLang,
          terms,
        });
      }
    }
  }

  // rawJson[11]: synonyms (dt=ss)
  const synonymBlocks = rawJson[11];
  if (Array.isArray(synonymBlocks)) {
    for (const block of synonymBlocks) {
      if (typeof block === "string") {
        addUnique(result.synonyms, block);
        continue;
      }
      if (!Array.isArray(block)) continue;

      const synGroups = Array.isArray(block[1]) ? block[1] : block;
      for (const group of synGroups) {
        if (typeof group === "string") {
          addUnique(result.synonyms, group);
        } else if (Array.isArray(group)) {
          const candidates = Array.isArray(group[0]) ? group[0] : group;
          for (const syn of candidates) {
            if (typeof syn === "string") {
              addUnique(result.synonyms, syn);
            }
          }
        }
      }
    }
  }

  // rawJson[13]: examples (dt=ex)
  const exampleBlocks = rawJson[13];
  if (Array.isArray(exampleBlocks)) {
    for (const block of exampleBlocks) {
      if (typeof block === "string") {
        addUnique(result.rawExamples, stripHtmlTags(block));
      } else if (Array.isArray(block)) {
        if (typeof block[0] === "string") {
          addUnique(result.rawExamples, stripHtmlTags(block[0]));
        } else {
          for (const row of block) {
            if (typeof row === "string") {
              addUnique(result.rawExamples, stripHtmlTags(row));
            } else if (Array.isArray(row) && typeof row[0] === "string") {
              addUnique(result.rawExamples, stripHtmlTags(row[0]));
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Queries Google Translate's `translate_a/single` rich endpoint and parses translations,
 * dictionary meanings, examples, and synonyms.
 */
export async function fetchGoogleRichTranslate(
  network: NetworkLike,
  params: {
    text: string;
    from?: string;
    to: SupportedLang;
    timeoutMs?: number;
  }
): Promise<GoogleRichResult> {
  const sl = params.from ?? "auto";
  const tl = params.to;
  const dtParams = ["t", "bd", "ex", "ss", "md", "rm"]
    .map((dt) => `dt=${dt}`)
    .join("&");
  const query = encodeURIComponent(params.text.trim());
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sl
  )}&tl=${encodeURIComponent(tl)}&hl=${encodeURIComponent(
    tl
  )}&${dtParams}&ie=UTF-8&oe=UTF-8&q=${query}`;

  const response = await network.fetch(url, {
    method: "GET",
    timeout: params.timeoutMs ?? 8000,
  });

  if (!response.ok) {
    throw new Error(
      `Google Translate request failed with status ${response.status}: ${response.statusText}`
    );
  }

  const rawJson: unknown = JSON.parse(response.body);
  return parseGoogleRichResponse(rawJson, sl, tl);
}

/**
 * Fetches English IPA phonetics, definitions, example sentences, and synonyms
 * from `api.dictionaryapi.dev`. Never throws on 404 or network errors.
 */
export async function fetchEnglishDictionary(
  network: NetworkLike,
  englishWord: string
): Promise<{
  ipa?: string;
  definitions: string[];
  examples: string[];
  synonyms: string[];
}> {
  const empty = {
    definitions: [] as string[],
    examples: [] as string[],
    synonyms: [] as string[],
  };

  const clean = englishWord
    .trim()
    .replace(/^(to|the|a|an)\s+/i, "")
    .trim()
    .toLowerCase();

  if (!clean) {
    return empty;
  }

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
    clean
  )}`;

  try {
    const response = await network.fetch(url, {
      method: "GET",
      timeout: 6000,
    });

    if (!response.ok) {
      return empty;
    }

    const parsed: unknown = JSON.parse(response.body);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return empty;
    }

    let ipa: string | undefined;
    const definitions: string[] = [];
    const examples: string[] = [];
    const synonyms: string[] = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;

      if (
        !ipa &&
        typeof record.phonetic === "string" &&
        record.phonetic.trim()
      ) {
        ipa = record.phonetic.trim();
      }

      if (!ipa && Array.isArray(record.phonetics)) {
        for (const p of record.phonetics) {
          if (p && typeof p === "object") {
            const pText = (p as Record<string, unknown>).text;
            if (typeof pText === "string" && pText.trim()) {
              ipa = pText.trim();
              break;
            }
          }
        }
      }

      if (Array.isArray(record.meanings)) {
        for (const meaning of record.meanings) {
          if (!meaning || typeof meaning !== "object") continue;
          const mObj = meaning as Record<string, unknown>;

          if (Array.isArray(mObj.synonyms)) {
            for (const syn of mObj.synonyms) {
              if (typeof syn === "string") {
                addUnique(synonyms, syn, 15);
              }
            }
          }

          if (Array.isArray(mObj.definitions)) {
            for (const def of mObj.definitions) {
              if (!def || typeof def !== "object") continue;
              const dObj = def as Record<string, unknown>;

              if (typeof dObj.definition === "string") {
                addUnique(definitions, dObj.definition, 10);
              }
              if (typeof dObj.example === "string") {
                addUnique(examples, dObj.example, 10);
              }
              if (Array.isArray(dObj.synonyms)) {
                for (const syn of dObj.synonyms) {
                  if (typeof syn === "string") {
                    addUnique(synonyms, syn, 15);
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      ...(ipa ? { ipa } : {}),
      definitions,
      examples,
      synonyms,
    };
  } catch {
    return empty;
  }
}

/**
 * Splits a German example sentence into segments, marking definite/indefinite articles
 * and the target vocabulary word for UI highlighting.
 */
export function highlightGermanExample(
  sentence: string,
  targetWord?: string,
  article?: ArticleGender
): HighlightSegment[] {
  if (!sentence) return [];

  const cleanTarget = targetWord
    ? extractLeadingGermanArticle(targetWord).stem.toLowerCase()
    : "";

  const tokens = sentence
    .split(/(\s+|[.,!?;:"„“”()[\]-]+)/)
    .filter((token) => token.length > 0);

  const segments: HighlightSegment[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const isWordToken = /^[a-zA-ZäöüÄÖÜß]+$/.test(token);

    if (isWordToken && lower in INFLECTED_GERMAN_ARTICLES) {
      const gender = article ?? INFLECTED_GERMAN_ARTICLES[lower];
      segments.push({
        text: token,
        isArticle: true,
        articleGender: gender,
      });
      continue;
    }

    if (
      isWordToken &&
      cleanTarget.length >= 2 &&
      (lower === cleanTarget || lower.startsWith(cleanTarget))
    ) {
      segments.push({
        text: token,
        isTargetWord: true,
        ...(article ? { articleGender: article } : {}),
      });
      continue;
    }

    const prev = segments[segments.length - 1];
    if (prev && !prev.isArticle && !prev.isTargetWord) {
      prev.text += token;
    } else {
      segments.push({ text: token });
    }
  }

  return segments;
}

/**
 * Generates high-quality German (`de`) and English (`en`) fallback example sentences
 * with Turkish (`translationTr`) and cross-language (`translationEnOrDe`) translations.
 */
export function buildFallbackExamples(params: {
  deWord: string;
  enWord: string;
  trWord: string;
  grammar?: GermanGrammarInfo | null;
}): ExampleSentence[] {
  const deClean = extractLeadingGermanArticle(params.deWord).stem || params.deWord.trim();
  const enClean =
    params.enWord
      .trim()
      .replace(/^(to|the|a|an)\s+/i, "")
      .trim() || params.enWord.trim();
  const trClean = params.trWord.trim();
  const grammar = params.grammar;

  // Case 1: German Noun with article (Nominativ + Akkusativ/Dativ examples + English example)
  if (grammar?.noun) {
    const { article } = grammar.noun;
    const singular = capitalize(
      extractLeadingGermanArticle(grammar.noun.singular || deClean).stem
    );
    const nomArticle = capitalize(article);
    const akkArticle = article === "der" ? "den" : article;
    const datArticle = article === "die" ? "der" : "dem";

    const deNominativ = `${nomArticle} ${singular} spielt im Alltag eine wichtige Rolle.`;
    const deAkkDat = `Ich brauche ${akkArticle} ${singular} heute und arbeite mit ${datArticle} ${singular}.`;
    const enSentence = `The ${enClean} plays an important role in everyday life.`;

    return [
      {
        id: `fallback-de-nom-${singular.toLowerCase()}`,
        language: "de",
        sentence: deNominativ,
        translationTr: `${capitalize(trClean)} günlük hayatta önemli bir rol oynar.`,
        translationEnOrDe: enSentence,
        articleUsed: article,
        highlightedSegments: highlightGermanExample(
          deNominativ,
          singular,
          article
        ),
        source: "curated",
      },
      {
        id: `fallback-de-akk-${singular.toLowerCase()}`,
        language: "de",
        sentence: deAkkDat,
        translationTr: `Bugün ${trClean} gerekiyor ve ${trClean} ile çalışıyorum.`,
        translationEnOrDe: `I need the ${enClean} today and work with the ${enClean}.`,
        articleUsed: article,
        highlightedSegments: highlightGermanExample(
          deAkkDat,
          singular,
          article
        ),
        source: "curated",
      },
      {
        id: `fallback-en-noun-${enClean.toLowerCase()}`,
        language: "en",
        sentence: enSentence,
        translationTr: `${capitalize(trClean)} günlük hayatta önemli bir rol oynar.`,
        translationEnOrDe: deNominativ,
        source: "curated",
      },
    ];
  }

  // Case 2: German Verb (Präsens/Infinitiv + Perfekt context + English example)
  if (grammar?.verb) {
    const infinitive = (grammar.verb.infinitive || deClean).trim().toLowerCase();
    const perfekt = grammar.verb.perfekt?.trim();

    const deVerbSentence = perfekt
      ? `Wir wollen heute ${infinitive}, denn gestern (${perfekt}) hat es gut geklappt.`
      : `Wir wollen heute ${infinitive}, weil es im Alltag sehr nützlich ist.`;

    const enVerbSentence = `It is important to ${enClean} regularly in everyday situations.`;

    return [
      {
        id: `fallback-de-verb-${infinitive}`,
        language: "de",
        sentence: deVerbSentence,
        translationTr: `Bugün ${trClean} istiyoruz çünkü günlük hayatta çok faydalıdır.`,
        translationEnOrDe: `We want to ${enClean} today because it works well in everyday life.`,
        highlightedSegments: highlightGermanExample(deVerbSentence, infinitive),
        source: "curated",
      },
      {
        id: `fallback-en-verb-${enClean.toLowerCase()}`,
        language: "en",
        sentence: enVerbSentence,
        translationTr: `Günlük durumlarda düzenli olarak ${trClean} önemlidir.`,
        translationEnOrDe: `Es ist wichtig, im Alltag regelmäßig zu ${infinitive}.`,
        source: "curated",
      },
    ];
  }

  // Case 3: General phrase / adjective / adverb / other
  const { article: detectedArticle, stem: deTarget } =
    extractLeadingGermanArticle(params.deWord);
  const dePhraseSentence = `Im Alltag verwenden wir „${params.deWord.trim()}“ in vielen Gesprächen.`;
  const enPhraseSentence = `In this context, "${enClean}" is a very common expression.`;

  return [
    {
      id: `fallback-de-gen-${deTarget.toLowerCase()}`,
      language: "de",
      sentence: dePhraseSentence,
      translationTr: `Günlük hayatta birçok konuşmada "${trClean}" ifadesini kullanırız.`,
      translationEnOrDe: `In everyday life, we use "${enClean}" in many conversations.`,
      ...(detectedArticle ? { articleUsed: detectedArticle } : {}),
      highlightedSegments: highlightGermanExample(
        dePhraseSentence,
        deTarget,
        detectedArticle
      ),
      source: "curated",
    },
    {
      id: `fallback-en-gen-${enClean.toLowerCase()}`,
      language: "en",
      sentence: enPhraseSentence,
      translationTr: `Bu bağlamda "${trClean}" çok yaygın bir ifadedir.`,
      translationEnOrDe: `In diesem Zusammenhang ist „${params.deWord.trim()}“ ein sehr gebräuchlicher Ausdruck.`,
      source: "curated",
    },
  ];
}
