import { batch, createRoot, getOwner } from 'solid-js'
import { createFilesStore } from './files'
import { createPanelsStore } from './panels'
import { createUIStore } from './ui'
import { watch } from '~/utils/solid'

export type OneBox = ReturnType<typeof createOneBoxStore>

function createOneBoxStore() {
  const getRoot: () => OneBox = () => root
  const owner = getOwner()

  const files = createFilesStore(getRoot)
  const panels = createPanelsStore(/* getRoot */)
  const ui = createUIStore()

  const api = {
    createEmptyFile(filename?: string) {
      const f = files.api.createFile(filename)
      panels.api.openPanel({ filename: f.filename })

      return f
    },
    openFile(filename: string, forceNewPanel?: boolean) {
      const existingPanel = !forceNewPanel && panels.state.panels.find(p => p.filename === filename)
      if (!existingPanel) {
        panels.api.openPanel({ filename })
      } else {
        panels.update('activePanelId', existingPanel.id)
      }
    }
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
