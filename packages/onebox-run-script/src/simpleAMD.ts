import { dirname, join } from "path"
import { Fn } from "yon-utils"

export type SimpleAMDLoadFunction = (absolutePath: string) => Promise<{
  runner(define: Fn): void
}>

export function simpleAMD(
  /**
   * @param absolutePath absolute path of the module. the extname `.js` is omitted
   */
  loader: SimpleAMDLoadFunction,
) {
  type Module = {
    exports: any
    loading: boolean
  }

  const mods = new Map<string, Module>()

  const fixName = (name: string) => name.replace(/\.js$/, '')
  const fetchModule = async (absolutePath: string) => {
    const path = fixName(absolutePath)
    if (mods.has(path)) {
      const mod = mods.get(path)!
      return mod
    }

    const baseDir = dirname(absolutePath)
    const require = (path: string) => {
      if (path === 'require') return require
      if (path === 'exports') return module.exports
      if (path === 'module') return module

      if (path.startsWith('.')) path = join(baseDir, path)
      path = fixName(path)
      if (mods.has(path)) return mods.get(path)!.exports

      throw new Error(`Module ${path} not found`)
    }

    const module: Module = { exports: {} as any, loading: true }
    mods.set(path, module)

    const loaded = await loader(absolutePath)
    return new Promise<Module>((resolve, reject) => {
      loaded.runner(async function define(deps: string[], factory: Fn) {
        try {
          // load dependencies
          const depMods = await Promise.all(deps.map(path => {
            if (path === 'require') return require
            if (path === 'exports') return module.exports
            if (path === 'module') return module
            return fetchModule(path).then(x => x.exports)
          }))
          // execute factory
          const exports2 = factory(...depMods)
          if (typeof exports2 !== 'undefined') module.exports = exports2
          // finish
          module.loading = false
          resolve(module)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  return {
    preDefineModule: (absolutePath: string, exports: any) => {
      const path = fixName(absolutePath)
      // if (mods.has(path)) throw new Error(`Module ${path} already defined`)
      mods.set(path, { exports, loading: false })
    },
    fetchModule,
    reset() {
      mods.clear()
    },
  }
}
