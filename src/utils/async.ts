import { Fn } from "yon-utils";

/**
 * Wraps an asynchronous function and ensures that only one instance of the function is running at a time.

 * If the function is called while it is already running, the arguments are queued and the function is called again when the previous call finishes.
 * In the queue, only the last set of arguments is used.
 *
 * @param fn The asynchronous function to be wrapped.
 * @returns The wrapped function.
 */
export function queuedAsync<T extends Fn>(fn: T) {
  let nextArgs: any[] | undefined
  let running: Promise<any> | undefined

  const queue = function (...args: any[]) {
    if (!running) {
      running = Promise.resolve()
        .then(() => fn(...args))
        .finally(() => {
          running = undefined
          if (nextArgs) { queue(...args); nextArgs = undefined }
        })
    } else {
      nextArgs = args
    }
  } as T & {
    cancel: () => void
    /** wait for current promise finished. not the queued one */
    waitCurrent: () => null | Promise<ReturnType<T>>
  }

  queue.cancel = () => { nextArgs = undefined }
  queue.waitCurrent = () => running || null

  return queue
}
