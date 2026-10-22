import "./styles/awwwards.css";
import {
  ExtensionContext,
  searchBarAccessory
} from "asyar-sdk/view";
import { mount } from "svelte";
import PolyglotView from "./views/PolyglotView.svelte";
import VocabView from "./views/VocabView.svelte";
import FlashcardView from "./views/FlashcardView.svelte";
import type { CacheLike, NetworkLike, StorageLike } from "./types";

if (typeof window !== "undefined") {
  (window as any).__ASYAR_ROLE__ = (window as any).__ASYAR_ROLE__ || "view";
}

function resolveExtensionId(): string {
  const fallback = "org.asyar.polyglot-dict";
  if (typeof window === "undefined") return fallback;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "asyar-extension.localhost"
  ) {
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    if (seg && !seg.endsWith(".html")) {
      return seg;
    }
    return fallback;
  }
  return window.location.hostname || fallback;
}

const STORAGE_PREFIX = "polyglot:";
const CACHE_PREFIX = "polyglot:cache:";

function createStandaloneStorage(): StorageLike {
  const memoryFallback = new Map<string, unknown>();

  const readRaw = (fullKey: string): string | null => {
    try {
      return window.localStorage.getItem(fullKey);
    } catch {
      return null;
    }
  };

  const writeRaw = (fullKey: string, val: string): void => {
    try {
      window.localStorage.setItem(fullKey, val);
    } catch {
      // Fallback to in-memory map if localStorage is blocked
    }
  };

  const removeRaw = (fullKey: string): void => {
    try {
      window.localStorage.removeItem(fullKey);
    } catch {
      // Ignore remove error
    }
  };

  const unwrapValue = (raw: string | null): unknown => {
    if (raw === null) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "__polyglotVal" in parsed) {
        return (parsed as { __polyglotVal: unknown }).__polyglotVal;
      }
      return raw;
    } catch {
      return raw;
    }
  };

  return {
    async get(key: string): Promise<unknown> {
      const raw = readRaw(`${STORAGE_PREFIX}${key}`);
      if (raw !== null) {
        return unwrapValue(raw);
      }
      return memoryFallback.get(key);
    },
    async set(key: string, value: unknown): Promise<void> {
      memoryFallback.set(key, value);
      writeRaw(`${STORAGE_PREFIX}${key}`, JSON.stringify({ __polyglotVal: value }));
    },
    async delete(key: string): Promise<void> {
      memoryFallback.delete(key);
      removeRaw(`${STORAGE_PREFIX}${key}`);
    },
    async getAll(): Promise<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      for (const [k, v] of memoryFallback.entries()) {
        out[k] = v;
      }
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const fullKey = window.localStorage.key(i);
          if (
            fullKey &&
            fullKey.startsWith(STORAGE_PREFIX) &&
            !fullKey.startsWith(CACHE_PREFIX)
          ) {
            const shortKey = fullKey.slice(STORAGE_PREFIX.length);
            const raw = window.localStorage.getItem(fullKey);
            const val = unwrapValue(raw);
            if (val !== undefined) {
              out[shortKey] = val;
            }
          }
        }
      } catch {
        // Ignore localStorage iteration error
      }
      return out;
    },
    async clear(): Promise<void> {
      memoryFallback.clear();
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const fullKey = window.localStorage.key(i);
          if (
            fullKey &&
            fullKey.startsWith(STORAGE_PREFIX) &&
            !fullKey.startsWith(CACHE_PREFIX)
          ) {
            toDelete.push(fullKey);
          }
        }
        toDelete.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // Ignore clear error
      }
    }
  };
}

function createStandaloneCache(): CacheLike {
  const memoryCache = new Map<string, { value: string; exp?: number }>();

  return {
    async get(key: string): Promise<string | undefined> {
      const mem = memoryCache.get(key);
      if (mem) {
        if (mem.exp && Date.now() > mem.exp) {
          memoryCache.delete(key);
        } else {
          return mem.value;
        }
      }
      try {
        const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { value?: string; exp?: number };
        if (parsed.exp && Date.now() > parsed.exp) {
          window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
          return undefined;
        }
        if (typeof parsed.value === "string") {
          memoryCache.set(key, { value: parsed.value, exp: parsed.exp });
          return parsed.value;
        }
      } catch {
        // Ignore cache read error
      }
      return undefined;
    },
    async set(
      key: string,
      value: string,
      options?: { expirationDate?: Date }
    ): Promise<void> {
      const exp = options?.expirationDate?.getTime();
      memoryCache.set(key, { value, exp });
      try {
        window.localStorage.setItem(
          `${CACHE_PREFIX}${key}`,
          JSON.stringify({ value, exp })
        );
      } catch {
        // Ignore storage quota error
      }
    },
    async remove(key: string): Promise<void> {
      memoryCache.delete(key);
      try {
        window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      } catch {
        // Ignore remove error
      }
    }
  };
}

