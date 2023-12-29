import * as monaco from "monaco-editor";
import { Accessor } from "solid-js";
import { Nil, isThenable } from "yon-utils";

export function runAndKeepCursor<T>(editor: Accessor<monaco.editor.IStandaloneCodeEditor | Nil>, run: () => T) {
  const editor1 = editor();
  if (!editor1) return run()

  const recover = () => void setTimeout(() => {
    const editor2 = editor()
    if (!editor2) return

    editor2.focus()
    editor2.setSelections(cursor as any)
    editor2.setScrollPosition(scrollPos, monaco.editor.ScrollType.Immediate)
  }, 100)

  const cursor = editor1.getSelections()?.map(x => x.toJSON())
  const scrollPos: monaco.editor.INewScrollPosition = {
    scrollLeft: editor1.getScrollLeft(),
    scrollTop: editor1.getScrollTop(),
  }

  try {
    const result = run();
    if (isThenable(result)) return (result as any).finally(recover) as T

    recover()
    return result
  } catch (err) {
    recover()
    throw err
  }
}