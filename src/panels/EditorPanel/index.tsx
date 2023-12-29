import * as monaco from 'monaco-editor';
import MonacoEditor from "../../components/MonacoEditor";
import { useOneBox } from "../../store";
import { Show, batch, createMemo, createSignal, onCleanup } from "solid-js";
import { nextTick, watch } from "~/utils/solid";
import { Lang, LangDescriptions } from "~/utils/lang";
import { guessLangFromContent } from "~/utils/langUtils";
import { entries, map } from "lodash";
import { AdaptedPanelProps } from '../adaptor';
import { BinaryDisplay } from '~/components/BinaryDisplay';
import { runAndKeepCursor } from '~/monaco/utils';

export default function EditorPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = oneBox.files.api.getControllerOf(props.params.filename)!; // assuming not change
  const panelId = props.id

  let editor: monaco.editor.IStandaloneCodeEditor | undefined
  const isActive = createMemo(() => panelId === oneBox.panels.state.activePanelId)
  const [hasFocus, setHasFocus] = createSignal(false)

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
    setLang(file.lang === Lang.UNKNOWN ? guessedLang() : Lang.UNKNOWN)
  }

  const setLang = (lang: Lang) => {
    const description = LangDescriptions[lang];
    const ext = description.extname || '.txt';

    runAndKeepCursor(() => editor, () => {
      batch(() => {
        file.setFilename(file.filename.replace(/(\.\w+)?$/, ext));
        file.setLang(lang);
      })
    })
  }

  watch(hasFocus, f => f && onCleanup(oneBox.ui.api.addActionHint(<>
    <div class='ob-status-actionHint'>
      <kbd>Cmd+Enter</kbd>
      Summon a Processor
    </div>

    <Show when={file.lang === Lang.UNKNOWN && guessedLang() !== Lang.UNKNOWN}>
      <div class='ob-status-actionHint'>
        <kbd>Cmd+K</kbd>
        Apply Lang {LangDescriptions[guessedLang()]!.name}
      </div>
    </Show>
  </>)))

  // #endregion

  return (
    <div class="flex flex-col h-full">
      <div class="ob-panel-toolbar">
        <select class="border-none" value={file.lang} onChange={e => setLang(e.currentTarget.value as Lang)}>
          {map(entries(LangDescriptions), ([lang, desc], index) => <option value={lang}>{index}. {desc.name}</option>)}
        </select>

        <Show when={guessedLang() !== file.lang}>
          <a href="#" onClick={e => (e.preventDefault(), setLang(guessedLang()))}>
            <i class='i-mdi-thought-bubble' />
            {LangDescriptions[guessedLang()].name}?
          </a>
        </Show>
      </div>

      {file.contentBinary && <BinaryDisplay filename={file.filename} buffer={file.contentBinary} />}
      {!file.contentBinary && <MonacoEditor
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
              run: () => { alert('bo') },
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
      />}
    </div>
  )
}