function createStandaloneNetwork(): NetworkLike {
  return {
    async fetch(url, options) {
      const timeoutMs = Math.min(options?.timeout ?? 2500, 2500);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await window.fetch(url, {
          method: options?.method ?? "GET",
          headers: options?.headers,
          body: options?.body,
          signal: controller.signal
        });
        const body = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          body
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

function createStandaloneClipboard() {
  return {
    async copy(item: { type?: string; value?: string } | string): Promise<void> {
      const text = typeof item === "string" ? item : item?.value ?? "";
      if (!text) return;
      try {
        await navigator.clipboard?.writeText?.(text);
      } catch {
        // Ignore clipboard permission error in headless browser
      }
    },
    async writeText(text: string): Promise<void> {
      if (!text) return;
      try {
        await navigator.clipboard?.writeText?.(text);
      } catch {
        // Ignore clipboard permission error in headless browser
      }
    }
  };
}

function createStandaloneActions() {
  const handlers = new Map<string, () => unknown>();
  let currentActions: unknown[] = [];

  return {
    setActions(list: unknown[]) {
      currentActions = Array.isArray(list) ? list : [];
    },
    getActions() {
      return currentActions;
    },
    registerActionHandler(id: string, handler: () => unknown) {
      handlers.set(id, handler);
      return () => handlers.delete(id);
    },
    triggerAction(id: string) {
      return handlers.get(id)?.();
    }
  };
}

function navigateStandaloneCommand(rawCommand: string): void {
  const cmd = rawCommand.trim().toLowerCase();
  if (cmd === "vocab" || cmd === "vocabview") {
    window.location.assign("/vocab.html");
  } else if (cmd === "flashcards" || cmd === "flashcardview") {
    window.location.assign("/flashcards.html");
  } else if (cmd === "lookup" || cmd === "polyglotview" || cmd === "selection-lookup") {
    window.location.assign("/index.html");
  }
}

function createStandaloneInterop() {
  const handleCommand = async (
    arg1: string | { extensionId?: string; commandId?: string },
    arg2?: string
  ) => {
    const commandId =
      typeof arg1 === "object" && arg1 !== null
        ? arg1.commandId ?? ""
        : typeof arg2 === "string"
          ? arg2
          : typeof arg1 === "string"
            ? arg1
            : "";
    if (commandId) {
      navigateStandaloneCommand(commandId);
    }
  };

  return {
    launchCommand: handleCommand,
    invokeCommand: handleCommand,
    executeCommand: handleCommand
  };
}

function createStandaloneSelection() {
  return {
    async getSelectedText(): Promise<string> {
      return window.getSelection?.()?.toString()?.trim() || "";
    }
  };
}

const isStandalone = typeof window !== "undefined" && window.parent === window;
const extensionId = resolveExtensionId();
const ctx = new ExtensionContext();
ctx.setExtensionId(extensionId);

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!isStandalone) {
      window.parent.postMessage(
        {
          type: "asyar:extension:keydown",
          payload: {
            key: e.key,
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey
          }
        },
        "*"
      );
    } else {
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[type="text"]'
      );
      searchInput?.focus();
      searchInput?.select();
    }
  }
});

if (!isStandalone) {
  window.parent.postMessage(
    {
      type: "asyar:extension:loaded",
      extensionId,
      role: "view"
    },
    "*"
  );
}

const network = isStandalone ? createStandaloneNetwork() : ctx.getService("network");
const actions = isStandalone ? createStandaloneActions() : ctx.getService("actions");
const clipboard = isStandalone ? createStandaloneClipboard() : ctx.getService("clipboard");
const storage = isStandalone ? createStandaloneStorage() : ctx.getService("storage");
const cache = isStandalone ? createStandaloneCache() : ctx.getService("cache");
const interop = isStandalone ? createStandaloneInterop() : ctx.getService("interop");
const selection = isStandalone ? createStandaloneSelection() : ctx.getService("selection");

const params = new URLSearchParams(window.location.search);
const pathname = window.location.pathname.toLowerCase();
const viewName: string =
  (window as any).__POLYGLOT_INITIAL_VIEW__ ||
  params.get("view") ||
  (pathname.includes("vocab")
    ? "VocabView"
    : pathname.includes("flashcard")
      ? "FlashcardView"
      : "PolyglotView");

const commandId = params.get("command") || "";
const target = document.getElementById("app")!;

// Replace static pre-rendered SEO shell cleanly before mounting Svelte 5 view
target.innerHTML = "";

if (viewName === "VocabView") {
  mount(VocabView, {
    target,
    props: {
      context: ctx,
      actions,
      clipboard,
      storage,
      interop,
      searchBarAccessory,
      extensionId
    }
  });
} else if (viewName === "FlashcardView") {
  mount(FlashcardView, {
    target,
    props: {
      context: ctx,
      actions,
      storage,
      interop,
      extensionId
    }
  });
} else {
  mount(PolyglotView, {
    target,
    props: {
      context: ctx,
      network,
      actions,
      clipboard,
      storage,
      cache,
      interop,
      selection,
      searchBarAccessory,
      extensionId,
      initialMode: commandId === "selection-lookup" ? "selection-lookup" : "lookup"
    }
  });
}
