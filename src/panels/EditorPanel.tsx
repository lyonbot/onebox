import * as monaco from 'monaco-editor';
import MonacoEditor from "../components/MonacoEditor";
import { useOneBox } from "../store";
import { Show, batch, createEffect, createMemo, createSignal, onCleanup, } from "solid-js";
import { watch } from "~/utils/solid";
import { Lang, LangDescriptions } from "~/utils/lang";
import { guessLangFromContent } from "~/utils/langUtils";
import { entries, map } from "lodash";
import { AdaptedPanelProps } from './adaptor';

export default function EditorPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = oneBox.files.api.getControllerOf(props.params.filename)!; // assuming not change
  const panelId = props.id

  let editor!: monaco.editor.IStandaloneCodeEditor
  const isActive = createMemo(() => props.id === oneBox.panels.state.activePanelId)
  const [hasFocus, setHasFocus] = createSignal(false)

  const rename = () => {
    const newName = prompt('Rename File', file.filename);
    if (newName) file.setFilename(newName);
  };

  const removePanel = () => {
    oneBox.panels.api.closePanel(panelId)
  }

  // #region Tabs
  setTimeout(() => {
    const tabEl = (props.api as any).panel.view.tab.element as HTMLElement;
    if (tabEl.dataset.obCrafted) return
    tabEl.dataset.obCrafted = "true"

    const handleMouseDown = (ev: MouseEvent) => {
      if (ev.button === 1) {
        ev.preventDefault()
        removePanel()
      }
    }

    tabEl.addEventListener('mousedown', handleMouseDown)
    tabEl.addEventListener('dblclick', rename)
    tabEl.addEventListener('mouseenter', oneBox.ui.api.getActionHintEvForMouse([
      <div class='ob-status-actionHint'>
        <kbd><i class='i-ob-mouse-mid' /></kbd>
        Close
      </div>,

      <div class='ob-status-actionHint'>
        <kbd><i class='i-ob-mouse-left' />x2</kbd>
        Rename
      </div>,

      <div class='ob-status-actionHint'>
        <kbd>Shift+<i class='i-ob-mouse-left' /></kbd>
        Float
      </div>,
    ]))
  })
  createEffect(() => props.api.setTitle(file.filename))
  // #endregion

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

    const cursor = editor.getSelections()?.map(x => x.toJSON())
    const scrollPos: monaco.editor.INewScrollPosition = {
      scrollLeft: editor.getScrollLeft(),
      scrollTop: editor.getScrollTop(),
    }

    batch(() => {
      file.setFilename(file.filename.replace(/(\.\w+)?$/, ext));
      file.setLang(lang);
    })

    setTimeout(() => {
      editor.focus()
      editor.setSelections(cursor as any)
      editor.setScrollPosition(scrollPos, monaco.editor.ScrollType.Immediate)
    }, 100)
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
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB]
            })

            editor.addAction({
              id: 'oneBox.renameFile',
              label: 'Rename File',
              run: rename,
              keybindings: [monaco.KeyCode.F2]
            })

            editor.addAction({
              id: 'oneBox.createFile',
              label: 'New File',
              run: () => void oneBox.api.createEmptyFile(),
              keybindings: []
            })

            editor.addAction({
              id: 'oneBox.close',
              label: 'Close Panel',
              run: () => void removePanel(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, monaco.KeyMod.CtrlCmd | monaco.KeyCode.F4]
            })

            editor.addAction({
              id: 'oneBox.applyLangGuess',
              label: 'Language Guess: Apply',
              run: () => void applyLangGuess(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK]
            })

            editor.addAction({
              id: 'oneBox.run',
              label: 'OneBox: Run',
              run: () => { alert('bo') },
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter]
            })
          }

          // dockview interaction fix
          {
            watch(isActive, isActive => {
              if (isActive) setTimeout(() => editor.focus())
            })

            watch(() => oneBox.panels.state.isDraggingPanel, isDraggingPanel => {
              editor.updateOptions({
                dropIntoEditor: {
                  enabled: !isDraggingPanel,
                }
              })
            })
          }
        }}
      />
    </div>
  )
}
