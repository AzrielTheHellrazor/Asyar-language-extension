import type {
  ArticleGender,
  CacheLike,
  CefrLevel,
  DictionaryMeaningGroup,
  ExampleSentence,
  GermanGrammarInfo,
  LanguageTranslationCard,
  NetworkLike,
  PolyglotEntry,
  SupportedLang,
} from "../types";
import {
  buildFallbackExamples,
  fetchEnglishDictionary,
  fetchGoogleRichTranslate,
  type GoogleRichResult,
} from "./translators";
import {
  extractArticleAndNoun,
  fetchGermanWiktionary,
  lookupCuratedGermanGrammar,
  segmentSentenceWithArticleHighlights,
} from "./wiktionary";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferArticleFromMeanings(
  meanings: DictionaryMeaningGroup[]
): ArticleGender | undefined {
  for (const group of meanings) {
    if (group.language === "de") {
      for (const term of group.terms) {
        if (term.article) return term.article;
        const extracted = extractArticleAndNoun(term.word);
        if (extracted.article) return extracted.article;
      }
    }
  }
  return undefined;
}

async function translateExampleToTurkish(
  network: NetworkLike,
  sentence: string,
  from: "de" | "en"
): Promise<string> {
  try {
    const res = await fetchGoogleRichTranslate(network, {
      text: sentence,
      from,
      to: "tr",
      timeoutMs: 5000,
    });
    return res.translatedText || sentence;
  } catch {
    return sentence;
  }
}

async function enrichWithOptionalAi(
  network: NetworkLike,
  entry: PolyglotEntry,
  opts: { aiProvider?: string; aiApiKey: string }
): Promise<void> {
  const apiKey = opts.aiApiKey.trim();
  if (!apiKey) return;

  const provider = opts.aiProvider === "openai" ? "openai" : "gemini";
  const prompt = [
    `You are a German-English-Turkish language tutor. Analyze the word/phrase "${entry.query}" (DE: "${entry.translations.de.primaryText}", EN: "${entry.translations.en.primaryText}", TR: "${entry.translations.tr.primaryText}").`,
    `Return ONLY valid JSON with shape:`,
    `{"cefrLevel":"A1"|"A2"|"B1"|"B2"|"C1"|"C2","grammarTip":"short Turkish tip about article/case/preposition usage","deExample":"German sentence using the word and its article","deExampleTr":"Turkish translation of deExample"}`,
  ].join("\n");

  try {
    let rawContent = "";
    if (provider === "openai") {
      const res = await network.fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
        timeout: 6000,
      });
      if (!res.ok) return;
      const data = JSON.parse(res.body);
      rawContent = data?.choices?.[0]?.message?.content ?? "";
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const res = await network.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        timeout: 6000,
      });
      if (!res.ok) return;
      const data = JSON.parse(res.body);
      rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]) as {
      cefrLevel?: CefrLevel;
      grammarTip?: string;
      deExample?: string;
      deExampleTr?: string;
    };

    if (entry.germanGrammar) {
      if (parsed.cefrLevel && !entry.germanGrammar.cefrLevel) {
        entry.germanGrammar.cefrLevel = parsed.cefrLevel;
      }
      if (parsed.grammarTip) {
        entry.germanGrammar.grammarTip = parsed.grammarTip;
      }
    }

    if (parsed.deExample && parsed.deExampleTr) {
      const article = entry.germanGrammar?.noun?.article ?? entry.translations.de.article;
      const targetNoun = entry.germanGrammar?.word ?? entry.translations.de.primaryText;
      entry.examples.unshift({
        id: `ai-de-${Date.now()}`,
        language: "de",
        sentence: parsed.deExample,
        translationTr: parsed.deExampleTr,
        articleUsed: article,
        highlightedSegments: segmentSentenceWithArticleHighlights(
          parsed.deExample,
          targetNoun,
          article
        ),
        source: "ai",
      });
    }
  } catch {
    // Non-fatal: AI enrichment is optional
  }
}

