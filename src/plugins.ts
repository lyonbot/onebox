import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import type { Accessor, JSXElement } from "solid-js";
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
  setupMonacoEditor?: (ctx: { file: VTextFileController, panelId: string, editor: monaco.editor.IStandaloneCodeEditor }) => void
}

export type OneBoxPlugin = (oneBox: OneBox) => OneBoxPluginDeclaration | Promise<OneBoxPluginDeclaration>

export const installedGetActions = [] as NonNullable<OneBoxPluginDeclaration['getActions'] & Fn>[]
export const installedSetupMonacoEditor = [] as NonNullable<OneBoxPluginDeclaration['setupMonacoEditor']>[]

export async function installPlugin(oneBox: OneBox, plugin: OneBoxPlugin | Nil) {
  if (!plugin) return

  const decl = await plugin(oneBox)
  if (!decl) return

  forEach(decl.panels, (loader, id) => setPanelSolidComponent(id, loader))
  if (decl.getActions) installedGetActions.push(decl.getActions)
  if (decl.setupMonacoEditor) installedSetupMonacoEditor.push(decl.setupMonacoEditor)
}
