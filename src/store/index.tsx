import JSZip from 'jszip'
import localForage from 'localforage'
import { JSXElement, batch, createRoot, createSignal, getOwner } from 'solid-js'
import { VTextFile, createFilesStore } from './files'
import { createPanelsStore } from './panels'
import { createUIStore } from './ui'
import { watch } from '~/utils/solid'
import { cloneDeep, cloneDeepWith, debounce } from 'lodash'
import { downloadFile } from '~/utils/files'
import { Lang, LangDescriptions } from '~/utils/lang'
import { Buffer } from "buffer";
import { Fn, Nil } from 'yon-utils'
import { extname, guessLangFromContent } from '~/utils/langUtils'

export type OneBox = ReturnType<typeof createOneBoxStore>

export interface ExportedProjectData {
  is: 'oneBox:projectData'
  title: string
  files: {
    filename: string
    content: string
    contentBinary?: string | false // base64
    lang: string
  }[]
  dockview?: any // layout json
}

const LS_LAST_PROJECT_DATA = 'oneBox:lastProjectData'

function createOneBoxStore() {
  const getRoot: () => OneBox = () => root
  const owner = getOwner()

  const [title, setTitle] = createSignal('OneBox Project')
  const files = createFilesStore(getRoot)
  const panels = createPanelsStore(/* getRoot */)
  const ui = createUIStore()

  const api = {
    getCurrentFilename() {
      return panels.state.activePanel?.filename || ''
    },
    createEmptyFile(filename?: string, forceNewPanel?: false | 'within' | 'left' | 'right' | 'above' | 'below') {
      const file = files.api.createFile({ filename })
      panels.api.openPanel({ filename: file.filename }, forceNewPanel || 'within')

      return file
    },
    openFile(filename: string, forceNewPanel?: false | 'within' | 'left' | 'right' | 'above' | 'below') {
      const existingPanel = !forceNewPanel && panels.state.panels.find(p => p.filename === filename)
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
      setTitle('OneBox Project')
    },
    exportProject() {
      const data: ExportedProjectData = {
        is: 'oneBox:projectData',
        title: title(),
        files: files.state.files.map(f => ({
          ...f,
          contentBinary: f.contentBinary && Buffer.from(f.contentBinary).toString('base64'),
        })),
        dockview: cloneDeepWith(panels.state.dockview?.toJSON(), (value) => {
          if (typeof value === 'function') return null
        }),
      }
      return data
    },
    importProject(data: ExportedProjectData) {
      if (!data || data.is !== 'oneBox:projectData') return

      // first of all, close all panels
      api.resetProject()

      // then import files and open panels
      setTitle(data.title || 'OneBox Project')
      files.update('files', data.files.map((raw): VTextFile => {
        return {
          ...raw,
          lang: raw.lang as Lang || Lang.UNKNOWN,
          contentBinary: !!raw.contentBinary && Buffer.from(raw.contentBinary, 'base64'),
        }
      }))
      if (data.dockview) panels.state.dockview.fromJSON(cloneDeep(data.dockview))
    },
    saveLastProject: debounce(async () => {
      const data = api.exportProject()
      await localForage.setItem(LS_LAST_PROJECT_DATA, data)
    }, 2000, { leading: true, trailing: true }),
    async loadLastProject() {
      const projectData = await localForage.getItem<ExportedProjectData>(LS_LAST_PROJECT_DATA)
      if (!projectData) return false
      if (!projectData.files?.length) return false
      api.importProject(projectData)
      return true
    },

    async interactiveRenameFile(filename: string | Nil) {
      if (!filename) return

      const file = files.controllers()[filename]
      if (!file) return

      const newName = await ui.api.prompt(
        'Rename to', {
        default: filename,
        onMount(ev) {
          if (ev.inputBox.selectionEnd) ev.inputBox.selectionEnd -= extname(filename).length
        },
      })
      if (!newName) return

      file.setFilename(newName)
    },
    async interactiveSummonAction(filename: string | Nil) {
      const file = files.api.getControllerOf(filename)
      if (!file) return

      const actions: { title?: JSXElement | (() => JSXElement), value: string, run: Fn }[] = [];

      const guessTo = (file.lang === Lang.UNKNOWN) && guessLangFromContent(file.content)
      if (guessTo && guessTo !== Lang.UNKNOWN) {
        const desc = LangDescriptions[guessTo]
        actions.push({
          title: () => <div><i class="i-mdi-thought-bubble"></i> Set Language to <b>{desc.name}</b></div>,
          value: 'guessLang',
          run() {
            file.setLang(guessTo)
          },
        })
      }

      if (file.lang === Lang.MARKDOWN) {
        actions.push({
          title: () => <div><i class="i-mdi-markdown"></i> Preview Markdown</div>,
          value: 'preview markdown',
          run() {
            panels.api.openPanel({ panelType: 'markdownPreview', filename: file.filename }, 'right')
          },
        })
      }

      ui.api.prompt("Action", {
        enumOptions(input) {
          return actions
        },
      }).then(value => {
        const action = actions.find(a => a.value === value)
        if (action) action.run()
      })
    },

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
    () => panels.state.panels.some(p => !files.controllers()[p.filename]),
    () => {
      const ids = panels.state.panels.filter(p => !files.controllers()[p.filename]).map(x => x.id)
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
  }

  return root
}

const oneBox = createRoot(createOneBoxStore)
export const useOneBox = () => oneBox
