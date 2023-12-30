/* @refresh granular */
import { Show, batch, createSignal, getOwner, onMount, runWithOwner } from "solid-js";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";
import { clsx, modKey, getSearchMatcher, Nil } from "yon-utils";
import { guessFileNameType, scanFiles } from "./utils/files";
import { guessLangFromName } from "./utils/langUtils";
import { VTextFileController } from "./store/files";
import { Buffer } from "buffer";
import { PromptBox } from "./components/PromptBox";
import { setupMonacoEnv } from "./monaco";

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()
  setupMonacoEnv(oneBox)

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

      if (modKey(ev) === modKey.Mod && ev.code == 'KeyP') {
        ev.preventDefault()
        const files = oneBox.files.state.files;
        if (files.length) {
          const names = files.map(f => f.filename)
          const createNewFilePlaceholder = '<create new file>:'
          oneBox.prompt('Open File', {
            enumOptions(input) {
              const ans = getSearchMatcher(input()).filter(names)
                .map(name => ({ label: name as any, value: name }))

              if (input()) ans.unshift({
                label: () => <div>
                  <i class="i-mdi-plus-circle"></i>
                  {` Create File "${input()}"`}
                </div>,
                value: createNewFilePlaceholder + input(),
              })

              return ans
            },
          }).then(filename => {
            if (!filename) return
            if (filename.startsWith(createNewFilePlaceholder)) {
              oneBox.api.createEmptyFile(filename.slice(createNewFilePlaceholder.length))
            } else {
              oneBox.api.openFile(filename)
            }
          })
        }
        return
      }
    });

    window.addEventListener('paste', ev => {
      handleIncomingDataTransferEvent(ev, ev.clipboardData)
    }, true)
  });

  const [isAboutDropFiles, setIsAboutDropFiles] = createSignal(false)

  return (
    <div
      id="ob-app"
      tabindex={0}
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

        div.addEventListener('drop', (ev) => {
          dragBug = 0;
          setIsAboutDropFiles(false)

          handleIncomingDataTransferEvent(ev, ev.dataTransfer)
        }, true)
      }}
      onFocusIn={() => oneBox.ui.update('rootHasFocus', x => x + 1)}
      onFocusOut={() => oneBox.ui.update('rootHasFocus', x => x - 1)}
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

  async function importFilesFromEvent(dataTransfer: DataTransfer) {
    const imported = [] as VTextFileController[];
    for (const rawItem of dataTransfer.items) {
      const handle = rawItem.webkitGetAsEntry?.();
      if (handle) {
        for await (const [name, file] of scanFiles(handle)) {
          await pushFile(file, name);
        }
      } else {
        // maybe just a file from screenshot
        const file = rawItem.getAsFile();
        if (file) await pushFile(file, file.name);
      }
    }
    return imported;

    async function pushFile(file: File, name: string) {
      const isTextFile = file.type.startsWith('text/') || file.type.includes('/json');
      imported.push(oneBox.files.api.createFile({
        filename: name,
        content: isTextFile ? await file.text() : '',
        contentBinary: !isTextFile && Buffer.from(await file.arrayBuffer()),
        lang: guessLangFromName(name),
      }));
    }
  }

  /** including paste, drop */
  function handleIncomingDataTransferEvent(ev: Event, dataTransfer: DataTransfer | Nil) {
    if (!dataTransfer) return
    if ((ev.target as HTMLElement)?.matches?.('textarea, input, [contenteditable], [contenteditable] *')) return

    const editor = oneBox.panels.state.activeMonacoEditor
    const file = oneBox.files.api.getControllerOf(oneBox.api.getCurrentFilename())
    let handler: (() => void) | undefined

    // ----------------------------

    if (dataTransfer.types.includes('Files')) {
      handler = async () => {
        // dropped files
        const imported = await importFilesFromEvent(dataTransfer);

        // paste filePath into editor; or open first 3 files if no editor focused
        if (editor && file) {
          // paste the urls into file
          let convert = (filename: string) => filename
          if (file.lang === 'markdown') {
            convert = filename => {
              const url = `./${filename}`
              const guessType = guessFileNameType(filename)

              if (guessType === 'image') return `![${filename}](${url})`
              if (guessType === 'video') return `<video src="${url}" controls></video>`
              if (guessType === 'audio') return `<audio src="${url}" controls></audio>`

              return `[${filename}](${url})`
            }
          }

          const text = imported.map(x => x.filename).map(convert).join('\n')
          editor.executeEdits('paste', [{
            range: editor.getSelection()!,
            text,
          }])
        } else {
          // open first 3 files
          imported.slice(0, 3).forEach(file => {
            oneBox.api.openFile(file.filename, 'right')
          })
        }
      }
    }

    if (dataTransfer.types.some(x => x.startsWith('text/'))) {
      handler = async () => {
        const text = dataTransfer.getData('text/plain')
        if (editor) {
          editor.executeEdits('paste', [{
            range: editor.getSelection()!,
            text,
          }])
        } else {
          batch(() => {
            const newFile = oneBox.api.createEmptyFile('pasted.txt')
            newFile.setContent(text)
          })
        }
      }
    }

    // ----------------------------

    if (handler) {
      ev.preventDefault()
      ev.stopPropagation()
      handler()
    }
  }
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
