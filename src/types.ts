export type SupportedLang = "de" | "en" | "tr";

export type ArticleGender = "der" | "die" | "das";

export type WordPartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase"
  | "other";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface GermanNounGrammar {
  article: ArticleGender;
  genderLabel: "Maskulin (Eril)" | "Feminin (Dişil)" | "Neutral (Nötr)";
  singular: string;
  plural?: string;
  genitive?: string;
}

export interface GermanVerbConjugation {
  infinitive: string;
  praesensIch?: string;
  praesensDu?: string;
  praesensErSieEs?: string;
  praeteritumIch?: string;
  perfekt?: string;
  auxiliary?: "haben" | "sein";
  partizipII?: string;
  separable?: boolean;
}

export interface GermanGrammarInfo {
  word: string;
  pos: WordPartOfSpeech;
  cefrLevel?: CefrLevel;
  ipa?: string;
  noun?: GermanNounGrammar;
  verb?: GermanVerbConjugation;
  grammarTip?: string;
  synonyms?: string[];
}

export interface HighlightSegment {
  text: string;
  isArticle?: boolean;
  isTargetWord?: boolean;
  articleGender?: ArticleGender;
}

export interface ExampleSentence {
  id: string;
  language: "de" | "en";
  sentence: string;
  translationTr: string;
  translationEnOrDe?: string;
  articleUsed?: ArticleGender;
  highlightedSegments?: HighlightSegment[];
  source: "wiktionary" | "google" | "dictionaryapi" | "curated" | "ai";
}

export interface DictionaryMeaningGroup {
  pos: string;
  language: SupportedLang;
  terms: Array<{
    word: string;
    reverseTranslations: string[];
    article?: ArticleGender;
  }>;
}

export interface LanguageTranslationCard {
  lang: SupportedLang;
  label: string;
  flag: string;
  primaryText: string;
  alternatives: string[];
  pronunciation?: string;
  article?: ArticleGender;
  plural?: string;
}

export interface PolyglotEntry {
  query: string;
  detectedLang: SupportedLang | string;
  timestamp: number;
  translations: {
    de: LanguageTranslationCard;
    en: LanguageTranslationCard;
    tr: LanguageTranslationCard;
  };
  germanGrammar: GermanGrammarInfo | null;
  englishDetails?: {
    word: string;
    ipa?: string;
    definitions: string[];
    synonyms: string[];
  };
  meanings: DictionaryMeaningGroup[];
  examples: ExampleSentence[];
  synonyms: {
    de: string[];
    en: string[];
  };
}

export type VocabFilter =
  | "all"
  | "der"
  | "die"
  | "das"
  | "verb"
  | "english"
  | "favorites";

export interface VocabItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  deText: string;
  enText: string;
  trText: string;
  pos: WordPartOfSpeech;
  article?: ArticleGender;
  plural?: string;
  verbConjugation?: GermanVerbConjugation;
  cefrLevel?: CefrLevel;
  ipa?: string;
  grammarTip?: string;
  examples: ExampleSentence[];
  favorite: boolean;
  masteryLevel: number; // 0 (new) to 5 (mastered)
  reviewCount: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
}

export interface NetworkResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

export interface NetworkLike {
  fetch(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }
  ): Promise<NetworkResponseLike>;
}

export interface CacheLike {
  get(key: string): Promise<string | undefined>;
  set(
    key: string,
    value: string,
    options?: { expirationDate?: Date }
  ): Promise<void>;
  remove?(key: string): Promise<void>;
}

export interface StorageLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  clear(): Promise<void>;
}
