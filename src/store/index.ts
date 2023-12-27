import { createStore } from 'solid-js/store'
import { VFile, VTextFile } from './file'
import { batch, createRoot, getOwner, onCleanup } from 'solid-js'
import { createLifecycleArray, watch } from '~/utils/solid'
import { DockviewComponent, DockviewPanelApi } from 'dockview-core'
import { uniqueId } from 'lodash'
import { delay } from 'yon-utils'

const LS_PROJECT = 'oneBox:project'

export interface UIPanel {
  id: string
  file: VFile
  dockApi?: DockviewPanelApi
}

export interface DumpedProject {
  files: Pick<VFile, 'filename' | 'content' | 'lang'>[]
  panels: { id: string, filename: string }[]
  dockviewLayout: any
}

function createOneBoxStore() {
  const files = createLifecycleArray<VFile>()
  const owner = getOwner()

  const [store, updateStore] = createStore({
    panels: [] as UIPanel[],
    get files() { return files() /* do not mutate this array with `updateStore` */ },
    showSidebar: true,
    activePanelIndex: -1,
    get activePanel() { return store.panels[store.activePanelIndex] },

    isDraggingPanel: false,
    dockview: null as unknown as DockviewComponent
  })

  // avoid dockview's drag-n-drop polluting monaco
  watch(() => store.isDraggingPanel, (dragging) => {
    if (!dragging) return

    const listener = () => updateStore('isDraggingPanel', false)
    window.addEventListener('dragend', listener,)
    window.addEventListener('drop', listener,)

    onCleanup(() => {
      window.removeEventListener('dragend', listener,)
      window.removeEventListener('drop', listener,)
    })
  })

  const api = {
    projectDump(): DumpedProject {
      return {
        files: files().map(x => ({
          filename: x.filename,
          content: x.content,
          lang: x.lang,
        })),
        panels: store.panels.map(x => ({
          id: x.id,
          filename: x.file.filename,
        })),
        dockviewLayout: store.dockview?.toJSON(),
      }
    },
    async projectLoad(dump: DumpedProject) {
      batch(() => {
        updateStore('activePanelIndex', -1)
        updateStore('panels', [])
        files.clear()
      })

      store.panels;

      for (const file of dump.files) {
        const f = api.createTextFileWithContent(file.filename, file.content)
        f.lang = file.lang
      }
      updateStore('panels', dump.panels.map(x => ({
        id: x.id,
        file: files().find(y => y.filename === x.filename)!
      })))

      await delay(100)
      store.dockview?.fromJSON({ ...dump.dockviewLayout  })
    },

    projectCacheSave() {
      localStorage.setItem(LS_PROJECT, JSON.stringify(api.projectDump()))
    },
    projectCacheLoad() {
      const dump = localStorage.getItem(LS_PROJECT)
      if (!dump) return
      api.projectLoad(JSON.parse(dump))
    },

    createEmptyFile() {
      return api.createTextFileWithContent('text-' + files().length + '.txt', '')
    },
    createTextFileWithContent(filename: string, content: string = '') {
      const file = files.push(() => new VTextFile(filename, content))
      api.openFile(file, true)
      return file
    },

    deleteFile(file: VFile) {
      files.remove(file)
      updateStore('panels', panels => panels.filter(x => x.file.filename !== file.filename))
    },
    toggleSidebar: () => updateStore('showSidebar', show => !show),
    openFile(file: VFile, forceNewPanel?: boolean) {
      if (!forceNewPanel) {
        if (store.activePanel?.file.filename === file.filename) return;
        const index = store.panels.findIndex(x => x.file.filename === file.filename)
        if (index >= 0) {
          updateStore('activePanelIndex', index)
          const dockApi = store.panels[index].dockApi
          dockApi?.setActive()
          return
        }
      }
      updateStore('panels', panels => [...panels, {
        id: uniqueId('panel'),
        file,
      }])
    }
  }

  return {
    store,
    updateStore,
    api,
    owner,
  }
}

const oneBox = createRoot(createOneBoxStore)

export const useOneBox = () => oneBox
