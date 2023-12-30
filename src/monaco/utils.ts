import * as monaco from "monaco-editor";
import { Accessor } from "solid-js";
import { Nil, isThenable } from "yon-utils";

export function getMonacoTokenAt(model: any, lineNumber: number, column: number) {
  if (typeof model.tokenization?.getLineTokens !== 'function') return null

  if (model.isTooLargeForTokenization()) return null
  const tokens = model.tokenization.getLineTokens(lineNumber)
  const tokenIndex = tokens.findTokenIndexAtOffset(column)

  const standardTokenType = tokens.getStandardTokenType(tokenIndex)
  const tokenStartOffset = tokens.getStartOffset(tokenIndex)
  const tokenEndOffset = tokens.getEndOffset(tokenIndex)

  return {
    tokens,
    tokenIndex,
    standardTokenType,
    tokenStartOffset,
    tokenEndOffset,

    isString: standardTokenType & 1,
    isComment: standardTokenType & 2,
  }
}

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
