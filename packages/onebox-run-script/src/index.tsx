import * as monaco from 'monaco-editor'
import { onCleanup } from 'solid-js'
import type { OneBoxPlugin } from '~/plugins'
import { VTextFileController } from '~/store/files'
import { Lang } from '~/utils/lang'
import { watch } from '~/utils/solid'

declare module "~/plugins" {
  export interface OneBoxPanelData {
    runScript?: {
      randomKey: string // change this to re-run
      mode?: 'refreshing' | 'incremental'
      showHTMLPreview?: boolean
      htmlPreviewHeight?: number // percentage 0-100
    }
  }
}

const langs = new Set([
  Lang.JAVASCRIPT,
  Lang.TYPESCRIPT,
])

const oneBoxRunScript: OneBoxPlugin = oneBox => {
  function runScript(file: VTextFileController) {
    if (!langs.has(file.lang)) return

    const existingPanelId = getExistingRunnerPanelId(file)
    if (existingPanelId) {
      oneBox.panels.api.updatePanel(existingPanelId)('runScript', 'randomKey', 'S' + Math.random())
    } else {
      oneBox.panels.api.openPanel({
        panelType: 'onebox-run-script',
        filename: file.filename,
        runScript: {
          randomKey: 'init',
          mode: 'refreshing',
          htmlPreviewHeight: 30,
          showHTMLPreview: false,
        },
      }, 'right')
    }
  }

  return ({
    name: 'onebox-run-script',
    panels: {
      'onebox-run-script': () => import('./panel'),
    },
    async *getActions(file) {
      if (!langs.has(file.lang)) return
      const alreadyRan = !!getExistingRunnerPanelId(file)

      yield {
        label: () => <div><i class="i-mdi-play"> </i> {alreadyRan ? 'Re-run' : 'Run'} Script</div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }
    },
    setupMonacoEditor({ file, editor }) {
      watch(() => langs.has(file.lang) && (getExistingRunnerPanelId(file) || '<no run yet>'), has => {
        if (!has) return

        const id = 'oneBox:runScript'
        const alreadyRan = has !== '<no run yet>'
        const action = editor.addAction({
          id,
          label: `OneBox: ${alreadyRan ? 'Re-run' : 'Run'} Script`,
          run: () => runScript(file),
          keybindings: [monaco.KeyCode.F5],
          contextMenuGroupId: 'navigation',
        })

        onCleanup(() => {
          action.dispose()
        })
      })
    },
  })

  function getExistingRunnerPanelId(file: VTextFileController) {
    return oneBox.panels.state.panels.find(p => p.panelType === 'onebox-run-script' && p.filename === file.filename)?.id
  }
}


export default oneBoxRunScript
