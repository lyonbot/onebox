import { createMemo, createSignal } from "solid-js"

const $signals = Symbol('signals')
const $memos = Symbol('memos')

export const signal = (target: any, key: string) => {
  if (!target[$signals]) target[$signals] = []
  target[$signals].push(key)
}

export const memo = (target: any, key: string) => {
  if (!target[$memos]) target[$memos] = []
  target[$memos].push(key)
}

export const forSolid = (target: any) => {
  const c = {
    [target.name]: class extends target {
      constructor(...args: any[]) {
        super(...args)

        const proto = target.prototype

        proto[$signals]?.forEach((key: string) => {
          const [get, set] = createSignal(this[key])
          Object.defineProperty(this, key, { get, set, })
        })

        proto[$memos]?.forEach((key: string) => {
          const desc = Object.getOwnPropertyDescriptor(proto, key)!
          const read = createMemo(desc.get!.bind(this))
          Object.defineProperty(this, key, { ...desc, get: read, })
        })
      }
    }
  }

  return c[target.name] as any
}
