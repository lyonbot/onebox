import JSON5 from 'json5'
import jsyaml from 'js-yaml'
import * as monaco from 'monaco-editor'
import { dirname, join } from 'path'
import { onCleanup } from 'solid-js'
import type { OneBoxPlugin } from '~/plugins'
import { VTextFileController } from '~/store/files'
import { Lang } from '~/utils/lang'
import { watch } from '~/utils/solid'
import { setObFactory } from './runtime-api'
import { setupMonacoTsLibs } from './setupMonacoTsLibs'

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

const langs = new Set([
  Lang.JAVASCRIPT,
  Lang.TYPESCRIPT,
])

const panelId = 'onebox-run-script:panel'

const oneBoxRunScript: OneBoxPlugin = oneBox => {
  function runScript(file: VTextFileController) {
    const panelExists = getExistingRunnerPanelId(file)

    if (panelExists) {
      oneBox.panels.api.updatePanel(panelId)('runScript', 'randomKey', 'S' + Math.random())
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

  setObFactory(() => file => {
    const norm = (fn: string) => join(dirname(file.filename), fn);

    return ({
      readText: fn => {
        fn = norm(fn)
        return oneBox.files.api.getControllerOf(fn)?.content || ''
      },
      readJSON(path) {
        path = norm(path)
        return JSON5.parse(this.readText(path))
      },
      readYAML(path) {
        path = norm(path)
        return jsyaml.load(this.readText(path)) as any
      },
      writeFile: (fn, content) => {
        fn = norm(fn)
        if (typeof content === 'object') content = JSON.stringify(content, null, 2) + '\n'
        else content = String(content)

        const file = oneBox.files.api.getControllerOf(fn)
        if (file) file.setContent(content)
        else oneBox.files.api.createFile({ content, filename: fn })
      },
      appendFile: (fn, content) => {
        fn = norm(fn)
        if (typeof content === 'object') content = JSON.stringify(content, null, 2) + '\n'
        else content = String(content)

        const file = oneBox.files.api.getControllerOf(fn)
        if (file) file.setContent(file.content + content)
        else oneBox.files.api.createFile({ content, filename: fn })
      },
      openFile: (fn, pos) => {
        fn = norm(fn)
        if (!oneBox.files.api.getControllerOf(fn)) oneBox.files.api.createFile({ filename: fn })
        if (pos === true) pos = 'right'
        oneBox.api.openFile(fn, pos)
      },
    })
  })

  return ({
    name: 'onebox-run-script',
    panels: {
      'onebox-run-script': () => import('./panel'),
    },
    async *getActions(file) {
      const alreadyRan = !!getExistingRunnerPanelId(file)
      const langMatch = langs.has(file.lang)
      if (!alreadyRan && !langMatch) return

      yield {
        label: () => <div><i class="i-mdi-play"> </i> {alreadyRan ? 'Re-run' : 'Run'} Script</div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }
    },
    *getQuickActions(file) {
      const alreadyRan = !!getExistingRunnerPanelId(file)
      const langMatch = langs.has(file.lang)
      if (!alreadyRan && !langMatch) return

      yield {
        label: () => <div onMouseEnter={oneBox.ui.api.getActionHintEvFor(<div class='ob-status-actionHint'><kbd>F5</kbd>Run</div>)}>
          <i class="i-mdi-play"> </i> {alreadyRan ? 'Re-run' : 'Run'}
        </div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }

      if (langMatch)
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
      watch(() => (
        (langs.has(file.lang) ? 1 : 0) +
        (getExistingRunnerPanelId(file) ? 2 : 0)
      ), flag => {
        if (flag === 0) return // mismatch language, and no panel running

        const id = 'oneBox:runScript'
        const alreadyRan = !!(flag & 2)
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
    const panel = oneBox.panels.state.panels.find(p => p.id === panelId)
    if (!panel) return null

    if (panel.filename !== file.filename) {
      console.warn('onebox-run-script: panel filename mismatch', panel.filename, file.filename)
    }
    return panel.id
  }
}


export default oneBoxRunScript
