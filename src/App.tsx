/* @refresh granular */
import { For, onMount } from "solid-js";
import { DockPanel, DockView } from "solid-dockview";
import MonacoEditor from "./components/MonacoEditor";
import oneBox, { UIPanel } from "./store";

function FilePanel({ panel }: { panel: UIPanel }) {
  const file = panel.file // assuming not change

  const rename = () => {
    const newName = prompt('Rename File', file.filename);
    if (newName) file.filename = newName;
  }

  return <DockPanel
    title={<div onDblClick={rename}>{file.filename}</div>}
    onClose={() => {
      oneBox.updateStore('panels', panels => panels.filter(p => p !== panel))
    }}
  >
    <div class="flex flex-col h-full">
      <div>
        foo
      </div>


      <MonacoEditor
        class="flex-1 border border-gray-300"
        model={file.model}
        options={{
          minimap: {},
          lineNumbersMinChars: 2,
        }}
      />
    </div>
  </DockPanel>
}

export default function App() {
  onMount(() => {
    oneBox.api.createTextFile('test.txt', 'Hello World');
  });

  return (
    <DockView
      class="dockview-theme-light"
      style="height: 80vh"
      leftHeaderActionsComponent={() => (
        <button onClick={() => {
          oneBox.api.createTextFile('test' + Math.random() + '.txt', 'Hello World');
        }}>Create File</button>
      )}
    >

      {/* Files */}
      <For each={oneBox.store.panels}>
        {panel => <FilePanel panel={panel} />}
      </For>

    </DockView>
  );
}