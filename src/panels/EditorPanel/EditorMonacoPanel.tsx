/* @refresh granular */

import * as monaco from 'monaco-editor';
import MonacoEditor from "~/components/MonacoEditor";
import { useOneBox } from "~/store";
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import { nextTick, watch } from "~/utils/solid";
import { Lang, LangDescriptions } from "~/utils/lang";
import { guessLangFromContent } from "~/utils/langUtils";
import { entries, map } from "lodash";
import { runAndKeepCursor } from '~/monaco/utils';
import { VTextFileController } from '~/store/files';
import { getSearchMatcher } from 'yon-utils';
import { installedPlugins } from '~/plugins';

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
  onCleanup(() => oneBox.panels.update('activeMonacoEditor', prev => (prev === editor) ? undefined : prev))

  const rename = () => {
    oneBox.api.interactiveRenameFile(file.filename)
  };

  const removePanel = () => {
    oneBox.panels.api.closePanel(panelId)
  }

  // #region Lang
  const guessedLang = createMemo(() => {
    if (file.lang !== Lang.UNKNOWN) return file.lang;
    return guessLangFromContent(file.content)
  })

  const setToUnknownOrAskLang = () => {
    if (file.lang === Lang.UNKNOWN) askAndSetLang()
    else setLangKeepCursor(Lang.UNKNOWN)
  }

  const setLangKeepCursor = (lang: Lang) => {
    runAndKeepCursor(() => editor, () => file.setLang(lang));
  }

  watch(hasFocus, f => f && onCleanup(oneBox.ui.api.addActionHint(<>
    <div class='ob-status-actionHint'>
      <kbd>Cmd+Enter</kbd>
      Summon an Action
    </div>

    <Show when={file.lang === Lang.UNKNOWN && guessedLang() !== Lang.UNKNOWN}>
      <div class='ob-status-actionHint'>
        <kbd>Cmd+K</kbd>
        Switch to <span class='text-green-2'>{LangDescriptions[guessedLang()]!.name}</span>
      </div>
    </Show>
  </>)))

  const askAndSetLang = () => {
    const options = map(entries(LangDescriptions), ([lang, desc], index) => ({ label: `${index}. ${desc.name}` as any, value: lang }))

    const gl = guessedLang()
    if (gl !== file.lang) options.unshift({ label: () => <span class='text-green-7'> <i class="i-mdi-thought-bubble"></i> Guess: {LangDescriptions[gl].name}</span>, value: gl })

    oneBox.ui.api.prompt('Select Language', {
      enumOptions(input) { return getSearchMatcher(input).filter(options) },
    }).then(value => {
      if (value) setLangKeepCursor(value as Lang)
    })
  }

  // #endregion

  return (
    <div class="flex flex-col h-full">
      <div class="ob-panel-toolbar">
        <button class="ob-panel-toolbarBtn" onClick={askAndSetLang}>
          <i class="i-mdi-file-outline"></i>
          {LangDescriptions[file.lang].name}
        </button>

        <Show when={guessedLang() !== file.lang}>
          <button class="ob-panel-toolbarBtn text-green-7" onClick={() => setLangKeepCursor(guessedLang())}>
            <i class='i-mdi-thought-bubble' />
            {LangDescriptions[guessedLang()].name}?
          </button>
        </Show>

        <For each={installedPlugins()}>
          {plugin => plugin.getQuickActions && <For each={Array.from(plugin.getQuickActions(file))}>
            {action => <button class="ob-panel-toolbarBtn" onClick={() => void action.run()}>
              {action.label?.() || action.value}
            </button>}
          </For>}
        </For>

        <button class="ob-panel-toolbarBtn text-green-7"
          onClick={() => oneBox.api.interactiveSummonAction(file.filename)}
          onMouseEnter={oneBox.ui.api.getActionHintEvFor(<>
            <div class='ob-status-actionHint'>
              (
              psst. just press
              <kbd>Cmd+Enter</kbd>
              to summon an Action
              )
            </div>
          </>)}
        >
          <i class='i-mdi-rocket' />
          Action
        </button>
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
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F2],
            })

            editor.addAction({
              id: 'oneBox.createFile',
              label: 'New File',
              run: () => void oneBox.api.createFileAndOpen(),
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
              label: 'OneBox: Set Language',
              run: () => void setToUnknownOrAskLang(),
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
              label: 'OneBox: Action',
              run: () => void oneBox.api.interactiveSummonAction(file.filename),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
              contextMenuGroupId: 'navigation',
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

          // plugins
          installedPlugins().forEach(plugin => plugin.setupMonacoEditor?.({
            panelId,
            editor: editor!,
            file,
          }))
        }}
      />
    </div>
  )
}
