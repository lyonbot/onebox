import JSZip from 'jszip'
import localForage from 'localforage'
import { extname } from 'path'
import { batch, createEffect, createRoot, createSignal, getOwner, mapArray, onCleanup, untrack } from 'solid-js'
import { VTextFile, createFilesStore } from './files'
import { createPanelsStore } from './panels'
import { createUIStore } from './ui'
import { addListener, nextTick, watch } from '~/utils/solid'
import { cloneDeep, cloneDeepWith, debounce } from 'lodash'
import { downloadFile, isValidFilename } from '~/utils/files'
import { Lang, LangDescriptions } from '~/utils/lang'
import { Buffer } from "buffer";
import { Nil, getSearchMatcher } from 'yon-utils'
import { guessLangFromContent } from '~/utils/langUtils'
import { runAndKeepCursor } from '~/monaco/utils'

export type OneBox = ReturnType<typeof createOneBoxStore>

export interface ExportedProjectData {
  is: 'oneBox:projectData'
  title: string
  files: {
    filename: string
    content: string
    contentBinary?: string | false // base64
    lang: string
    mtime: number
    ctime: number
  }[]
  showSidebar?: boolean
  dockview?: any // layout json
}

const emptyProjectData: Required<ExportedProjectData> = {
  is: 'oneBox:projectData',
  title: 'OneBox Project',
  files: [],
  showSidebar: true,
  dockview: null,
}

const LS_LAST_PROJECT_DATA = 'oneBox:lastProjectData'

