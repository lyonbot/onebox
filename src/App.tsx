/* @refresh granular */
import { Show, createSignal, getOwner, onMount, runWithOwner } from "solid-js";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";
import { clsx, modKey } from "yon-utils";
import './monaco/setup'
import { scanFiles } from "./utils/files";
import { guessLangFromName } from "./utils/langUtils";
import { VTextFileController } from "./store/files";
import { Buffer } from "buffer";
import { PromptBox } from "./components/PromptBox";

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()

  onMount(() => {
    window.addEventListener('keydown', ev => {
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyB') {
        ev.preventDefault()
        oneBox.ui.api.toggleSidebar()
        return
      }

      if (modKey(ev) === modKey.Mod && ev.code == 'KeyS') {
        ev.preventDefault()
        oneBox.api.downloadCurrentFile()
        return
      }

      if (modKey(ev) === (modKey.Mod | modKey.Shift) && ev.code == 'KeyS') {
        ev.preventDefault()
        oneBox.api.downloadCurrentProject()
        return
      }
    });
  });

  const [isAboutDropFiles, setIsAboutDropFiles] = createSignal(false)

  return (
    <div
      id="ob-app"
      class={clsx(oneBox.ui.state.darkMode && 'darkMode')}
      ref={div => {
        let dragBug = 0 // dnd api bug? after first hit, (dragenter and dragleave) fire alternately

        div.addEventListener('dragenter', ev => {
          const hasFiles = !!ev.dataTransfer?.types.includes('Files')
          setIsAboutDropFiles(hasFiles)
          dragBug++;
        }, true)

        div.addEventListener('dragleave', () => {
          if (--dragBug === 0) setIsAboutDropFiles(false)
        }, true)

        div.addEventListener('drop', async (ev) => {
          dragBug = 0;

          if (ev.dataTransfer?.types.includes('Files')) {
            ev.preventDefault()
            ev.stopPropagation()
            setIsAboutDropFiles(false)

            // dropped files
            const imported = [] as VTextFileController[]
            for (const rawItem of ev.dataTransfer.items) {
              const handle = rawItem.webkitGetAsEntry?.()
              if (handle) {
                for await (const [name, file] of scanFiles(handle)) {
                  const isTextFile = file.type.startsWith('text/') || file.type.includes('/json')
                  imported.push(oneBox.files.api.createFile({
                    filename: name,
                    content: isTextFile ? await file.text() : '',
                    contentBinary: !isTextFile && Buffer.from(await file.arrayBuffer()),
                    lang: guessLangFromName(name),
                  }))
                }
              }
            }

            // open first 3 files
            imported.slice(0, 3).forEach(file => {
              oneBox.api.openFile(file.filename)
            })
          }
        }, true)
      }}
    >
      <Sidebar id="ob-sidebar" />
      <div id="ob-editZone"><EditZone /></div>
      <StatusBar id="ob-statusBar" />

      <Show when={isAboutDropFiles()}>
        <div class="ob-dropFileMask">
          <div><i class="i-mdi-file-plus text-[32px]" /></div>
          <div>Drop to Import Files</div>
        </div>
      </Show>

      <Show when={!!oneBox.ui.state.promptRequest}>
        <PromptBox req={oneBox.ui.state.promptRequest![0]} onResolve={oneBox.ui.state.promptRequest![1]} />
      </Show>
    </div>
  );
}

function EditZone() {
  const oneBox = useOneBox()
  const owner = getOwner()

  watch(() => oneBox.panels.state.dockview, dockview => {
    if (!dockview) return

    if (!oneBox.api.loadLastProject()) {
      console.log('create empty file')
      oneBox.api.createEmptyFile()
    }

    // update cache when window lost focus
    document.body.addEventListener('focusout', () => {
      runWithOwner(owner, () => oneBox.api.saveLastProject())
    })
  })

  return <OneBoxDockview />
}
