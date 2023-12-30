import * as monaco from "monaco-editor";
import { dirname, join, relative } from "path";
import { OneBox } from "~/store";

const isScriptFile = (name: string) => /\.([jt]sx?)$/i.test(name)

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
      console.log('m1=', m1, ',textUntilPosition="' + textUntilPosition + '"')
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
        oneBox.api.openFile(filename)

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
}
