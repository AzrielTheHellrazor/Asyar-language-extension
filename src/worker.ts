import { ExtensionContext, extensionBridge } from "asyar-sdk/worker";
import manifest from "../manifest.json";
import { lookupPolyglot } from "./engine/orchestrator";
import { lookupCuratedGermanGrammar } from "./engine/wiktionary";
import { saveWordToVocab, seedStarterGermanVocabIfEmpty } from "./store/vocab";

const extensionId = manifest.id;
const ctx = new ExtensionContext();
ctx.setExtensionId(extensionId);

const network = ctx.getService("network");
const storage = ctx.getService("storage");
const cache = ctx.getService("cache");
const tools = ctx.getService("tools");

const PENDING_QUERY_KEY = "ui:pendingQuery";

// RPC handlers from Views
ctx.onRequest("polyglot:lookup", async (payload: unknown) => {
  const p = (payload ?? {}) as { query?: string };
  const query = String(p.query ?? "").trim();
  if (!query) {
    throw new Error("Query is required");
  }
  const prefs = ctx.preferences?.values as Record<string, unknown> | undefined;
  const aiProvider = typeof prefs?.aiProvider === "string" ? prefs.aiProvider : "gemini";
  const aiApiKey = typeof prefs?.aiApiKey === "string" ? prefs.aiApiKey : undefined;
  return lookupPolyglot({ network, cache }, query, { aiProvider, aiApiKey });
});

ctx.onRequest("polyglot:save-vocab", async (payload: unknown) => {
  const p = (payload ?? {}) as { entry?: any };
  if (!p?.entry) {
    throw new Error("Entry is required");
  }
  return saveWordToVocab(storage, p.entry);
});

async function registerAgentTools(): Promise<void> {
  const toolDef = manifest.tools?.find((t) => t.id === "polyglot_lookup");
  if (!toolDef) return;
  try {
    await tools.registerTool(toolDef as any, async (args: unknown) => {
      const a = (args ?? {}) as { query?: string };
      const q = String(a.query ?? "").trim();
      if (!q) {
        throw new Error("polyglot_lookup: query is required");
      }
      const prefs = ctx.preferences?.values as Record<string, unknown> | undefined;
      const aiProvider = typeof prefs?.aiProvider === "string" ? prefs.aiProvider : "gemini";
      const aiApiKey = typeof prefs?.aiApiKey === "string" ? prefs.aiApiKey : undefined;
      return lookupPolyglot({ network, cache }, q, { aiProvider, aiApiKey });
    });
  } catch (err) {
    console.warn("[polyglot-dict] Failed to register agent tool:", err);
  }
}

registerAgentTools();
seedStarterGermanVocabIfEmpty(storage).catch(() => {});

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

class PolyglotExtension {
  async initialize(): Promise<void> {}
  async activate(): Promise<void> {}
  async deactivate(): Promise<void> {}
  async executeCommand(_commandId: string, _args?: unknown): Promise<void> {}

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2) return [];

    // Fast instant preview if the query matches our curated German lexicon
    const curated = lookupCuratedGermanGrammar(q);
    if (curated) {
      const nounInfo = curated.grammar.noun;
      const verbInfo = curated.grammar.verb;
      const badge = nounInfo
        ? `${nounInfo.article} ${nounInfo.singular}${nounInfo.plural ? ` · Pl: ${nounInfo.plural}` : ""}`
        : verbInfo
          ? `${verbInfo.infinitive} (${verbInfo.praesensErSieEs ?? ""} · ${verbInfo.perfekt ?? ""})`
          : curated.grammar.word;
      const firstEx = curated.examples[0];
      return [
        {
          score: 0.65,
          title: `🇩🇪 ${badge}`,
          subtitle: firstEx
            ? `Örnek: "${truncate(firstEx.de, 48)}" (${truncate(firstEx.tr, 36)})`
            : "Polyglot Sözlük & Almanca Gramer Kartını Aç",
          type: "view" as const,
          icon: "🇩🇪",
          viewPath: `${extensionId}/PolyglotView`,
          action: () => {
            storage.set(PENDING_QUERY_KEY, q);
          }
        }
      ];
    }

    return [
      {
        score: 0.42,
        title: `Polyglot Sözlük: "${truncate(q, 38)}" → 🇩🇪 DE · 🇬🇧 EN · 🇹🇷 TR`,
        subtitle: "Almanca der/die/das artikel, çoğul, fiil çekimi ve örnek cümleleri gör",
        type: "view" as const,
        icon: "🇩🇪",
        viewPath: `${extensionId}/PolyglotView`,
        action: () => {
          storage.set(PENDING_QUERY_KEY, q);
        }
      }
    ];
  }
}

const impl = new PolyglotExtension();
extensionBridge.registerManifest(manifest as any);
extensionBridge.registerExtensionImplementation(extensionId, impl);