export async function lookupPolyglot(
  deps: { network: NetworkLike; cache?: CacheLike },
  query: string,
  opts?: { aiProvider?: string; aiApiKey?: string }
): Promise<PolyglotEntry> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Aramak için bir kelime veya cümle girin.");
  }

  const hasAi = Boolean(opts?.aiApiKey?.trim());
  const cacheKey = `polyglot:v1:${normalizeKey(trimmed)}${hasAi ? ":ai" : ""}`;

  if (deps.cache) {
    try {
      const cachedRaw = await deps.cache.get(cacheKey);
      if (cachedRaw) {
        return JSON.parse(cachedRaw) as PolyglotEntry;
      }
    } catch {
      // Ignore cache read error
    }
  }

  const directCurated = lookupCuratedGermanGrammar(trimmed);

  const [deSettled, enSettled, trSettled] = await Promise.allSettled([
    fetchGoogleRichTranslate(deps.network, { text: trimmed, from: "auto", to: "de" }),
    fetchGoogleRichTranslate(deps.network, { text: trimmed, from: "auto", to: "en" }),
    fetchGoogleRichTranslate(deps.network, { text: trimmed, from: "auto", to: "tr" }),
  ]);

  const emptyRich = (fallbackText: string): GoogleRichResult => ({
    translatedText: fallbackText,
    detectedFrom: "auto",
    alternatives: [],
    meanings: [],
    rawExamples: [],
    synonyms: [],
  });

  const deRes =
    deSettled.status === "fulfilled" ? deSettled.value : emptyRich(trimmed);
  const enRes =
    enSettled.status === "fulfilled" ? enSettled.value : emptyRich(trimmed);
  const trRes =
    trSettled.status === "fulfilled" ? trSettled.value : emptyRich(trimmed);

  let detectedLang: SupportedLang | string =
    directCurated
      ? "de"
      : deRes.detectedFrom !== "auto"
        ? deRes.detectedFrom
        : enRes.detectedFrom !== "auto"
          ? enRes.detectedFrom
          : trRes.detectedFrom;

  const deExtracted = extractArticleAndNoun(deRes.translatedText || trimmed);
  const deLookupCandidate = directCurated
    ? directCurated.grammar.word
    : deExtracted.noun || deRes.translatedText || trimmed;

  const translatedCurated =
    directCurated ?? lookupCuratedGermanGrammar(deLookupCandidate);

  const [wikiSettled, enDictSettled] = await Promise.allSettled([
    fetchGermanWiktionary(deps.network, deLookupCandidate),
    fetchEnglishDictionary(deps.network, enRes.translatedText || trimmed),
  ]);

  const wikiData =
    wikiSettled.status === "fulfilled"
      ? wikiSettled.value
      : { grammar: null, rawExamples: [], synonyms: [] };

  const enDictData =
    enDictSettled.status === "fulfilled"
      ? enDictSettled.value
      : { definitions: [], examples: [], synonyms: [] };

  const allMeanings: DictionaryMeaningGroup[] = [
    ...deRes.meanings,
    ...enRes.meanings,
    ...trRes.meanings,
  ];

  // Resolve German Grammar Info
  let germanGrammar: GermanGrammarInfo | null =
    wikiData.grammar ?? translatedCurated?.grammar ?? null;

  const inferredArticle =
    germanGrammar?.noun?.article ??
    deExtracted.article ??
    inferArticleFromMeanings(allMeanings);

  if (!germanGrammar && inferredArticle) {
    const genderLabels: Record<
      ArticleGender,
      "Maskulin (Eril)" | "Feminin (Dişil)" | "Neutral (Nötr)"
    > = {
      der: "Maskulin (Eril)",
      die: "Feminin (Dişil)",
      das: "Neutral (Nötr)",
    };
    const capNoun =
      deExtracted.noun.charAt(0).toUpperCase() + deExtracted.noun.slice(1);
    germanGrammar = {
      word: capNoun,
      pos: "noun",
      noun: {
        article: inferredArticle,
        genderLabel: genderLabels[inferredArticle],
        singular: capNoun,
      },
    };
  }

  const finalArticle = germanGrammar?.noun?.article ?? inferredArticle;
  const finalSingular =
    germanGrammar?.noun?.singular ?? deExtracted.noun ?? deRes.translatedText;
  const formattedDePrimary = finalArticle
    ? `${finalArticle} ${finalSingular}`
    : germanGrammar?.verb?.infinitive ?? deRes.translatedText ?? trimmed;

  const deCard: LanguageTranslationCard = {
    lang: "de",
    label: "Almanca (Deutsch)",
    flag: "🇩🇪",
    primaryText: formattedDePrimary,
    alternatives: deRes.alternatives.filter((a) => a !== formattedDePrimary).slice(0, 5),
    pronunciation: germanGrammar?.ipa ?? deRes.pronunciation,
    ...(finalArticle ? { article: finalArticle } : {}),
    ...(germanGrammar?.noun?.plural ? { plural: germanGrammar.noun.plural } : {}),
  };

  const enCard: LanguageTranslationCard = {
    lang: "en",
    label: "İngilizce (English)",
    flag: "🇬🇧",
    primaryText: enRes.translatedText || trimmed,
    alternatives: enRes.alternatives.slice(0, 5),
    pronunciation: enDictData.ipa ?? enRes.pronunciation,
  };

  const trCard: LanguageTranslationCard = {
    lang: "tr",
    label: "Türkçe (Turkish)",
    flag: "🇹🇷",
    primaryText: trRes.translatedText || trimmed,
    alternatives: trRes.alternatives.slice(0, 5),
  };

  // Assemble Examples (Curated + Wiktionary + English Dict + Fallback Guarantee)
  const examples: ExampleSentence[] = [];
  const targetDeWord = germanGrammar?.word ?? finalSingular;

  if (translatedCurated?.examples?.length) {
    for (let i = 0; i < translatedCurated.examples.length; i++) {
      const ex = translatedCurated.examples[i];
      examples.push({
        id: `curated-de-${i}`,
        language: "de",
        sentence: ex.de,
        translationTr: ex.tr,
        translationEnOrDe: ex.en,
        articleUsed: finalArticle,
        highlightedSegments: segmentSentenceWithArticleHighlights(
          ex.de,
          targetDeWord,
          finalArticle
        ),
        source: "curated",
      });
    }
  }

  // Wiktionary raw examples (if we still need German examples)
  if (examples.filter((e) => e.language === "de").length < 2) {
    const wikiCandidates = wikiData.rawExamples
      .filter((s) => !examples.some((existing) => existing.sentence === s))
      .slice(0, 2);

    const trTranslations = await Promise.all(
      wikiCandidates.map((s) => translateExampleToTurkish(deps.network, s, "de"))
    );

    wikiCandidates.forEach((sentence, idx) => {
      examples.push({
        id: `wiki-de-${idx}`,
        language: "de",
        sentence,
        translationTr: trTranslations[idx] || sentence,
        articleUsed: finalArticle,
        highlightedSegments: segmentSentenceWithArticleHighlights(
          sentence,
          targetDeWord,
          finalArticle
        ),
        source: "wiktionary",
      });
    });
  }

  // English examples from Free Dictionary API or Google Rich
  const rawEnExamples = [
    ...enDictData.examples,
    ...enRes.rawExamples,
  ].slice(0, 2);

  if (rawEnExamples.length > 0) {
    const enTrTranslations = await Promise.all(
      rawEnExamples.map((s) => translateExampleToTurkish(deps.network, s, "en"))
    );
    rawEnExamples.forEach((sentence, idx) => {
      examples.push({
        id: `dict-en-${idx}`,
        language: "en",
        sentence,
        translationTr: enTrTranslations[idx] || sentence,
        source: "dictionaryapi",
      });
    });
  }

  // Guarantee at least one DE and one EN example sentence with article highlights
  const fallbackExamples = buildFallbackExamples({
    deWord: deCard.primaryText,
    enWord: enCard.primaryText,
    trWord: trCard.primaryText,
    grammar: germanGrammar,
  });

  if (!examples.some((e) => e.language === "de")) {
    for (const fb of fallbackExamples.filter((e) => e.language === "de")) {
      examples.push({
        ...fb,
        highlightedSegments: segmentSentenceWithArticleHighlights(
          fb.sentence,
          targetDeWord,
          finalArticle
        ),
      });
    }
  }

  if (!examples.some((e) => e.language === "en")) {
    for (const fb of fallbackExamples.filter((e) => e.language === "en")) {
      examples.push(fb);
    }
  }

  const deSynonyms = Array.from(
    new Set([
      ...(germanGrammar?.synonyms ?? []),
      ...wikiData.synonyms,
      ...deRes.synonyms,
    ])
  ).slice(0, 10);

  const enSynonyms = Array.from(
    new Set([...enDictData.synonyms, ...enRes.synonyms])
  ).slice(0, 10);

  const entry: PolyglotEntry = {
    query: trimmed,
    detectedLang,
    timestamp: Date.now(),
    translations: {
      de: deCard,
      en: enCard,
      tr: trCard,
    },
    germanGrammar,
    englishDetails: {
      word: enCard.primaryText,
      ipa: enDictData.ipa ?? enRes.pronunciation,
      definitions: enDictData.definitions.slice(0, 4),
      synonyms: enSynonyms,
    },
    meanings: allMeanings,
    examples,
    synonyms: {
      de: deSynonyms,
      en: enSynonyms,
    },
  };

  if (opts?.aiApiKey?.trim()) {
    await enrichWithOptionalAi(deps.network, entry, {
      aiProvider: opts.aiProvider,
      aiApiKey: opts.aiApiKey,
    });
  }

  if (deps.cache) {
    try {
      await deps.cache.set(cacheKey, JSON.stringify(entry), {
        expirationDate: new Date(Date.now() + CACHE_TTL_MS),
      });
    } catch {
      // Ignore cache write error
    }
  }

  return entry;
}
