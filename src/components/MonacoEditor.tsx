import { JSX } from 'solid-js/jsx-runtime';
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import * as monaco from 'monaco-editor';

export interface MonacoEditorProps {
  value?: string
  language?: string
  model?: monaco.editor.ITextModel

  options?: monaco.editor.IEditorOptions

  onSetup?(editor: monaco.editor.IStandaloneCodeEditor): void
  onChange?(value: string, e: monaco.editor.IModelContentChangedEvent): void

  class?: string
  style?: string | JSX.CSSProperties
}

export default function MonacoEditor(props: MonacoEditorProps) {
  let wrapperDiv!: HTMLDivElement
  const [model, setModel] = createSignal(null as unknown as monaco.editor.ITextModel)

  onMount(() => {
    const editor = monaco.editor.create(wrapperDiv, {
      language: props.language,
      value: props.value,
      model: props.model,
      automaticLayout: true,
      fixedOverflowWidgets: true,
      ...props.options,
    });

    setModel(editor.getModel()!)
    editor.onDidChangeModel(() => { setModel(editor.getModel()!) })

    editor.onDidChangeModelContent(e => {
      props.onChange?.(model().getValue(), e)
    })

    createEffect(() => {
      const value = props.value;
      if (typeof value === 'string' && value !== model().getValue()) {
        model().setValue(value)
      }
    })

    createEffect(() => {
      if (props.language) {
        monaco.editor.setModelLanguage(model(), props.language)
      }
    })

    createEffect(() => {
      if (props.model) {
        editor.setModel(props.model)
      }
    })

    props.onSetup?.(editor)

    onCleanup(() => {
      editor.dispose()
    })
  })

  return <div
    class={"relative " + (props.class || '')}
    style={props.style}
  >
    <div
      class="inset-0 absolute"
      ref={div => { wrapperDiv = div }}
    />
  </div>
}
