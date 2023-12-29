import { JSXElement, createSignal } from "solid-js";
import { nextTick, watch } from "~/utils/solid";

export interface PromptRequest {
  title: JSXElement | (() => JSXElement)
  default?: string
  onMount?: (env: { inputBox: HTMLInputElement }) => void
}

export function PromptBox(props: { req: PromptRequest, onResolve: (value: string | null) => void }) {
  const [value, setValue] = createSignal<string>('')
  watch(() => props.req, req => {
    setValue(req.default || '');
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
            if (ev.key === 'Enter') {
              props.onResolve(value())
            } else if (ev.key === 'Escape') {
              props.onResolve(null)
            }
          }}
        />

      </div>
    </div>
  )
}