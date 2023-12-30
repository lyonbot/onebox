/* @refresh granular */
import { Show, batch, createSignal, getOwner, onMount, runWithOwner } from "solid-js";
import { ExportedProjectData, useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";
import { clsx, modKey, getSearchMatcher, Nil } from "yon-utils";
import { getProjectArchiveReader, guessFileNameType, isValidFilename, scanFilesFromDataTransferItem } from "./utils/files";
import { guessLangFromName } from "./utils/langUtils";
import { Buffer } from "buffer";
import { PromptBox } from "./components/PromptBox";
import { setupMonacoEnv } from "./monaco";
import { installPlugin } from "./plugins";

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()
  setupMonacoEnv(oneBox)

  // install plugins
  import('onebox-markdown').then(m => installPlugin(oneBox, m.default))
  import('onebox-run-script').then(m => installPlugin(oneBox, m.default))

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
              const ans = getSearchMatcher(input).filter(names)
                .map(name => ({ label: name as any, value: name }))

              if (isValidFilename(input)) ans.unshift({
                label: () => <div>
                  <i class="i-mdi-plus-circle"></i>
                  {` Create File "${input}"`}
                </div>,
                value: createNewFilePlaceholder + input,
              })

              return ans
            },
          }).then(filename => {
            if (!filename) return
            if (filename.startsWith(createNewFilePlaceholder)) {
              oneBox.api.createFileAndOpen(filename.slice(createNewFilePlaceholder.length))
            } else {
              oneBox.api.openFile(filename)
            }
          })
        }
        return
      }

      if (modKey(ev) === 0 && ev.code === 'F2') {
        ev.preventDefault()
        oneBox.api.interactiveRenameFile(oneBox.api.getCurrentFilename())
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

          if (!oneBox.panels.state.isDraggingPanel) handleIncomingDataTransferEvent(ev, ev.dataTransfer)
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
    const items: [name: string, file: File][] = []

    for (const rawItem of dataTransfer.items) {
      for await (const iterator of scanFilesFromDataTransferItem(rawItem)) {
        items.push(iterator)
      }
    }

    // maybe importing a project archive
    if (items.length === 1 && items[0][0].endsWith('.zip')) {
      const archiveLoader = await getProjectArchiveReader(items[0][1]).catch(() => null)
      if (archiveLoader && await oneBox.confirm(<div>
        <p>Do you want to <b>Import project archive</b> "{archiveLoader.project.title}" ?</p>
        <p class="text-orange-6"><i class="i-mdi-warning"></i> Will empty current files!</p>
      </div>)) {
        // import project, skip all things

        const files = await archiveLoader.getCompletedFiles()
        const fullProject: ExportedProjectData = {
          ...archiveLoader.project,
          files,
        }

        batch(() => {
          oneBox.api.importProject(fullProject)
        })

        // TODO: add error msg toast
        return []
      }
    }

    return await Promise.all(items.map(pushFile))

    async function pushFile([name, file]: [string, File]) {
      const isTextFile = file.type.startsWith('text/') || file.type.includes('/json');
      return (oneBox.files.api.createFile({
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
    const file = oneBox.api.getFile(oneBox.api.getCurrentFilename())
    const handlers: (() => void)[] = []

    // ----------------------------

    if (dataTransfer.types.includes('Files')) {
      handlers.push(async () => {
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
      })
    }

    if (dataTransfer.types.some(x => x.startsWith('text/'))) {
      handlers.push(async () => {
        const text = dataTransfer.getData('text/plain')
        if (!text.trim()) return // empty

        if (editor) {
          editor.executeEdits('paste', [{
            range: editor.getSelection()!,
            text,
          }])
        } else {
          batch(() => {
            const newFile = oneBox.api.createFileAndOpen('pasted.txt')
            newFile.setContent(text)
          })
        }
      })
    }

    // ----------------------------

    if (handlers.length) {
      ev.preventDefault()
      ev.stopPropagation()
      handlers.forEach(f => f())
    }
  }
}

function EditZone() {
  const oneBox = useOneBox()
  const owner = getOwner()

  watch(() => oneBox.panels.state.dockview, dockview => {
    if (!dockview) return

    setTimeout(() => {
      if (!oneBox.api.loadLastProject()) {
        // oneBox.api.createFileAndOpen()
      }

      // update cache when window lost focus, or mouse leave the whole window
      const save = () => runWithOwner(owner, () => oneBox.api.saveLastProject())
      document.body.addEventListener('focusout', save)
      document.documentElement.addEventListener('mouseleave', save)
      document.addEventListener('visibilitychange', save)

    }, 100) // avoid floating group losing position (due to dockview's size not ready)
  })

  return <OneBoxDockview />
}
