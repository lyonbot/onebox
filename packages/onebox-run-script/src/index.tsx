import * as monaco from 'monaco-editor'
import { onCleanup } from 'solid-js'
import type { OneBoxPlugin } from '~/plugins'
import { VTextFileController } from '~/store/files'
import { Lang } from '~/utils/lang'
import { watch } from '~/utils/solid'
import { setObFactory } from './runtime-api'
import { setupMonacoTsLibs } from './setupMonacoTsLibs'
import { makeObFactory } from './makeObFactory'
import { basename } from 'path'

export type RunScriptPanelData = {
  randomKey: string // change this to re-run
  mode?: 'refreshing' | 'incremental'
  showHTMLPreview?: boolean
  htmlPreviewHeight?: number // percentage 0-100
}

declare module "~/plugins" {
  export interface OneBoxPanelData {
    runScript?: RunScriptPanelData
  }
}

const libraryHelpMessage = `
== OneBox API ==

* ob.readText("./xxx")
* ob.readJSON("./xxx")
* ob.writeFile("./xxx", content)
* print(...) = console.log()

== Third-party libraries ==

* _.forEach() to use methods from Lodash
* Buffer
* CryptoJS
* jsyaml.load & jsyaml.dump (using js-yaml)

And you can use ES Module import / export to composite! More features will be added in the future.
`.trim()

const mlLangs = new Set([
  Lang.JSON,
  Lang.YAML,
])

const langs = new Set([
  Lang.JAVASCRIPT,
  Lang.TYPESCRIPT,
  ...mlLangs,
])

const panelId = 'onebox-run-script:panel'

const oneBoxRunScript: OneBoxPlugin = oneBox => {
  function runScript(file: VTextFileController) {
    const panelExists = getExistingRunnerPanel()

    if (panelExists) {
      oneBox.panels.api.updatePanel(panelId)('runScript', {
        randomKey: 'S' + Math.random(),
      })
    } else {
      if (!langs.has(file.lang)) return
      oneBox.panels.api.openPanel({
        id: panelId,
        panelType: 'onebox-run-script',
        filename: file.filename,
        runScript: {
          randomKey: 'init',
          mode: 'incremental',
          htmlPreviewHeight: 30,
          showHTMLPreview: false,
        },
      }, 'right')
    }
  }

  setupMonacoTsLibs()

  setObFactory(() => makeObFactory(oneBox))

  return ({
    name: 'onebox-run-script',
    panels: {
      'onebox-run-script': () => import('./panel'),
    },
    async *getActions(file) {
      const existing = getExistingRunnerPanel()
      const displayData = getRunButtonDisplayData(file, existing)
      if (!displayData) return

      yield {
        label: () => <div><i class="i-mdi-play"> </i> {displayData.text} </div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }
    },
    *getQuickActions(file) {
      const existing = getExistingRunnerPanel()
      const displayData = getRunButtonDisplayData(file, existing)
      if (!displayData) return

      yield {
        label: () => <div><i class="i-mdi-play"> </i> {displayData.text} </div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }

      if (displayData.showLibraries)
        yield {
          label: () => <div><i class="i-mdi-library"> </i> Libraries</div>,
          value: 'show libraries',
          run: () => {
            alert(libraryHelpMessage)
          },
        }
    },
    setupMonacoEditor({ file, editor }) {
      // when re-run code, the devtool reinit and take focus away. we must focus back to editor
      // meanwhile, in ./panel.tsx, the iframe itself maintain the data-attr, temporally remove it when iframe is clicked
      // what a kludge
      editor.onDidBlurEditorText(() => {
        setTimeout(() => {
          if (document.activeElement?.matches('iframe[data-iframe-role="onebox-run-script:devtool"]')) {
            editor.focus()
          }
        }, 50);
      })

      // add action to context menu
      watch(() => getRunButtonDisplayData(file), displayData => {
        if (!displayData) return

        const id = 'oneBox:runScript'
        const action = editor.addAction({
          id,
          label: `OneBox: ${displayData.text}`,
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

  function getExistingRunnerPanel() {
    const panel = oneBox.panels.state.panels.find(p => p.id === panelId)
    return panel
  }

  function getRunButtonDisplayData(file: VTextFileController, existing = getExistingRunnerPanel()) {
    // hide run button if not supported language and nothing running
    if (!existing && !langs.has(file.lang)) return null

    const runningCurrentFile = existing && existing.filename === file.filename
    const runningOtherFile = existing && !runningCurrentFile

    const showLibraries = existing ? runningCurrentFile : !mlLangs.has(file.lang)
    const text = existing
      ? `Re-run${runningCurrentFile ? '' : ` (${basename(existing.filename)})`}`
      : mlLangs.has(file.lang) ? 'Send to DevTool' : 'Run'

    return { text, showLibraries, runningCurrentFile, runningOtherFile }
  }
}


export default oneBoxRunScript
