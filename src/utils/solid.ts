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

export function createLifecycleArray<T extends object>() {
  const [initializers, setInitializers] = createSignal<(() => T)[]>([]);
  const answer = mapArray(initializers, (initializer) => initializer());

  const push = (initializer: () => T) => {
    setInitializers((initializers) => [...initializers, initializer]);
    return answer().at(-1)!;
  }

  const remove = (...items: T[]) => {
    const newArray = initializers().slice()

    for (const item of items) {
      const index = answer().indexOf(item);
      if (index !== -1) newArray.splice(index, 1);
    }

    setInitializers(newArray);
  }

  const proxy = new Proxy([], {
    get(_, key) {
      if (key === "push") return push;
      if (key === "remove") return remove;

      return answer()[key as any];
    },
  }) as unknown as ReadonlyArray<T> & {
    push: (initializer: () => T) => T,
    remove: (...items: T[]) => void,
  };

  return proxy
}
