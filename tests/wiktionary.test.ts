import { describe, it, expect } from "vitest";
import {
  extractArticleAndNoun,
  segmentSentenceWithArticleHighlights,
  parseWiktionaryWikitext,
  lookupCuratedGermanGrammar,
  fetchGermanWiktionary,
} from "../src/engine/wiktionary";
import type { NetworkLike } from "../src/types";

describe("wiktionary & article engine", () => {
  it("extracts leading German articles (der/die/das) and nouns", () => {
    expect(extractArticleAndNoun("das Buch")).toEqual({
      article: "das",
      noun: "Buch",
    });
    expect(extractArticleAndNoun("DER Tisch")).toEqual({
      article: "der",
      noun: "Tisch",
    });
    expect(extractArticleAndNoun("die Entscheidung")).toEqual({
      article: "die",
      noun: "Entscheidung",
    });
    expect(extractArticleAndNoun("sprechen")).toEqual({
      noun: "sprechen",
    });
  });

  it("segments a German sentence and highlights articles and target noun while preserving exact text", () => {
    const sentence = "Ich lese das Buch in einer Bibliothek.";
    const segments = segmentSentenceWithArticleHighlights(
      sentence,
      "das Buch",
      "das"
    );

    expect(segments.map((s) => s.text).join("")).toBe(sentence);
    const dasSeg = segments.find((s) => s.text === "das");
    expect(dasSeg?.isArticle).toBe(true);
    expect(dasSeg?.articleGender).toBe("das");

    const buchSeg = segments.find((s) => s.text === "Buch");
    expect(buchSeg?.isTargetWord).toBe(true);
    expect(buchSeg?.articleGender).toBe("das");
  });

  it("parses Wiktionary noun wikitext for Genus (der/die/das), plural, IPA, examples, and synonyms", () => {
    const wikitext = `
== Tisch ({{Sprache|Deutsch}}) ==
=== {{Wortart|Substantiv|Deutsch}}, {{m}} ===
{{Deutsch Substantiv Übersicht
|Genus=m
|Nominativ Singular=Tisch
|Nominativ Plural=Tische
|Genitiv Singular=Tisches
}}
{{Aussprache}}
:{{IPA}} {{Lautschrift|tɪʃ}}
{{Beispiele}}
:[1] '''Der''' [[Tisch]] steht in der Küche.
{{Synonyme}}
:[1] [[Tafel]]
`;
    const parsed = parseWiktionaryWikitext("Tisch", wikitext);
    expect(parsed.grammar?.pos).toBe("noun");
    expect(parsed.grammar?.noun?.article).toBe("der");
    expect(parsed.grammar?.noun?.plural).toBe("die Tische");
    expect(parsed.grammar?.ipa).toBe("tɪʃ");
    expect(parsed.rawExamples[0]).toBe("Der Tisch steht in der Küche.");
    expect(parsed.synonyms).toContain("Tafel");
  });

  it("parses Wiktionary verb wikitext for Präsens, Präteritum, and Perfekt (hat/ist)", () => {
    const wikitext = `
== gehen ({{Sprache|Deutsch}}) ==
=== {{Wortart|Verb|Deutsch}} ===
{{Deutsch Verb Übersicht
|Präsens_ich=gehe
|Präsens_du=gehst
|Präsens_er, sie, es=geht
|Präteritum_ich=ging
|Partizip II=gegangen
|Hilfsverb=sein
}}
{{Beispiele}}
:[1] Wir [[gehen]] heute ins Kino.
`;
    const parsed = parseWiktionaryWikitext("gehen", wikitext);
    expect(parsed.grammar?.pos).toBe("verb");
    expect(parsed.grammar?.verb?.praesensErSieEs).toBe("geht");
    expect(parsed.grammar?.verb?.praeteritumIch).toBe("ging");
    expect(parsed.grammar?.verb?.auxiliary).toBe("sein");
    expect(parsed.grammar?.verb?.perfekt).toBe("ist gegangen");
  });

  it("resolves curated German lexicon nouns and verbs with bilingual examples", () => {
    const buch = lookupCuratedGermanGrammar("das Buch");
    expect(buch).not.toBeNull();
    expect(buch?.grammar.noun?.article).toBe("das");
    expect(buch?.grammar.noun?.plural).toBe("die Bücher");
    expect(buch?.examples.length).toBeGreaterThan(0);

    const sprechen = lookupCuratedGermanGrammar("sprechen");
    expect(sprechen).not.toBeNull();
    expect(sprechen?.grammar.verb?.perfekt).toContain("gesprochen");
  });

  it("fetches and merges Wiktionary data via mock NetworkLike", async () => {
    const mockNetwork: NetworkLike = {
      async fetch() {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify({
            parse: {
              wikitext: {
                "*": `=== {{Wortart|Substantiv|Deutsch}}, {{n}} ===
{{Deutsch Substantiv Übersicht
|Genus=n
|Nominativ Singular=Fenster
|Nominativ Plural=Fenster
}}
{{Beispiele}}
:[1] Bitte mach das [[Fenster]] auf.`,
              },
            },
          }),
        };
      },
    };

    const result = await fetchGermanWiktionary(mockNetwork, "Fenster");
    expect(result.grammar?.noun?.article).toBe("das");
    expect(result.rawExamples).toContain("Bitte mach das Fenster auf.");
  });
});
