import { dirname, extname, join, relative } from 'path'
import { Buffer } from "buffer";
import { Nil } from 'yon-utils'
import * as monaco from 'monaco-editor'
import { batch, createEffect, createMemo, createSignal, mapArray, onCleanup, untrack } from "solid-js"
import { SetStoreFunction, createStore } from "solid-js/store"
import { Lang, LangDescriptions } from "~/utils/lang"
import { fromPairs } from "lodash"
import { watch } from '~/utils/solid'
import { OneBox } from '.'
import { guessLangFromName } from '~/utils/langUtils'
import { OneBoxPluginDeclaration, installedPlugins } from '~/plugins';

export type FilesStore = ReturnType<typeof createFilesStore>

export interface VTextFile {
  filename: string
  content: string
  /** if presents, the `content` will be meaningless */
  contentBinary?: Buffer | false
  lang: Lang
}

export interface VTextFileDependency {
  plugin: OneBoxPluginDeclaration
  filename: string
}

export interface VTextFileController {
  readonly filename: string
  readonly content: string
  readonly contentBinary?: Buffer | false
  readonly lang: Lang

  readonly model: monaco.editor.ITextModel
  readonly objectURL: string

  readonly dependencies: VTextFileDependency[]
  readonly dependentBy: string[]

  setFilename(filename: string): string
  setContent(content: string): void
  setLang(lang: Lang, updateExtname?: boolean): void
  setContentBinary(content: Buffer | false): void
  notifyBinaryContentChanged(): void

  /**
   * get absolute path of another file
   *
   * note: the resolved path may not exists, use `files.api.completeFilename` to check and complete it
   */
  resolvePath(relativePath: string): string

  /** get relative path to another file, always starts with `./` or `../` */
  relativePath(absolutePath: string): string

  delete(): void
}

function createDependentRegistry() {
  const [dependents, setDependents] = createSignal(new Set<string>)
  return {
    add: (filename: string) => setDependents(set => set.has(filename) ? set : new Set(set).add(filename)),
    remove: (filename: string) => setDependents(set => set.delete(filename) ? new Set(set) : set),
    list: () => Array.from(dependents()),
  }
}

export function createFilesStore(root: () => OneBox) {
  const [state, update] = createStore({
    files: [] as VTextFile[],
  })

  const fileControllers = mapArray(
    () => state.files,
    (file, index) => {
      const updateFile: SetStoreFunction<VTextFile> = (...args: any[]) => update('files', index(), ...args as [any])

      // ---------------------------------------
      // monaco model

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

      // ---------------------------------------
      // dependencies

      const [dependenciesRaw, setDependenciesRaw] = createSignal<VTextFileDependency[]>([])
      const depsMemos = mapArray(installedPlugins, plugin => [
        plugin,
        plugin.getDependencies?.(controller),
      ] as const)
      createEffect(() => {
        const dependencies = depsMemos()
          .map(([plugin, get]) => (get?.() || []).map(item => ({ ...item, plugin })))
          .flat();
        return setDependenciesRaw(dependencies);
      })
      // TODO: add throttle to avoid too many updates

      const dependenciesFiltered = createMemo(() => {
        const currentFilename = file.filename
        return dependenciesRaw().filter(item => item.filename !== currentFilename && !!fileModelsLUT()[item.filename])
      })
      watch(() => dependenciesFiltered(), (deps, prevDeps) => {
        const prevNames = new Set(prevDeps?.map(x => x.filename))
        const currentFilename = file.filename
        batch(() => {
          new Set(deps.map(x => x.filename)).forEach(filename => {
            fileModelsLUT()[filename]?.dependents.add(currentFilename)
            prevNames.delete(filename)
          })

          prevNames.forEach(filename => {
            fileModelsLUT()[filename]?.dependents.remove(currentFilename)
          })
        })
      })

      const dependents = createDependentRegistry()

      // debug
      // watch(dependents.list, list => console.log('dependents', file.filename, list))

      // ---------------------------------------

      const currentDir = createMemo(() => dirname(file.filename))

      const controller: VTextFileController = {
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

            const dependentsControllers = dependents.list().map(x => fileModelsLUT()[x]?.controller).filter(Boolean) as VTextFileController[]
            installedPlugins().forEach(plugin => plugin.onDependencyChangeName && dependentsControllers.forEach(f => plugin.onDependencyChangeName!(f, oldName, newName)))

            // resort files
            update('files', sortFilesByName)
          })

          return this.filename
        },

        get model() { return model() },
        get objectURL() { return objectURL() },

        get dependencies() { return dependenciesRaw() },
        get dependentBy() { return dependents.list() },

        relativePath(absolutePath) {
          let ans = relative(currentDir(), absolutePath)
          if (!ans.startsWith('.')) ans = './' + ans
          return ans
        },
        resolvePath(relativePath) {
          const ans = join(currentDir(), relativePath)
          return ans
        },

        delete() {
          update('files', files => files.filter(f => f.filename !== file.filename))
        },
      }

      return { file, controller, dependents }
    }
  )


  const fileModelsLUT = createMemo(() => fromPairs(fileControllers().map(f => [f.file.filename, f])))

  const nonConflictFilename = (filename: string) => {
    while (fileModelsLUT()[filename!]) {
      filename = filename!.replace(/(\d*)\./, (_, n) => `${(+n || 0) + 1}.`)
    }
    return filename
  }

  const api = {
    getControllerOf(filename: string | Nil) {
      if (!filename) return undefined
      return fileModelsLUT()[filename]?.controller
    },

    nonConflictFilename,
    createFile(desc: Partial<VTextFile>) {
      const filename = nonConflictFilename(desc.filename || 'untitled.txt')
      const f: VTextFile = {
        content: '',
        ...desc,
        filename,
        lang: desc.lang || guessLangFromName(filename),
      }
      update('files', files => sortFilesByName([...files, f]))
      return fileModelsLUT()[filename].controller
    },

    /**
     * Completes the given filename by checking if it exists
     *
     * - If the filename exists, it is returned as is.
     * - If the filename does not exist, it tries to find a similar filename by matching the starting characters.
     * - If multiple similar filenames are found, it prioritizes the one with the `.js` extension.
     *
     * @param filename - The filename to be completed.
     * @returns The completed filename, or `undefined` if not found
     */
    completeFilename(filename: string | Nil) {
      if (!filename) return
      if (fileModelsLUT()[filename]) return filename

      // file not exist, maybe need .extname
      const candidates = Object.keys(fileModelsLUT())
        .filter(name => name.startsWith(filename))
        .sort((a, b) => a.length - b.length)

      const name = candidates.find(name => name.endsWith('.js')) || candidates[0]

      return name
    },
  }

  return {
    state,
    update,
    models: fileModelsLUT,
    api,
  }
}

/**
 * a funny sorting function. it will sort files by their directories,
 * but keep the order of files within the same directory.
 */
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
