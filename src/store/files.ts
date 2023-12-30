import { extname } from 'path'
import { Buffer } from "buffer";
import { Nil } from 'yon-utils'
import * as monaco from 'monaco-editor'
import { batch, createMemo, mapArray, onCleanup, untrack } from "solid-js"
import { SetStoreFunction, createStore } from "solid-js/store"
import { Lang, LangDescriptions } from "~/utils/lang"
import { fromPairs } from "lodash"
import { watch } from '~/utils/solid'
import { OneBox } from '.'
import { guessLangFromName } from '~/utils/langUtils'

export type FilesStore = ReturnType<typeof createFilesStore>

export interface VTextFile {
  filename: string
  content: string
  /** if presents, the `content` will be meaningless */
  contentBinary?: Buffer | false
  lang: Lang
}

export interface VTextFileController {
  readonly filename: string
  readonly content: string
  readonly contentBinary?: Buffer | false
  readonly lang: Lang

  readonly model: monaco.editor.ITextModel
  readonly objectURL: string

  setFilename(filename: string): string
  setContent(content: string): void
  setLang(lang: Lang, updateExtname?: boolean): void
  setContentBinary(content: Buffer | false): void
  notifyBinaryContentChanged(): void

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

      const objectURL = createMemo(() => {
        const blob = new Blob([file.contentBinary || file.content], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)

        onCleanup(() => URL.revokeObjectURL(url))
        return url
      })

      return {
        get content() { return file.content },
        setContent(value: string) {
          this.model.pushEditOperations([], [{ range: this.model.getFullModelRange(), text: value }], null as any)
          updateFile('content', value)
        },

        get contentBinary() { return file.contentBinary },
        setContentBinary(value: Buffer | false) { updateFile('contentBinary', value) },
        notifyBinaryContentChanged() { updateFile('contentBinary', (b) => (b as Buffer).subarray()) }, // make a different wrapper to same memory

        get lang() { return file.lang },
        setLang(lang, updateExtname) {
          updateFile('lang', lang)

          if (updateExtname) {
            const description = LangDescriptions[lang];
            const ext = description.extname || '.txt';
            this.setFilename(this.filename.replace(/(\.\w+)?$/, ext))
          }
        },

        get filename() { return file.filename },
        setFilename(value: string) {
          value = value.trim()
          if (!value || value === file.filename) return file.filename

          batch(() => {
            const oldName = file.filename
            const newName = nonConflictFilename(value)
            root().panels.update('panels', p => p.filename === this.filename, 'filename', newName)
            updateFile('filename', newName)
            if (extname(oldName) !== extname(newName)) {
              updateFile('lang', guessLangFromName(newName, file.lang))
            }

            // resort files
            update('files', sortFilesByName)
          })

          return this.filename
        },

        get model() { return model() },
        get objectURL() { return objectURL() },

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
    getControllerOf(filename: string | Nil) {
      if (!filename) return undefined
      return filesLUT()[filename]
    },

    nonConflictFilename,
    createFile(desc: Partial<VTextFile>) {
      const filename = nonConflictFilename(desc.filename || 'untitled.txt')
      const f: VTextFile = {
        content: '',
        lang: Lang.UNKNOWN,
        ...desc,
        filename,
      }
      update('files', files => sortFilesByName([...files, f]))
      return filesLUT()[filename]
    },
  }

  return {
    state,
    update,
    controllers: filesLUT,
    api,
  }
}

function sortFilesByName(array: VTextFile[]) {
  let needResort = false
  const oldFilenameList = array.map(x => x.filename)
  const newFilenameMapping = oldFilenameList
    .map((x, i) => x.replace(/[^/]+$/, `!!${i.toString().padStart(10, '0')}`))
    .sort()
    .map((x, i) => {
      const newIndex = parseInt(x.slice(-10), 10)
      if (newIndex !== i) needResort = true
      return newIndex
    })

  if (!needResort) return array
  return newFilenameMapping.map(i => array[i])
}
