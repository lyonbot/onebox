import { batch, createRoot, getOwner } from 'solid-js'
import { VTextFile, createFilesStore } from './files'
import { createPanelsStore } from './panels'
import { createUIStore } from './ui'
import { watch } from '~/utils/solid'
import { cloneDeep } from 'lodash'

export type OneBox = ReturnType<typeof createOneBoxStore>

export interface ExportedProjectData {
  is: 'oneBox:projectData'
  files: VTextFile[]
  dockview?: any // layout json
}

const LS_LAST_PROJECT_DATA = 'oneBox:lastProjectData'

function createOneBoxStore() {
  const getRoot: () => OneBox = () => root
  const owner = getOwner()

  const files = createFilesStore(getRoot)
  const panels = createPanelsStore(/* getRoot */)
  const ui = createUIStore()

  const api = {
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
        if (panels.state.activePanel?.filename === filename) return // already active, in one panel
        panels.update('activePanelId', existingPanel.id)
      }
    },
    resetProject() {
      panels.state.dockview.clear()
      panels.update({ panels: [], activePanelId: '' })
      files.update({ files: [] })
    },
    exportProject() {
      const data: ExportedProjectData = {
        is: 'oneBox:projectData',
        files: files.state.files.map(f => cloneDeep(f)),
        dockview: panels.state.dockview?.toJSON()
      }
      return data
    },
    importProject(data: ExportedProjectData) {
      if (!data || data.is !== 'oneBox:projectData') return

      // first of all, close all panels
      api.resetProject()

      // then import files and open panels
      files.update('files', cloneDeep(data.files))
      if (data.dockview) panels.state.dockview.fromJSON(cloneDeep(data.dockview))
    },
    saveLastProject() {
      const data = api.exportProject()
      localStorage.setItem(LS_LAST_PROJECT_DATA, JSON.stringify(data))
    },
    loadLastProject() {
      const data = localStorage.getItem(LS_LAST_PROJECT_DATA)
      if (!data) return false

      const projectData = JSON.parse(data) as ExportedProjectData
      if (!projectData.files?.length) return false
      api.importProject(projectData)
      return true
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
    files,
    panels,
    owner,
    ui,
    api,
  }

  return root
}

const oneBox = createRoot(createOneBoxStore)
export const useOneBox = () => oneBox
