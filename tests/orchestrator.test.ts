import { describe, it, expect, vi } from "vitest";
import { lookupPolyglot } from "../src/engine/orchestrator";
import type { CacheLike, NetworkLike } from "../src/types";

function createMockNetwork(): NetworkLike {
  return {
    fetch: vi.fn(async (url: string) => {
      if (url.includes("translate.googleapis.com")) {
        const u = new URL(url);
        const tl = u.searchParams.get("tl");
        const q = u.searchParams.get("q") ?? "";

        if (tl === "de") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: JSON.stringify([
              [["Buch", q, null, null, 10]],
              [["noun", ["das Buch", "Werk"], [["das Buch", ["book", "kitap"]]]]],
              "tr",
            ]),
          };
        }
        if (tl === "en") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: JSON.stringify([
              [["book", q, null, null, 10]],
              [["noun", ["book", "volume"], [["book", ["kitap", "Buch"]]]]],
              "tr",
            ]),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify([[["kitap", q, null, null, 10]], null, "tr"]),
        };
      }

      if (url.includes("de.wiktionary.org")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify({
            parse: {
              wikitext: {
                "*": `=== {{Wortart|Substantiv|Deutsch}}, {{n}} ===
{{Deutsch Substantiv Übersicht|Genus=n|Nominativ Singular=Buch|Nominativ Plural=Bücher}}
{{Beispiele}}
:[1] Ich lese das [[Buch]] jeden Abend.`,
              },
            },
          }),
        };
      }

      if (url.includes("api.dictionaryapi.dev")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify([
            {
              word: "book",
              phonetic: "bʊk",
              meanings: [
                {
                  partOfSpeech: "noun",
                  definitions: [
                    {
                      definition: "A written or printed work.",
                      example: "She opened the book and started reading.",
                    },
                  ],
                  synonyms: ["volume", "tome"],
                },
              ],
            },
          ]),
        };
      }

      return { ok: false, status: 404, statusText: "Not Found", body: "" };
    }),
  };
}

describe("lookupPolyglot orchestrator", () => {
  it("resolves trilingual DE/EN/TR translations, German der/die/das article & plural, and highlighted examples", async () => {
    const network = createMockNetwork();
    const entry = await lookupPolyglot({ network }, "kitap");

    expect(entry.translations.de.primaryText).toBe("das Buch");
    expect(entry.translations.de.article).toBe("das");
    expect(entry.translations.de.plural).toBe("die Bücher");
    expect(entry.translations.en.primaryText).toBe("book");
    expect(entry.translations.tr.primaryText).toBe("kitap");

    expect(entry.germanGrammar?.noun?.article).toBe("das");
    expect(entry.examples.some((e) => e.language === "de")).toBe(true);
    expect(entry.examples.some((e) => e.language === "en")).toBe(true);

    const deExample = entry.examples.find((e) => e.language === "de")!;
    expect(deExample.highlightedSegments).toBeDefined();
    expect(
      deExample.highlightedSegments?.some((seg) => seg.isArticle || seg.isTargetWord)
    ).toBe(true);
  });

  it("caches lookup results and serves from cache on repeat queries", async () => {
    const network = createMockNetwork();
    const store = new Map<string, string>();
    const cache: CacheLike = {
      async get(key) {
        return store.get(key);
      },
      async set(key, val) {
        store.set(key, val);
      },
    };

    const first = await lookupPolyglot({ network, cache }, "kitap");
    const callCountAfterFirst = (network.fetch as any).mock.calls.length;
    expect(callCountAfterFirst).toBeGreaterThan(0);

    const second = await lookupPolyglot({ network, cache }, "kitap");
    expect(second.translations.de.primaryText).toBe(
      first.translations.de.primaryText
    );
    expect((network.fetch as any).mock.calls.length).toBe(callCountAfterFirst);
  });

  it("degrades gracefully when Wiktionary and Dictionary API fail", async () => {
    const failingNetwork: NetworkLike = {
      async fetch(url: string) {
        if (url.includes("translate.googleapis.com")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: JSON.stringify([[["Haus", "ev", null, null, 10]], null, "tr"]),
          };
        }
        return { ok: false, status: 500, statusText: "Error", body: "" };
      },
    };

    const entry = await lookupPolyglot({ network: failingNetwork }, "Haus");
    expect(entry.translations.de.article).toBe("das");
    expect(entry.examples.length).toBeGreaterThan(0);
  });
});
