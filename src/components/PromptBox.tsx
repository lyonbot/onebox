import { Accessor, For, JSXElement, Show, createEffect, createMemo, createSignal } from "solid-js";
import { nextTick, watch } from "~/utils/solid";

export interface PromptRequest {
  title: JSXElement | (() => JSXElement)
  default?: string
  enumOptions?: (input: Accessor<string>) => Array<{ value: string, title?: JSXElement | (() => JSXElement) }>
  onMount?: (env: { inputBox: HTMLInputElement }) => void
}

export function PromptBox(props: { req: PromptRequest, onResolve: (value: string | null) => void }) {
  const [value, setValue] = createSignal<string>('')

  const enumOptions = createMemo(() => props.req.enumOptions?.(value))
  const [enumIndex, setEnumIndex] = createSignal(0)

  watch(() => props.req, req => {
    setValue(req.default || '');
    setEnumIndex(0);
  })

  createEffect(() => {
    const max = Math.max((enumOptions()?.length || 0) - 1, 0)
    if (enumIndex() < 0) setEnumIndex(0)
    else if (enumIndex() > max) setEnumIndex(max)
  })

  const [inputBox, setInputBox] = createSignal<HTMLInputElement | null>(null)
  watch(inputBox, async inputBox => {
    if (!inputBox) return

    await nextTick()
    inputBox.select()
    props.req.onMount?.({ inputBox })
  })

  return (
    <div class="ob-fullScreenMask" tabIndex={0} onClick={ev => {
      if (ev.target === ev.currentTarget) props.onResolve(null)
    }}>
      <div class="ob-promptBox">
        <div class="ob-promptBox-title">
          {props.req.title as JSXElement}
        </div>

        <input
          class="ob-promptBox-input"
          type="text"
          value={value()}
          ref={setInputBox}
          onInput={ev => setValue(ev.currentTarget.value)}
          onKeyDown={ev => {
            const enums = enumOptions()
            if (enums) {
              // Arrow Up + Down
              if (ev.key === 'ArrowUp') setEnumIndex(v => v > 0 ? v - 1 : enumOptions()!.length - 1);
              else if (ev.key === 'ArrowDown') setEnumIndex(v => v < enumOptions()!.length - 1 ? v + 1 : 0);
              else if (ev.key === 'Home') setEnumIndex(0);
              else if (ev.key === 'End') setEnumIndex(enumOptions()!.length - 1);
              else return

              ev.preventDefault()
            }
          }}
          onKeyUp={ev => {
            const enums = enumOptions()
            if (ev.key === 'Enter') {
              if (enums) {
                const item = enums[enumIndex()]
                if (item) props.onResolve(item.value)
              } else {
                props.onResolve(value())
              }
            } else if (ev.key === 'Escape') {
              props.onResolve(null)
            }
          }}
        />

        <Show when={enumOptions()}>
          <div class="ob-promptBox-enum">
            <For each={enumOptions()!} >
              {((item, index) => (
                <div
                  classList={{
                    'ob-promptBox-enum-item': true,
                    'isActive': index() === enumIndex(),
                  }}
                  onClick={() => props.onResolve(item.value)}
                >
                  {item.title as any || item.value}
                </div>
              ))}
            </For>
          </div>
        </Show>

      </div>
    </div>
  )
}
