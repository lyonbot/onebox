import { DockPanel } from "solid-dockview";
import * as monaco from 'monaco-editor';
import MonacoEditor from "./MonacoEditor";
import { UIPanel, useOneBox } from "../store";
import { Accessor, Show, batch, createMemo, getOwner, runWithOwner, } from "solid-js";
import { watch } from "~/utils/solid";
import { Lang, LangDescriptions, guessLang } from "~/utils/langsBase";
import { map } from "lodash";

export function FilePanel({ panel, index }: { panel: UIPanel; index: Accessor<number> }) {
  const oneBox = useOneBox()
  const file = panel.file; // assuming not change
  const panelKey = panel.id

  const rename = () => {
    const newName = prompt('Rename File', file.filename);
    if (newName) file.filename = newName;
  };

  const removePanel = () => {
    oneBox.updateStore('panels', panels => panels.filter(p => p.id !== panelKey));
  }

  const setLang = (lang: Lang) => {
    const description = LangDescriptions[lang];
    const ext = description.extname || '.txt';

    batch(() => {
      file.filename = file.filename.replace(/(\.[^.]+)?$/, ext);
      file.lang = lang;
    })
  }

  const titleDiv = <div
    onDblClick={rename}
    class="ob-panel-tab-title"
    ref={div => {
      setTimeout(() => {
        (div.closest('.default-tab') as HTMLElement)?.addEventListener('mousedown', ev => {
          // use mid button to close panel
          if (ev.button === 1) {
            ev.preventDefault()
            removePanel()
            return
          }
        })
      }, 100)
    }}
  >
    {file.filename}
  </div>

  const isActive = createMemo(() => index() === oneBox.store.activePanelIndex)
  const owner = getOwner()

  const guessedLang = createMemo(() => {
    if (file.lang !== Lang.UNKNOWN) return file.lang;
    return guessLang(file.content)
  })

  return <DockPanel
    id={panel.id}
    title={titleDiv}
    onCreate={({ panel: dockViewPanel }) => {
      const dockApi = dockViewPanel.api;
      oneBox.updateStore('panels', index(), 'dockApi', dockApi)
      dockApi.onDidActiveChange(e => {
        const curr = index()
        oneBox.updateStore('activePanelIndex', prev => {
          if (e.isActive && prev !== curr) return curr;
          if (!e.isActive && prev === curr) return -1;
          return prev
        })
      })

      runWithOwner(owner, () => {
        watch(isActive, isActive => {
          if (isActive && !dockViewPanel.api.isActive) {
            dockViewPanel.api.setActive()
          }
        })
      })
    }}
    onClose={() => removePanel()}
  >
    <div class="flex flex-col h-full">
      <div class="ob-panel-toolbar">
        <select value={file.lang} onChange={e => setLang(e.currentTarget.value as Lang)}>
          {map(LangDescriptions, (desc, lang) => <option value={lang}>{desc.name}</option>)}
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
        }}
        onSetup={editor => {
          // add keybindings
          {
            // add shortcut key Ctrl+B to run `toggleSidebar` command
            editor.addAction({
              id: 'onebox.toggleSidebar',
              label: 'Toggle Sidebar',
              run: () => oneBox.api.toggleSidebar(),
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB]
            })

            editor.addAction({
              id: 'onebox.renameFile',
              label: 'Rename File',
              run: rename,
              keybindings: [monaco.KeyCode.F2]
            })

            editor.addAction({
              id: 'onebox.createFile',
              label: 'New File',
              run: () => void oneBox.api.createEmptyFile(),
              keybindings: []
            })

            editor.addAction({
              id: 'onebox.close',
              label: 'Close Panel',
              run: () => void removePanel(),
              keybindings: []
            })

          }

          // dockview interaction fix
          {
            watch(isActive, isActive => {
              if (isActive) setTimeout(() => editor.focus())
            })

            watch(() => oneBox.store.isDraggingPanel, isDraggingPanel => {
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
  </DockPanel>;
}
