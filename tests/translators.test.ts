import { describe, expect, it, vi } from "vitest";
import {
  buildFallbackExamples,
  fetchEnglishDictionary,
  fetchGoogleRichTranslate,
  highlightGermanExample,
  parseGoogleRichResponse,
} from "../src/engine/translators";
import type { GermanGrammarInfo, NetworkLike } from "../src/types";

function createRealisticGooglePayload(): unknown[] {
  const payload: unknown[] = new Array(14).fill(null);

  // rawJson[0]: translation segments & pronunciation (dt=t, dt=rm)
  payload[0] = [
    ["der Tisch", "table", null, null, 10],
    [null, null, "tɪʃ", "ˈteɪbəl"],
  ];

  // rawJson[1]: dictionary entries (dt=bd)
  payload[1] = [
    [
      "noun",
      ["der Tisch", "die Tafel", "die Tabelle"],
      [
        ["der Tisch", ["table", "desk"], null, 0.45],
        ["die Tafel", ["board", "table", "panel"], null, 0.12],
        ["das Brett", ["plank", "board"], null, 0.05],
      ],
    ],
    [
      "verb",
      ["einreichen", "zurückstellen"],
      [["einreichen", ["submit", "table"], null, 0.02]],
    ],
  ];

  // rawJson[2]: detected source language
  payload[2] = "en";

  // rawJson[11]: synonyms (dt=ss)
  payload[11] = [
    [
      "noun",
      [
        [["desk", "counter", "worktable"], "m_en_us123"],
        [["chart", "schedule"], "m_en_us456"],
      ],
    ],
  ];

  // rawJson[13]: examples (dt=ex)
  payload[13] = [
    [
      [
        "They sat around the <b>table</b> for dinner.",
        null,
        null,
        null,
        null,
        "ex_1",
      ],
      [
        "Please put the book on the <b>table</b>.",
        null,
        null,
        null,
        null,
        "ex_2",
      ],
    ],
  ];

  return payload;
}

describe("parseGoogleRichResponse", () => {
  it("parses dt=t, dt=bd, dt=ex (stripping <b> tags), and dt=ss from realistic payload", () => {
    const raw = createRealisticGooglePayload();
    const res = parseGoogleRichResponse(raw, "auto", "de");

    expect(res.translatedText).toBe("der Tisch");
    expect(res.detectedFrom).toBe("en");
    expect(res.pronunciation).toBe("tɪʃ");

    expect(res.alternatives).toContain("die Tafel");
    expect(res.alternatives).toContain("die Tabelle");
    expect(res.alternatives).toContain("das Brett");
    expect(res.alternatives).not.toContain("der Tisch");

    expect(res.meanings).toHaveLength(2);
    expect(res.meanings[0].pos).toBe("noun");
    expect(res.meanings[0].language).toBe("de");
    expect(res.meanings[0].terms).toEqual([
      {
        word: "der Tisch",
        reverseTranslations: ["table", "desk"],
        article: "der",
      },
      {
        word: "die Tafel",
        reverseTranslations: ["board", "table", "panel"],
        article: "die",
      },
      {
        word: "das Brett",
        reverseTranslations: ["plank", "board"],
        article: "das",
      },
    ]);

    expect(res.synonyms).toEqual([
      "desk",
      "counter",
      "worktable",
      "chart",
      "schedule",
    ]);

    expect(res.rawExamples).toEqual([
      "They sat around the table for dinner.",
      "Please put the book on the table.",
    ]);
  });

  it("handles malformed or non-array payloads safely", () => {
    const res = parseGoogleRichResponse(null, "tr", "en");
    expect(res.translatedText).toBe("");
    expect(res.detectedFrom).toBe("tr");
    expect(res.alternatives).toEqual([]);
    expect(res.meanings).toEqual([]);
    expect(res.rawExamples).toEqual([]);
    expect(res.synonyms).toEqual([]);
  });
});

