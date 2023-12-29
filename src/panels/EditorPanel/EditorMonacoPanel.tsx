import * as monaco from 'monaco-editor';
import MonacoEditor from "~/components/MonacoEditor";
import { useOneBox } from "~/store";
import { Show, createMemo, createSignal, onCleanup } from "solid-js";
import { nextTick, watch } from "~/utils/solid";
import { Lang, LangDescriptions } from "~/utils/lang";
import { guessLangFromContent } from "~/utils/langUtils";
import { entries, map } from "lodash";
import { runAndKeepCursor } from '~/monaco/utils';
import { VTextFileController } from '~/store/files';

export default function EditorMonacoPanel(props: { file: VTextFileController, panelId: string }) {
  const oneBox = useOneBox()
  const { file, panelId } = props; // assuming not change

  let editor: monaco.editor.IStandaloneCodeEditor | undefined
  const isActive = createMemo(() => panelId === oneBox.panels.state.activePanelId)
  const [hasFocus, setHasFocus] = createSignal(false)
  watch(hasFocus, hasFocus => {
    oneBox.panels.update('activeMonacoEditor', prev => {
      if (hasFocus) return editor
      if (prev === editor) return undefined
      return prev
    })
  })

  const rename = () => {
    runAndKeepCursor(() => editor, async () => {
      await oneBox.api.interactiveRenameFile(file.filename)
    })
  };

  const removePanel = () => {
    oneBox.panels.api.closePanel(panelId)
  }

  // #region Lang
  const guessedLang = createMemo(() => {
    if (file.lang !== Lang.UNKNOWN) return file.lang;
    return guessLangFromContent(file.content)
  })

  const applyLangGuess = () => {
    setLangKeepCursor(file.lang === Lang.UNKNOWN ? guessedLang() : Lang.UNKNOWN)
  }

  const setLangKeepCursor = (lang: Lang) => {
    runAndKeepCursor(() => editor, () => file.setLang(lang, true));
  }

  watch(hasFocus, f => f && onCleanup(oneBox.ui.api.addActionHint(<>
    <div class='ob-status-actionHint'>
      <kbd>Cmd+Enter</kbd>
      Summon a Processor
    </div>

    <Show when={file.lang === Lang.UNKNOWN && guessedLang() !== Lang.UNKNOWN}>
      <div class='ob-status-actionHint'>
        <kbd>Cmd+K</kbd>
        Switch to <span class='text-green-2'>{LangDescriptions[guessedLang()]!.name}</span>
      </div>
    </Show>
  </>)))

  // #endregion

  return (
    <div class="flex flex-col h-full">
      <div class="ob-panel-toolbar">
        <select class="border-none" value={file.lang} onChange={e => setLangKeepCursor(e.currentTarget.value as Lang)}>
          {map(entries(LangDescriptions), ([lang, desc], index) => <option value={lang}>{index}. {desc.name}</option>)}
        </select>

        <Show when={guessedLang() !== file.lang}>
          <a href="#" onClick={e => (e.preventDefault(), setLangKeepCursor(guessedLang()))}>
            <i class='i-mdi-thought-bubble' />
            {LangDescriptions[guessedLang()].name}?
          </a>
        </Show>
      </div>

      <MonacoEditor
        class="flex-1 border border-gray-300"
        model={file.model}
        options={{
          minimap: {},
          lineNumbersMinChars: 2,
          padding: { top: 4, bottom: 0 },
        }}
        onSetup={e => {
          editor = e

          // hasFocus
          editor.onDidFocusEditorText(() => setHasFocus(true))
          editor.onDidBlurEditorText(() => setHasFocus(false))

          // add keybindings
          {
            // add shortcut key Ctrl+B to run `toggleSidebar` command
            editor.addAction({
              id: 'oneBox.toggleSidebar',
              label: 'Toggle Sidebar',
              run: () => oneBox.ui.api.toggleSidebar(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
            })

            editor.addAction({
              id: 'oneBox.renameFile',
              label: 'Rename File',
              run: rename,
              keybindings: [monaco.KeyCode.F2],
            })

            editor.addAction({
              id: 'oneBox.createFile',
              label: 'New File',
              run: () => void oneBox.api.createEmptyFile(),
              keybindings: [],
            })

            editor.addAction({
              id: 'oneBox.close',
              label: 'Close Panel',
              run: () => void removePanel(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, monaco.KeyMod.CtrlCmd | monaco.KeyCode.F4],
            })

            editor.addAction({
              id: 'oneBox.applyLangGuess',
              label: 'Language Guess: Apply',
              run: () => void applyLangGuess(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
            })

            editor.addAction({
              id: 'oneBox.downloadCurrentFile',
              label: 'OneBox: Download Current File',
              run: () => void oneBox.api.downloadCurrentFile(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            })

            editor.addAction({
              id: 'oneBox.downloadCurrentProject',
              label: 'OneBox: Download Project (All Files)',
              run: () => void oneBox.api.downloadCurrentProject(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
            })

            editor.addAction({
              id: 'oneBox.run',
              label: 'OneBox: Run',
              run: () => void oneBox.api.interactiveSummonAction(file.filename),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            })
          }

          // dockview interaction fix
          {
            watch(isActive, isActive => {
              if (isActive) nextTick(() => editor?.focus())
            })

            watch(() => oneBox.panels.state.isDraggingPanel, isDraggingPanel => {
              editor?.updateOptions({
                dropIntoEditor: {
                  enabled: !isDraggingPanel,
                },
              })
            })
          }
        }}
      />
    </div>
  )
}
