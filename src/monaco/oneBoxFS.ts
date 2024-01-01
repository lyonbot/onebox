import * as monaco from "monaco-editor";
import { dirname, join, relative } from "path";
import { OneBox } from "~/store";
import { getRangeInsideDelim } from "~/utils/string";

const isScriptFile = (name: string) => /\.([jt]sx?)$/i.test(name)
const getFileLinkRe = () => /[<[('"](\.\.?\/[^'")\]>?#]+)/g  // [0]=leading paren + filename, [1]=filename

/**
 * Providing OneBox file jumping and path auto-completion
 *
 * @param oneBox
 */
export function setupMonacoOneBoxFileIntegration(oneBox: OneBox) {
  const langs = ['markdown', 'plaintext', 'javascript', 'html', 'css', 'scss', 'typescriptreact'];
  monaco.languages.registerCompletionItemProvider(langs, {
    triggerCharacters: ['/'],
    provideCompletionItems(model, position) {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const m1 = textUntilPosition.lastIndexOf('./')
      const match = (m1 === 0 || /[\s'"=(<[]/.test(textUntilPosition[m1 - 1])) && /^[^\s'")>\]]*$/.test(textUntilPosition.slice(m1 + 2)) && textUntilPosition.slice(m1)
      if (!match) return;

      const currentFilePath = oneBox.api.getCurrentFilename()
      const currentFileDir = dirname(currentFilePath);
      let lead = join(currentFileDir, decodeURI(match))
      if (lead === './') lead = ''

      const currentIsScript = isScriptFile(currentFilePath)

      const files = [] as string[]
      for (const file of oneBox.files.state.files) {
        if (!file.filename.startsWith(lead)) continue

        let rp = relative(currentFileDir, file.filename)
        if (!rp.startsWith('.')) rp = './' + rp
        if (!rp.startsWith(match)) continue

        files.push(rp)
        if (files.length > 5) break
      }

      const toInsertText = (x: string) => {
        if (currentIsScript && isScriptFile(x)) x = x.replace(/\.\w+$/, '')
        return encodeURI(x);
      }

      return {
        suggestions: files.map((x) => ({
          range: monaco.Range.fromPositions(position),
          insertText: toInsertText(x),
          label: x.slice(match.lastIndexOf('/') + 1),
          kind: monaco.languages.CompletionItemKind.File,
          additionalTextEdits: [
            {
              range: monaco.Range.fromPositions(position.delta(0, -match.length), position),
              text: '',
            },
          ],
        })),
      };
    },
  });

  monaco.editor.registerEditorOpener({
    openCodeEditor(editor, url, selection) {
      const filename = url.path.slice(1) // remove leading /

      if (oneBox.api.getFile(filename)) {
        // exists
        const aside = !!(window as any).event?.shiftKey
        oneBox.api.openFile(filename, aside ? 'right' : false)

        if (selection) setTimeout(() => {
          const editor = oneBox.panels.state.activeMonacoEditor
          const range = 'startLineNumber' in selection ? selection : monaco.Range.fromPositions(selection)
          editor?.setSelection(range)
          editor?.revealLine(range.startLineNumber)
        }, 100)
        return true
      } else {
        // // create new file
        // oneBox.files.api.createFile({ filename })

        // No! maybe open a dom.d.ts
        return false
      }
    },
  })

  monaco.languages.registerLinkProvider(langs, {
    provideLinks(model) {
      const links = [] as monaco.languages.ILinksList['links']

      const file = oneBox.api.getFile(model.uri.path.slice(1))
      if (!file) return { links }

      const text = model.getValue()
      const re = getFileLinkRe()
      for (const match of text.matchAll(re)) {
        const rel = match[1]
        const filename = file.resolvePath(decodeURI(rel))
        const to = oneBox.api.getFile(filename)
        if (!to) continue

        const startPos = model.getPositionAt(match.index! + 1); // skip the first char
        const endPos = startPos.delta(0, match[1].length);

        links.push({
          range: monaco.Range.fromPositions(startPos, endPos),
          url: `file:///${filename}`,
          tooltip: filename,
        })
      }

      return { links }
    },
  })

  monaco.languages.registerRenameProvider(langs, {
    resolveRenameLocation(model, position) {
      const detected = findFilenameRangeFromPosition(model, position);
      if (!detected) return null as any

      return {
        range: detected.range,
        text: detected.filename,
      }
    },
    provideRenameEdits(model, position, newFilename) {
      const detected = findFilenameRangeFromPosition(model, position);
      if (!detected) return { edits: [] }

      const toRenameFile = oneBox.api.getFile(detected.filename)!
      toRenameFile.setFilename(newFilename)

      // note: more edits will be provided by plugins
      return { edits: [] }
    },
  })

  function findFilenameRangeFromPosition(model: monaco.editor.ITextModel, position: monaco.Position) {
    const bigDelim = /['"()[\]<>\s?#]/
    const lineText = model.getLineContent(position.lineNumber);

    // find the filename part, which is surrounded by delim
    // NOTE: in monaco-editor, this could be kinda longer than `newName`.
    //   e.g. `./foo/aaa` -> `./foo/bbb` , the `newName` could be merely `bbb`
    const { start: startPos, end: endPos } = getRangeInsideDelim(lineText, position.column, bigDelim);
    const oldSourceCodePart = lineText.slice(startPos, endPos);
    if (!oldSourceCodePart.startsWith('.')) return

    // look for the old file name (in js/tsx, the suffix may be omitted)
    const modelFile = oneBox.api.getFile(model.uri.path.slice(1));
    if (!modelFile) return

    const oldFilenameMaybe = modelFile.resolvePath(decodeURI(oldSourceCodePart)); // note: might missing .extname
    const oldFilename = oneBox.files.api.completeFilename(oldFilenameMaybe);
    if (!oldFilename) return // file not found

    const range = new monaco.Range(
      position.lineNumber, startPos,
      position.lineNumber, endPos
    );
    return { range, filename: oldFilename };
  }
}