describe("fetchGoogleRichTranslate", () => {
  it("constructs the gtx URL with all dt parameters and parses the response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify(createRealisticGooglePayload()),
    });
    const network: NetworkLike = { fetch: mockFetch };

    const result = await fetchGoogleRichTranslate(network, {
      text: "table",
      from: "en",
      to: "de",
      timeoutMs: 5000,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain(
      "https://translate.googleapis.com/translate_a/single?client=gtx"
    );
    expect(calledUrl).toContain("sl=en");
    expect(calledUrl).toContain("tl=de");
    expect(calledUrl).toContain("dt=t");
    expect(calledUrl).toContain("dt=bd");
    expect(calledUrl).toContain("dt=ex");
    expect(calledUrl).toContain("dt=ss");
    expect(calledUrl).toContain("q=table");
    expect(calledOpts).toEqual({ method: "GET", timeout: 5000 });

    expect(result.translatedText).toBe("der Tisch");
    expect(result.rawExamples).toHaveLength(2);
  });

  it("throws when Google Translate returns a non-OK HTTP status", async () => {
    const network: NetworkLike = {
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "",
      }),
    };

    await expect(
      fetchGoogleRichTranslate(network, { text: "Haus", to: "en" })
    ).rejects.toThrow(/429/);
  });
});

describe("fetchEnglishDictionary", () => {
  it("strips leading 'to '/'the ' and parses IPA, definitions, examples, and synonyms on 200 OK", async () => {
    const mockApiPayload = [
      {
        word: "learn",
        phonetic: "/lɜːn/",
        phonetics: [{ text: "/lɜːrn/" }],
        meanings: [
          {
            partOfSpeech: "verb",
            synonyms: ["study", "acquire"],
            definitions: [
              {
                definition:
                  "To acquire knowledge or skill by study or experience.",
                example: "She is trying to learn German.",
                synonyms: ["master"],
              },
              {
                definition: "To commit to memory.",
                example: "Learn this poem by heart.",
              },
            ],
          },
        ],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify(mockApiPayload),
    });
    const network: NetworkLike = { fetch: mockFetch };

    const res = await fetchEnglishDictionary(network, "to learn");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.dictionaryapi.dev/api/v2/entries/en/learn"
    );
    expect(res.ipa).toBe("/lɜːn/");
    expect(res.definitions).toEqual([
      "To acquire knowledge or skill by study or experience.",
      "To commit to memory.",
    ]);
    expect(res.examples).toEqual([
      "She is trying to learn German.",
      "Learn this poem by heart.",
    ]);
    expect(res.synonyms).toEqual(["study", "acquire", "master"]);
  });

  it("returns empty arrays and never throws on 404 or network failure", async () => {
    const network404: NetworkLike = {
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: JSON.stringify({ title: "No Definitions Found" }),
      }),
    };

    const res404 = await fetchEnglishDictionary(network404, "the unknownword");
    expect(res404).toEqual({
      definitions: [],
      examples: [],
      synonyms: [],
    });

    const networkErr: NetworkLike = {
      fetch: vi.fn().mockRejectedValue(new Error("Offline")),
    };

    const resErr = await fetchEnglishDictionary(networkErr, "book");
    expect(resErr).toEqual({
      definitions: [],
      examples: [],
      synonyms: [],
    });
  });
});

