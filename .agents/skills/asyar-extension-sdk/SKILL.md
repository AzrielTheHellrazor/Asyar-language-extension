---
name: asyar-extension-sdk
description: Authoring guide and SDK reference for building Asyar Tier-2 extensions using asyar-sdk@^4.15.0, Svelte 5, and Vite 6.
---

# Asyar Extension SDK (`asyar-sdk@^4.15.0`) Skill

## Overview

Asyar Tier-2 extensions consist of:
- `manifest.json`: Extension metadata, permissions, preferences, commands, and AI tools.
- `worker.html` + `src/worker.ts`: Always-on background worker importing `from "asyar-sdk/worker"`.
- `view.html` + `src/view.ts`: UI iframe entry point importing `from "asyar-sdk/view"` and mounting Svelte 5 components.
- `vite.config.ts`: Multi-page Vite build using `asyar-sdk/vite` or standard multi-entry (`view.html` + `worker.html`) outputting directly to `dist/`.

## `manifest.json` Rules

- `id`: dot-notation (e.g. `org.asyar.polyglot-dict`)
- `asyarSdk`: `"^4.15.0"`
- `type`: `"extension"`
- `background`: `{ "main": "worker.js" }`
- `permissions`: Valid values from `capabilities.json`:
  `["network", "selection:read", "clipboard:read", "clipboard:write", "notifications:send", "storage:read", "storage:write", "cache:read", "cache:write", "tools:register", "extension:invoke"]`
- `preferences`:
  - `type` must be one of `"textfield" | "password" | "number" | "checkbox" | "dropdown"`
  - `dropdown` requires `data: [{ value, title }]`
  - Secrets/API keys MUST use `"password"` type.
- `commands`:
  - Each `mode: "view"` command MUST specify `component: "<ViewComponentName>"`.
  - Optional `searchBarAccessory`: `{ type: "dropdown", default: "...", options: [{ value, title }] }`

## Worker API (`asyar-sdk/worker`)

```ts
import { ExtensionContext, extensionBridge } from "asyar-sdk/worker";
import manifest from "../manifest.json";

const extensionId = manifest.id;
const ctx = new ExtensionContext();
ctx.setExtensionId(extensionId);

const network = ctx.getService("network");
const storage = ctx.getService("storage");
const cache = ctx.getService("cache");
const tools = ctx.getService("tools");

ctx.onRequest("rpc-method-name", async (payload, signal) => {
  // Handle RPC request from view
  return { ok: true };
});

class MyExtension {
  async initialize() {}
  async activate() {}
  async deactivate() {}
  async executeCommand(commandId: string, args?: unknown) {}
  async search(query: string) {
    // Return launcher search items
    return [
      {
        score: 0.45,
        title: `...`,
        subtitle: `...`,
        type: "view" as const,
        icon: "🇩🇪",
        viewPath: `${extensionId}/PolyglotView`,
        action: () => {
          storage.set("ui:pendingQuery", query);
        }
      }
    ];
  }
}

extensionBridge.registerManifest(manifest as any);
extensionBridge.registerExtensionImplementation(extensionId, new MyExtension());
```

## View API (`asyar-sdk/view`)

```ts
import { ExtensionContext, ClipboardItemType, registerAsyarIconElement, SearchBarAccessoryServiceProxy } from "asyar-sdk/view";
import { mount } from "svelte";

const ctx = new ExtensionContext();
ctx.setExtensionId(extensionId);

const network = ctx.getService("network");
const actions = ctx.getService("actions");
const clipboard = ctx.getService("clipboard");
const storage = ctx.getService("storage");
const cache = ctx.getService("cache");
const interop = ctx.getService("interop");
const selection = ctx.getService("selection");
```

- Views receive search bar typing via `window.addEventListener("message", e => { if (e.data?.type === "asyar:view:search") { const q = e.data.payload?.query ?? ""; } })`.
- Actions are registered with `actions.registerActionHandler(\`act_\${extensionId}_\${actionName}\`, handler)`.
- CSS variables provided by Asyar host:
  `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`, `--bg-selected`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--separator`, `--accent-primary`, `--accent-danger`, `--space-1`..`--space-6`, `--radius-sm`, `--radius-md`, `--font-size-xs`, `--font-size-sm`, `--font-size-md`, `--font-size-lg`, `--font-size-xl`.
