import * as monaco from 'monaco-editor'
import { batch, createMemo, mapArray, onCleanup, untrack } from "solid-js"
import { SetStoreFunction, createStore } from "solid-js/store"
import { Lang, LangDescriptions } from "~/utils/langsBase"
import { fromPairs } from "lodash"
import { watch } from '~/utils/solid'
import { OneBox } from '.'

export type FilesStore = ReturnType<typeof createFilesStore>

export interface VTextFile {
  filename: string
  content: string
  lang: Lang
}

export interface VTextFileController {
  file: VTextFile

  readonly filename: string
  readonly content: string
  readonly lang: Lang
  readonly model: monaco.editor.ITextModel

  setFilename(filename: string): string
  setContent(content: string): void
  setLang(lang: Lang): void

  delete(): void
}

export function createFilesStore(root: () => OneBox) {
  const [state, update] = createStore({
    files: [] as VTextFile[],
  })

  const fileControllers = mapArray(
    () => state.files,
    (file, index): VTextFileController => {
      const updateFile: SetStoreFunction<VTextFile> = (...args: any[]) => update('files', index(), ...args as [any])

      const model = createMemo(() => {
        const uri = monaco.Uri.parse(`file:///${file.filename}`)
        const model = untrack(() => {
          const existed = monaco.editor.getModel(uri)
          if (!existed) return monaco.editor.createModel(file.content, 'plaintext', uri)

          existed.setValue(file.content)
          return existed
        })

        watch(() => LangDescriptions[file.lang]?.monacoLanguage || 'plaintext', lang => monaco.editor.setModelLanguage(model, lang))
        watch(() => file.content, content => model.getValue() !== content && model.setValue(content), true)
        model.onDidChangeContent(() => updateFile('content', model.getValue()))

        onCleanup(() => {
          model.dispose()
        })

        return model
      })

      return {
        file,

        get content() { return file.content },
        setContent(value: string) { updateFile('content', value) },

        get lang() { return file.lang },
        setLang(value: Lang) { updateFile('lang', value) },

        get filename() { return file.filename },
        setFilename(value: string) {
          value = value.trim()
          if (!value || value === file.filename) return file.filename

          batch(() => {
            const newName = nonConflictFilename(value)
            root().panels.update('panels', p => p.filename === this.filename, 'filename', newName)
            updateFile('filename', newName)
          })

          return this.filename
        },

        get model() { return model() },

        delete() {
          update('files', files => files.filter(f => f.filename !== file.filename))
        },
      }
    }
  )

  const filesLUT = createMemo(() => fromPairs(fileControllers().map(f => [f.filename, f])))

  const nonConflictFilename = (filename: string) => {
    while (filesLUT()[filename!]) {
      filename = filename!.replace(/(\d*)\./, (_, n) => `${(+n || 0) + 1}.`)
    }
    return filename
  }

  const api = {
    getControllerOf(filename?: string) {
      if (!filename) return undefined
      return filesLUT()[filename]
    },

    nonConflictFilename,
    createFile(content?: string, filename?: string) {
      filename = nonConflictFilename('untitled.txt')

      const f: VTextFile = {
        filename,
        content: content || '',
        lang: Lang.UNKNOWN,
      }
      update('files', files => [...files, f])
      return filesLUT()[f.filename]
    }
  }

  return {
    state,
    update,
    controllers: filesLUT,
    api,
  }
}
