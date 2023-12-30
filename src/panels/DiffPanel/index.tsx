/* eslint-disable @typescript-eslint/no-unused-vars */
import { Show, batch, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "../adaptor"
import { VTextFileController } from "~/store/files"
import * as monaco from "monaco-editor"
import { getSearchMatcher, modKey } from "yon-utils"

declare module "~/plugins" {
  export interface OneBoxPanelData {
    diff?: {
      filename2: string
    }
  }
}

export default function DiffPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file1 = createMemo(() => oneBox.api.getFile(props.params.filename))
  const file2 = createMemo(() => oneBox.api.getFile(props.params.diff?.filename2))
  const panelId = props.id

  const [editor, setEditor] = createSignal<monaco.editor.IStandaloneDiffEditor | null>(null)

  const selectFile = async (def: string | undefined) => {
    const allList = oneBox.files.state.files.filter(f => !f.contentBinary).map(f => f.filename)
    const otherFile = await oneBox.prompt('Choose a File', {
      default: def,
      enumOptions: (keyword) => getSearchMatcher(keyword).filter(allList).map(x => ({ value: x, label: x })),
    })

    return otherFile || ''
  }

  const goPrev = () => editor()?.goToDiff('previous')
  const goNext = () => editor()?.goToDiff('next')
  const doSwap = () => batch(
    () => {
      const name1 = file1()!.filename
      const name2 = file2()!.filename

      oneBox.panels.api.updatePanel(panelId)('filename', name2)
      oneBox.panels.api.updatePanel(panelId)('diff', 'filename2', name1)
    }
  )

  return <div class="h-full flex flex-col">
    <div
      class="ob-toolbar"
      tabIndex={0}
      onFocusIn={oneBox.ui.api.getActionHintEvFor(<>
        <div class='ob-status-actionHint'> <kbd>/</kbd> Next </div>
        <div class='ob-status-actionHint'> <kbd>?</kbd> Prev </div>
        <div class='ob-status-actionHint'> <kbd>Cmd+D</kbd> Swap </div>
      </>, 'focusout', false)}
      onKeyDown={ev => {
        if (ev.key === '/') {
          goNext()
          ev.preventDefault()
        } else if (ev.key === '?') {
          goPrev()
          ev.preventDefault()
        } else if (modKey(ev) === modKey.Mod && ev.key === 'd') {
          doSwap()
          ev.preventDefault()
        }
      }}
    >
      <div class="flex-1 text-center">
        <button
          onClick={() => selectFile(file1()?.filename).then(name => name && oneBox.panels.api.updatePanel(panelId)('filename', name))}
        >{props.params.filename}</button>
      </div>

      <button title="Swap Files" onClick={doSwap}>
        <i class="i-mdi-swap-horizontal"></i>
      </button>
      <button title="Previous Change" onClick={goPrev}>
        <i class="i-mdi-arrow-up-bold"></i>
      </button>
      <button title="Next Change" onClick={goNext}>
        <i class="i-mdi-arrow-down-bold"></i>
      </button>

      <div class="flex-1 text-center">
        <button
          onClick={() => selectFile(file2()?.filename).then(name => name && oneBox.panels.api.updatePanel(panelId)('diff', 'filename2', name))}
        >{props.params.diff?.filename2}</button>
      </div>
    </div>

    <div class="flex-1 relative">
      <Show when={file1() && file2()}>
        <DiffMonaco file={file1()!} file2={file2()!} ref={setEditor} />
      </Show>
    </div>
  </div>
}

function DiffMonaco(props: {
  file: VTextFileController,
  file2: VTextFileController,
  ref: (editor: monaco.editor.IStandaloneDiffEditor | null) => void
}) {
  return <div
    class="h-full"
    ref={element => {
      const editor = monaco.editor.createDiffEditor(element, {
        originalEditable: true, // for left side
        readOnly: false, // for right side
        automaticLayout: true,
      })

      createEffect(() => editor.setModel({
        original: props.file.model,
        modified: props.file2.model,
      }))

      props.ref(editor)
      onCleanup(() => {
        editor.dispose()
        props.ref(null)
      })
    }}
  />
}
