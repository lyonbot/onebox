import * as monaco from 'monaco-editor'
import { onCleanup } from 'solid-js'
import type { OneBoxPlugin } from '~/plugins'
import { VTextFileController } from '~/store/files'
import { Lang } from '~/utils/lang'
import { watch } from '~/utils/solid'
import typesFileContent from './types?raw'
import { setObFactory } from './runtime-api'
import { dirname, join } from 'path'
import JSON5 from 'json5'

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

  const extraDts = [
    'declare module "onebox-run-script-runtime" {',
    typesFileContent,
    '}',
    'declare const ob: import("onebox-run-script-runtime").OBAPI;',
  ].join('\n')
  monaco.languages.typescript.javascriptDefaults.addExtraLib(extraDts, 'onebox-run-script.d.ts')
  monaco.languages.typescript.typescriptDefaults.addExtraLib(extraDts, 'onebox-run-script.d.ts')
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
      if (!langs.has(file.lang)) return
      const alreadyRan = !!getExistingRunnerPanelId(file)

      yield {
        label: () => <div><i class="i-mdi-play"> </i> {alreadyRan ? 'Re-run' : 'Run'} Script</div>,
        value: 'rerun run script',
        run: () => runScript(file),
      }
    },
    *getQuickActions(file) {
      if (!langs.has(file.lang)) return
      const alreadyRan = !!getExistingRunnerPanelId(file)

      yield {
        label: () => <div onMouseEnter={oneBox.ui.api.getActionHintEvFor(<div class='ob-status-actionHint'><kbd>F5</kbd>Run</div>)}>
          <i class="i-mdi-play"> </i> {alreadyRan ? 'Re-run' : 'Run'}
        </div>,
        value: 'rerun run script',
        run: () => runScript(file),
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
