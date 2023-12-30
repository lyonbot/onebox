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
      alwaysReconstruct?: boolean
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

    const existingPanelId = oneBox.panels.state.panels.find(p => p.panelType === 'onebox-run-script' && p.filename === file.filename)?.id
    if (existingPanelId) {
      oneBox.panels.api.updatePanel(existingPanelId)('runScript', 'randomKey', 'S' + Math.random())
    } else {
      oneBox.panels.api.openPanel({
        panelType: 'onebox-run-script',
        filename: file.filename,
        runScript: {
          randomKey: 'init',
          alwaysReconstruct: true,
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

      yield {
        label: () => <div><i class="i-mdi-play"> </i> Run Script</div>,
        value: 'run script',
        run: () => runScript(file),
      }
    },
    setupMonacoEditor({ file, editor }) {
      watch(() => langs.has(file.lang), has => {
        if (!has) return

        const id = 'oneBox:runScript'
        const action = editor.addAction({
          id,
          label: 'OneBox: Run Script',
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
}


export default oneBoxRunScript