describe("buildFallbackExamples & highlightGermanExample", () => {
  it("generates Nominativ and Akkusativ/Dativ German examples plus English example for 'der', 'die', 'das' nouns", () => {
    const derGrammar: GermanGrammarInfo = {
      word: "Tisch",
      pos: "noun",
      noun: {
        article: "der",
        genderLabel: "Maskulin (Eril)",
        singular: "Tisch",
        plural: "Tische",
      },
    };

    const derExamples = buildFallbackExamples({
      deWord: "der Tisch",
      enWord: "table",
      trWord: "masa",
      grammar: derGrammar,
    });

    expect(derExamples).toHaveLength(3);
    expect(derExamples[0].language).toBe("de");
    expect(derExamples[0].articleUsed).toBe("der");
    expect(derExamples[0].sentence).toContain("Der Tisch");
    expect(derExamples[1].sentence).toContain("den Tisch");
    expect(derExamples[1].sentence).toContain("dem Tisch");
    expect(derExamples[0].highlightedSegments?.some((s) => s.isArticle)).toBe(
      true
    );
    expect(
      derExamples[0].highlightedSegments?.some((s) => s.isTargetWord)
    ).toBe(true);
    expect(derExamples[2].language).toBe("en");
    expect(derExamples[2].translationTr).toContain("Masa");

    const dieGrammar: GermanGrammarInfo = {
      word: "Katze",
      pos: "noun",
      noun: {
        article: "die",
        genderLabel: "Feminin (Dişil)",
        singular: "Katze",
        plural: "Katzen",
      },
    };

    const dieExamples = buildFallbackExamples({
      deWord: "die Katze",
      enWord: "cat",
      trWord: "kedi",
      grammar: dieGrammar,
    });

    expect(dieExamples[0].articleUsed).toBe("die");
    expect(dieExamples[0].sentence).toContain("Die Katze");
    expect(dieExamples[1].sentence).toContain("die Katze");
    expect(dieExamples[1].sentence).toContain("der Katze");

    const dasGrammar: GermanGrammarInfo = {
      word: "Buch",
      pos: "noun",
      noun: {
        article: "das",
        genderLabel: "Neutral (Nötr)",
        singular: "Buch",
        plural: "Bücher",
      },
    };

    const dasExamples = buildFallbackExamples({
      deWord: "das Buch",
      enWord: "book",
      trWord: "kitap",
      grammar: dasGrammar,
    });

    expect(dasExamples[0].articleUsed).toBe("das");
    expect(dasExamples[0].sentence).toContain("Das Buch");
    expect(dasExamples[1].sentence).toContain("das Buch");
    expect(dasExamples[1].sentence).toContain("dem Buch");
  });

  it("generates natural German and English sentences for verbs (including Perfekt)", () => {
    const verbGrammar: GermanGrammarInfo = {
      word: "gehen",
      pos: "verb",
      verb: {
        infinitive: "gehen",
        praesensIch: "gehe",
        praesensErSieEs: "geht",
        perfekt: "ist gegangen",
        auxiliary: "sein",
        partizipII: "gegangen",
      },
    };

    const examples = buildFallbackExamples({
      deWord: "gehen",
      enWord: "to go",
      trWord: "gitmek",
      grammar: verbGrammar,
    });

    expect(examples.length).toBeGreaterThanOrEqual(2);
    const deExample = examples.find((e) => e.language === "de")!;
    const enExample = examples.find((e) => e.language === "en")!;

    expect(deExample.sentence).toContain("gehen");
    expect(deExample.sentence).toContain("ist gegangen");
    expect(deExample.translationTr).toContain("gitmek");
    expect(deExample.highlightedSegments?.some((s) => s.isTargetWord)).toBe(
      true
    );
    expect(enExample.sentence).toContain("go");
  });

  it("generates fallback sentences for general phrases and adjectives", () => {
    const examples = buildFallbackExamples({
      deWord: "ausgezeichnet",
      enWord: "excellent",
      trWord: "mükemmel",
      grammar: null,
    });

    expect(examples).toHaveLength(2);
    expect(examples[0].language).toBe("de");
    expect(examples[0].sentence).toContain("ausgezeichnet");
    expect(examples[0].translationTr).toContain("mükemmel");
    expect(examples[1].language).toBe("en");
    expect(examples[1].sentence).toContain("excellent");

    const segments = highlightGermanExample(
      "Der große Hund läuft in das Haus.",
      "Hund",
      "der"
    );
    expect(segments.map((s) => s.text).join("")).toBe(
      "Der große Hund läuft in das Haus."
    );
    expect(segments.find((s) => s.text === "Der")?.isArticle).toBe(true);
    expect(segments.find((s) => s.text === "Hund")?.isTargetWord).toBe(true);
  });
});
