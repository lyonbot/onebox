import type { JSXElement } from "solid-js";
import type { Fn, Nil } from "yon-utils";
import type { OneBox } from "./store";
import type { VTextFileController } from "./store/files";

import { forEach } from "lodash";
import { panelSolidComponents } from "./panels/panels";

export type OneBoxAction = {
  label?: () => JSXElement
  value: string
  run: Fn
}

export interface OneBoxPluginDeclaration {
  name: string
  panels?: Record<string, () => Promise<any>>
  getActions?: (file: VTextFileController) => AsyncIterableIterator<OneBoxAction>
}

export type OneBoxPlugin = (oneBox: OneBox) => OneBoxPluginDeclaration | Promise<OneBoxPluginDeclaration>

export const installedGetActions = [] as (OneBoxPluginDeclaration['getActions'] & Fn)[]

export async function installPlugin(oneBox: OneBox, plugin: OneBoxPlugin | Nil) {
  if (!plugin) return

  const decl = await plugin(oneBox)
  if (!decl) return

  forEach(decl.panels, (loader, id) => panelSolidComponents[id] = loader)
  if (decl.getActions) installedGetActions.push(decl.getActions)
}
