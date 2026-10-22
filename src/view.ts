import {
  ExtensionContext,
  searchBarAccessory
} from "asyar-sdk/view";
import { mount } from "svelte";
import PolyglotView from "./views/PolyglotView.svelte";
import VocabView from "./views/VocabView.svelte";
import FlashcardView from "./views/FlashcardView.svelte";

function resolveExtensionId(): string {
  const fallback = "org.asyar.polyglot-dict";
  if (typeof window === "undefined") return fallback;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "asyar-extension.localhost"
  ) {
    return window.location.pathname.split("/").filter(Boolean)[0] || fallback;
  }
  return window.location.hostname || fallback;
}

const extensionId = resolveExtensionId();
const ctx = new ExtensionContext();
ctx.setExtensionId(extensionId);

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
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
  }
});

window.parent.postMessage(
  {
    type: "asyar:extension:loaded",
    extensionId,
    role: "view"
  },
  "*"
);

const network = ctx.getService("network");
const actions = ctx.getService("actions");
const clipboard = ctx.getService("clipboard");
const storage = ctx.getService("storage");
const cache = ctx.getService("cache");
const interop = ctx.getService("interop");
const selection = ctx.getService("selection");

const params = new URLSearchParams(window.location.search);
const viewName = params.get("view") || "PolyglotView";
const commandId = params.get("command") || "";
const target = document.getElementById("app")!;

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