function createOneBoxStore() {
  const getRoot: () => OneBox = () => root
  const owner = getOwner()

  const [title, setTitle] = createSignal('OneBox Project')
  const files = createFilesStore(getRoot)
  const panels = createPanelsStore(/* getRoot */)
  const ui = createUIStore()

  // some logic about auto-save current project
  let isImporting = false;
  const autoSaveDebounceTime = 2000
  const unsetIsImporting = debounce(() => isImporting = false, autoSaveDebounceTime + 100, { leading: false, trailing: true })
  const setIsImporting = () => { isImporting = true; unsetIsImporting(); api.saveLastProject.cancel() }
  const saveLastProjectNow = debounce(() => {
    api.saveLastProject()
    api.saveLastProject.flush()
  }, 10, {leading:false, trailing:true})
  watch(() => panels.state.dockview, dockview => {
    if (!dockview) return

    // update cache when window lost focus, or mouse leave the whole window
    const flushSave = () => api.saveLastProject.flush()
    addListener(document.body, 'focusout', flushSave)
    addListener(document.documentElement, 'mouseleave', flushSave)
    addListener(document, 'visibilitychange', flushSave)

    // watch dockview's modifications
    const queueSave2 = debounce(api.saveLastProject, 100, { leading: false, trailing: true })
    dockview.onDidLayoutChange(() => !panels.state.isDraggingPanel && queueSave2())

    // watch file's modifications
    createEffect(mapArray(() => files.state.files, file => {
      createEffect(() => {
        file.content;
        file.contentBinary;
        file.lang;

        // update when one of them updated
        untrack(() => api.saveLastProject())
      })

      // in some case we must save immediately
      saveLastProjectNow()
      watch(() => file.filename, saveLastProjectNow)
      watch(() => file.lang, saveLastProjectNow)
      onCleanup(saveLastProjectNow) // file deleted
    }))

    // load last project
    setTimeout(api.loadLastProject, 20) // avoid floating group losing position (due to dockview's size not ready)
  })

  const api = {
    getCurrentFilename() {
      return panels.state.activePanel?.filename || ''
    },
    getCurrentFile() {
      return files.api.getControllerOf(api.getCurrentFilename())
    },
    getFile(filename: string | Nil) {
      return files.api.getControllerOf(filename)
    },
    createFileAndOpen(filename?: string | Partial<VTextFile>, openPosition?: false | 'within' | 'left' | 'right' | 'above' | 'below') {
      const file = files.api.createFile(typeof filename === 'string' ? { filename } : filename || {})
      if (openPosition !== false) panels.api.openPanel({ filename: file.filename }, openPosition || 'within')

      return file
    },
    openFile(filename: string, forceNewPanel?: false | 'within' | 'left' | 'right' | 'above' | 'below') {
      const existingPanel = !forceNewPanel && panels.state.panels.find(p => !p.panelType && p.filename === filename)
      if (!existingPanel) {
        panels.api.openPanel({ filename }, forceNewPanel || 'within')
      } else {
        if (api.getCurrentFilename() === filename) return // already active, in one panel
        panels.update('activePanelId', existingPanel.id)
      }
    },
    resetProject() {
      panels.state.dockview.clear()
      panels.update({ panels: [], activePanelId: '' })
      files.update({ files: [] })
      ui.update({ showSidebar: true })
      setTitle('OneBox Project')
    },
    exportProject() {
      const data: ExportedProjectData = {
        is: 'oneBox:projectData',
        title: title(),
        files: files.state.files.map(f => ({
          filename: f.filename,
          content: f.content,
          contentBinary: f.contentBinary && Buffer.from(f.contentBinary).toString('base64'),
          lang: f.lang,
          mtime: f.mtime,
          ctime: f.ctime,
        })),
        showSidebar: ui.state.showSidebar,
        dockview: cloneDeepWith(panels.state.dockview?.toJSON(), (value) => {
          if (typeof value === 'function') return null
        }),
      }
      return data
    },
    importProject(incoming: ExportedProjectData) {
      if (!incoming || incoming.is !== 'oneBox:projectData') return
      setIsImporting()

      // first of all, close all panels
      api.resetProject()

      // then import files and open panels
      const data = { ...emptyProjectData, ...incoming }
      batch(() => {
        setTitle(data.title)
        files.update('files', data.files.map((raw): VTextFile => {
          return {
            ...raw,
            lang: raw.lang as Lang || Lang.UNKNOWN,
            contentBinary: !!raw.contentBinary && Buffer.from(raw.contentBinary, 'base64'),
          }
        }))
        ui.update({ showSidebar: data.showSidebar })
      })
      if (data.dockview) {
        nextTick(() => {
          panels.state.dockview.fromJSON(cloneDeep(data.dockview))
        })
      }
    },
    saveLastProject: debounce(async () => {
      if (isImporting) return
      const data = api.exportProject()
      await localForage.setItem(LS_LAST_PROJECT_DATA, data)
    }, autoSaveDebounceTime, { leading: true, trailing: true }),
    async loadLastProject() {
      const projectData = await localForage.getItem<ExportedProjectData>(LS_LAST_PROJECT_DATA)
      if (!projectData) return false
      if (!projectData.files?.length) return false
      api.importProject(projectData)
      return true
    },

    async interactiveRenameFile(filename: string | Nil) {
      if (!filename) return

      const file = files.api.getControllerOf(filename)
      if (!file) return

      runAndKeepCursor(() => panels.state.activeMonacoEditor, async () => {
        const newName = await ui.api.prompt(
          'Rename current file to', {
          default: filename,
          onMount(ev) {
            if (ev.inputBox.selectionEnd) {
              ev.inputBox.selectionStart = filename.lastIndexOf('/') + 1
              ev.inputBox.selectionEnd -= extname(filename).length
            }
          },
          enumOptions(input) {
            if (input && !isValidFilename(input)) return [
              { value: '', label: () => <span class='text-red-6'><i class="i-mdi-close"></i> Invalid Filename</span> },
            ]
          },
        })
        if (!newName) return

        file.setFilename(newName)
      })
    },
    interactiveSummonAction: (filename: string | Nil) => runAndKeepCursor(() => panels.state.activeMonacoEditor, async () => {
      const file = files.api.getControllerOf(filename)
      if (!file) return

      const actions = await import('~/actions').then(m => m.getActions(getRoot(), filename));

      const guessTo = (file.lang === Lang.UNKNOWN) && guessLangFromContent(file.content)
      if (guessTo && guessTo !== Lang.UNKNOWN) {
        const desc = LangDescriptions[guessTo]
        actions.unshift({
          label: () => <div><i class="i-mdi-thought-bubble"></i> Switch to <b class='text-green-7'>{desc.name}</b> Language</div>,
          value: 'switch to set guessed language',
          run() {
            file.setLang(guessTo)
          },
        })
      }

      const actionId = await ui.api.prompt("Action", {
        enumOptions(input) {
          return getSearchMatcher(input).filter(actions)
        },
      })
      const action = actions.find(a => a.value === actionId)
      if (action) await action.run()
    }),

    async downloadCurrentFile() {
      const currentFilename = api.getCurrentFilename()
      const file = files.state.files.find(f => f.filename === currentFilename)
      if (!file) return

      downloadFile(file.filename, file.contentBinary || file.content)
    },
    async downloadCurrentProject() {
      const name = await ui.api.prompt('Enter file name (without .zip)', { default: title() })
      if (!name) return

      const zip = new JSZip()
      zip.file('onebox.project.json', JSON.stringify({ ...api.exportProject(), files: undefined }))

      for (const file of files.state.files) {
        zip.file(file.filename, file.contentBinary || file.content)
      }

      zip.generateAsync({ type: 'blob' }).then(content => {
        downloadFile(name + '.zip', content)
      })
    },
  }

  // close file panels when file is deleted
  watch(
    () => panels.state.panels.some(p => !files.models()[p.filename]),
    () => {
      const ids = panels.state.panels.filter(p => !files.models()[p.filename]).map(x => x.id)
      batch(() => {
        for (const id of ids) panels.api.closePanel(id)
      })
    })

  const root = {
    get title() { return title() },
    files,
    panels,
    owner,
    ui,
    api,

    prompt: ui.api.prompt,
    confirm: ui.api.confirm,
  }

  return root
}

const oneBox = createRoot(createOneBoxStore)
export const useOneBox = () => oneBox
