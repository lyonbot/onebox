import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { createSignal, type JSXElement } from "solid-js";
import type { Fn, Nil } from "yon-utils";
import type { OneBox } from "./store";
import type { VTextFileController } from "./store/files";

import { forEach } from "lodash";
import { setPanelSolidComponent } from "./panels/panels";

export type OneBoxAction = {
  label?: () => JSXElement
  value: string
  run: Fn
}

export interface OneBoxPanelData {
  // TODO: plugins may extends this with [TypeScript Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
}

export interface OneBoxPluginDeclaration {
  name: string
  panels?: Record<string, () => Promise<any>>
  getActions?: (file: VTextFileController) => AsyncIterableIterator<OneBoxAction>
  getQuickActions?: (file: VTextFileController) => Iterable<OneBoxAction>
  setupMonacoEditor?: (ctx: { file: VTextFileController, panelId: string, editor: monaco.editor.IStandaloneCodeEditor }) => void
}

export type OneBoxPlugin = (oneBox: OneBox) => OneBoxPluginDeclaration | Promise<OneBoxPluginDeclaration>

export const [installedPlugins, setInstalledPlugins] = createSignal<OneBoxPluginDeclaration[]>([])

export async function installPlugin(oneBox: OneBox, plugin: OneBoxPlugin | Nil) {
  if (!plugin) return

  const decl = await plugin(oneBox)
  if (!decl) return

  forEach(decl.panels, (loader, id) => setPanelSolidComponent(id, loader))
  setInstalledPlugins((prev) => [...prev, decl])
}
