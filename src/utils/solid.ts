import localForage from "localforage";
import { debounce } from "lodash";
import { createEffect, on, createMemo, mapArray, createSignal } from "solid-js";

/**
 * behave like Vue's watch function, with `equals` checking
 */
export function watch<T>(
  expr: () => T,
  callback: (value: T, oldValue?: T) => void,
  defer?: boolean,
  equals?: (a: T, b: T) => boolean,
) {
  createEffect(on(createMemo(expr, undefined, { equals }), callback, { defer }));
}

export function useLocalStorage<T = string>(
  key: string,
  defaultValue: T
) {
  const [value, setValue] = createSignal(defaultValue)
  localForage.getItem<T>(key).then(v => v !== null && setValue(() => v))

  const update = debounce(() => localForage.setItem(key, value()), 1000)

  createEffect(on(value, update))
  return [value, setValue] as const
}


export function createLifecycleArray<T extends object>() {
  const [initializers, setInitializers] = createSignal<(() => T)[]>([]);
  const computed = mapArray(initializers, (initializer) => initializer());

  const push = (initializer: () => T) => {
    setInitializers((initializers) => [...initializers, initializer]);
    return computed().at(-1)!;
  }

  const remove = (...items: T[]) => {
    const newArray = initializers().slice()

    for (const item of items) {
      const index = computed().indexOf(item);
      if (index !== -1) newArray.splice(index, 1);
    }

    setInitializers(newArray);
  }

  const answer = computed as {
    (): T[]
    push: (initializer: () => T) => T,
    remove: (...items: T[]) => void,
    clear: () => void,
  }
  answer.push = push;
  answer.remove = remove;
  answer.clear = () => {
    setInitializers([])
    computed() // force computing
  };

  return answer
}

export function nextTick(callback?: () => void) {
  return new Promise(resolve => setTimeout(resolve, 0)).then(callback)
}
