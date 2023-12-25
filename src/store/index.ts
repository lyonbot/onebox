import { createStore } from 'solid-js/store'
import { VFile, VTextFile } from './file'
import { createRoot } from 'solid-js'
import { createLifecycleArray } from '~/utils/solid'

export interface UIPanel {
  file: VFile
}

function createOneBoxStore() {
  const files = createLifecycleArray<VFile>()

  const [store, updateStore] = createStore({
    panels: [] as UIPanel[],
    get files() { return files /* do not mutate this array with `updateStore` */ }
  })

  const api = {
    createTextFile(filename: string, content: string = '') {
      const file = files.push(() => new VTextFile(filename, content))
      updateStore('panels', panels => [...panels, { file }])
      return file
    },

    deleteFile: files.remove
  }

  return {
    store,
    updateStore,
    api,
  }
}

const oneBox = createRoot(createOneBoxStore)
export default oneBox
