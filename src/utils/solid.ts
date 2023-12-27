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
  parse: (s: string | null) => T = x => x as any,
  stringify: (t: T) => string = x => String(x)
) {
  const s = localStorage.getItem(key)
  const [value, setValue] = createSignal<T>(parse(s))
  const update = debounce(() => localStorage.setItem(key, stringify(value())), 1000)

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
