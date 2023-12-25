import { useOneBoxStore } from "~/store"

let ignoring: Set<string | symbol>

setTimeout(() => {
  ignoring = new Set(Reflect.ownKeys(globalThis))

  const [store, setStore] = useOneBoxStore()
  const refreshKeys = () => {
    const keys = Reflect.ownKeys(globalThis).filter(key => typeof key === 'string' && !ignoring.has(key)) as string[]
    console.log('globalThisKeys', keys)
    if (keys.length !== store.globalThisKeys.length) {
      setStore('globalThisKeys', keys)
    }
  }

  document.addEventListener('visibilitychange', refreshKeys)
  window.addEventListener('focus', refreshKeys)
  refreshKeys()
})
