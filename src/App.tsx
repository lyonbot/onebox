/* @refresh granular */
import _, { sortBy } from 'lodash'
import * as monaco from 'monaco-editor';
import { basename, dirname, join, relative } from "path";
import { Show, batch, createSignal, onMount } from "solid-js";
import { ExportedProjectData, useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";
import { clsx, modKey, getSearchMatcher, Nil } from "yon-utils";
import { getProjectArchiveReader, guessFileNameType, isValidFilename, scanFilesFromDataTransferItem } from "./utils/files";
import { guessLangFromName } from "./utils/langUtils";
import { Buffer } from "buffer";
import { PromptBox } from "./components/PromptBox";
import { setupMonacoEnv } from "./monaco";
import { installPlugin } from "./plugins";
import { addListener } from './utils/solid';
import { OneBoxDependenciesPlugin } from './builtin-plugins/dependencies';
import { Lang } from './utils/lang';

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()
  setupMonacoEnv(oneBox)

  // install plugins
  installPlugin(oneBox, OneBoxDependenciesPlugin)
  import('onebox-markdown').then(m => installPlugin(oneBox, m.default))
  import('onebox-run-script').then(m => installPlugin(oneBox, m.default))

  onMount(() => {
    addListener(window, 'keydown', ev => {
      // Mod+B toggle sidebar
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyB') {
        ev.preventDefault()
        oneBox.ui.api.toggleSidebar()
        return
      }

      // Mod+S save file
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyS') {
        ev.preventDefault()
        oneBox.api.downloadCurrentFile()
        return
      }

      // Mod+Shift+S save project
      if (modKey(ev) === (modKey.Mod | modKey.Shift) && ev.code == 'KeyS') {
        ev.preventDefault()
        oneBox.api.downloadCurrentProject()
        return
      }

      // Mod+W close file
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyW') {
        ev.preventDefault()
        const id = oneBox.panels.state.activePanelId
        if (id) oneBox.panels.api.closePanel(id)
        return
      }

      // Mod+N create file
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyN') {
        ev.preventDefault()
        const presetName = oneBox.files.api.nonConflictFilename(join(dirname(oneBox.api.getCurrentFilename()), 'untitled.txt'))
        oneBox.prompt('Create File', {
          default: presetName,
          onMount(env) {
            env.inputBox.selectionStart = env.inputBox.value.lastIndexOf('/') + 1
            env.inputBox.selectionEnd = env.inputBox.value.length - 4
          },
        }).then(filename => {
          if (filename) oneBox.api.createFileAndOpen(filename)
        })
        return
      }

      // Mod+O / Mod+P open file
      if (modKey(ev) === modKey.Mod && (ev.code == 'KeyP' || ev.code == 'KeyO')) {
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

      // Mod+Enter open action panel
      if (modKey(ev) === modKey.Mod && ev.code == 'Enter') {
        ev.preventDefault()
        oneBox.api.interactiveSummonAction(oneBox.api.getCurrentFilename())
        return
      }

      // F2 | Mod+Shift+R rename file
      if (
        (modKey(ev) === 0 && ev.code === 'F2') ||
        (modKey(ev) === (modKey.Mod | modKey.Shift) && ev.code === 'KeyR')
      ) {
        ev.preventDefault()
        oneBox.api.interactiveRenameFile(oneBox.api.getCurrentFilename())
        return
      }
    });

    addListener(window, 'paste', ev => {
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
        let dragFromSelf = false

        addListener(div, 'dragstart', ev => {
          dragFromSelf = true
        }, true)

        addListener(div, 'dragend', ev => {
          dragFromSelf = false
        }, true)

        addListener(div, 'dragenter', ev => {
          if (!dragFromSelf) {
            const hasFiles = !!ev.dataTransfer?.types.includes('Files')
            setIsAboutDropFiles(hasFiles)
            if (hasFiles) ev.stopPropagation()
            dragBug++;
          }
        }, true)

        addListener(div, 'dragover', ev => {
          if (!dragFromSelf && isAboutDropFiles()) {
            ev.preventDefault()
            ev.stopPropagation()
          }
        }, true)

        addListener(div, 'dragleave', (ev) => {
          if (!dragFromSelf) {
            if (--dragBug === 0) setIsAboutDropFiles(false)
            if (isAboutDropFiles()) ev.stopPropagation()
          }
        }, true)

        addListener(div, 'drop', (ev) => {
          if (!dragFromSelf) {
            dragBug = 0;
            setIsAboutDropFiles(false)
            handleIncomingDataTransferEvent(ev, ev.dataTransfer) // no validate `isAboutDropFiles`; check monaco in handleIncomingDataTransferEvent
          }
        }, true)
      }}
      onFocusIn={() => oneBox.ui.update('rootHasFocus', x => x + 1)}
      onFocusOut={() => oneBox.ui.update('rootHasFocus', x => x - 1)}
    >
      <Sidebar id="ob-sidebar" />
      <div id="ob-editZone"><OneBoxDockview /></div>
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

  async function importFilesFromEvent(dataTransfer: DataTransfer, relativeFileName?: string) {
    const items: [name: string, file: File][] = []
    const baseDir = dirname(relativeFileName || '')

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
      const contentBinary = !isTextFile && Buffer.from(await file.arrayBuffer());

      // find same binary file in current project
      // avoid repeated importing
      const duplicatedBinaryFile = contentBinary && sortBy(
        oneBox.files.state.files.filter(f => (
          f.contentBinary && // is binary file
          f.ctime === f.mtime && // not modified since imported
          dirname(f.filename) === baseDir && // in same dir
          f.contentBinary.equals(contentBinary) // same binary content
        )),
        f => f.ctime
      )[0]
      if (duplicatedBinaryFile) return duplicatedBinaryFile

      // else, create new file
      return (oneBox.files.api.createFile({
        filename: join(baseDir, name),
        content: isTextFile ? await file.text() : '',
        contentBinary,
        lang: guessLangFromName(name),
      }));
    }
  }

  /** including paste, drop */
  function handleIncomingDataTransferEvent(ev: Event, dataTransfer: DataTransfer | Nil) {
    if (!dataTransfer) return
    if (dataTransfer.types.includes('text/x-ob-dnd-ignore')) return

    const target = ev.target as HTMLElement

    const isDropToMonaco = !!target && (target.matches('.monaco-scrollable-element *') || target.className.includes('monaco'))
    const isDropToRegularEditor = !isDropToMonaco && !!target.matches?.('textarea, input, [contenteditable], [contenteditable] *')
    const isNotDraggingFile = !dataTransfer.types.includes('Files')
    if ((isNotDraggingFile && isDropToMonaco) || isDropToRegularEditor) return

    const editor = oneBox.panels.state.activeMonacoEditor
    const file = oneBox.api.getFile(oneBox.api.getCurrentFilename())
    const handlers: (() => void)[] = []

    // ----------------------------

    if (dataTransfer.types.includes('Files')) {
      handlers.push(async () => {
        // dropped files
        const imported = await importFilesFromEvent(dataTransfer, file?.filename);

        // paste filePath into editor; or open first 3 files if no editor focused
        if (editor && file) {
          // paste the urls into file
          let convert = (filename: string) => filename
          if (file.lang === Lang.UNKNOWN || file.lang === Lang.MARKDOWN) {
            convert = filename => {
              let url = relative(dirname(file.filename), filename)
              if (!url.startsWith('.')) url = `./${url}`

              const guessType = guessFileNameType(filename)
              if (guessType === 'image') return `![${basename(filename)}](${url})`
              if (guessType === 'video') return `<video src="${url}" controls></video>`
              if (guessType === 'audio') return `<audio src="${url}" controls></audio>`

              return `[${basename(filename)}](${url})`
            }
          }

          const text = imported.map(x => x.filename).map(convert).join('\n')
          editor.executeEdits('paste', [{
            range: editor.getSelection()!,
            text,
          }])

          // for unknown text, if we pasted a image, treat it as Markdown?
          if (file.lang === Lang.UNKNOWN) {
            setTimeout(() => file.setLang(Lang.MARKDOWN), 100)
          }
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
