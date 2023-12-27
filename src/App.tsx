/* @refresh granular */
import { For, getOwner, onMount, runWithOwner } from "solid-js";
import { DockView } from "solid-dockview";
import { FilePanel } from "./components/FilePanel";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";

window.monaco = monaco
window._ = _
window.lodash = _

export default function App() {
  const oneBox = useOneBox()

  onMount(() => {
    // oneBox.api.createTextFileWithContent('test.json5', '{\n "foo": 123,\n bar: 456,\n}');
  });

  return (
    <div class="flex">
      <Sidebar />
      <div class="flex-1 min-w-0"><EditZone /></div>
    </div>
  );
}

function EditZone() {
  const oneBox = useOneBox()

  const createFile = () => {
    oneBox.api.createEmptyFile();
  }

  watch(() => oneBox.store.dockview, dockview => {
    if (!dockview) return
    const owner = getOwner()

    // load from localStorage
    oneBox.api.projectCacheLoad()

    // update cache when window lost focus
    window.addEventListener('blur', () => {
      runWithOwner(owner, () => oneBox.api.projectCacheSave())
    })
  })

  return <DockView
    class="dockview-theme-light"
    style="height: 100vh"
    leftHeaderActionsComponent={() => (
      <button class="ob-tab-createBtn" onClick={createFile}>
        <i class="i-mdi-plus"></i>
        New File
      </button>
    )}
    onWillDragPanel={() => oneBox.updateStore('isDraggingPanel', true)}
    onWillDragGroup={() => oneBox.updateStore('isDraggingPanel', true)}

    onReady={({ dockview }) => {
      oneBox.updateStore('dockview', dockview)
    }}

    watermarkComponent={() => <div class="ob-watermark" onDblClick={e => (e.preventDefault(), createFile())}>
      <div>
        <p>Create a file to start</p>
        <button onClick={createFile}>
          <i class="i-mdi-plus"></i>
          New File
        </button>
      </div>
    </div>}
  >

    {/* Files */}
    <For each={oneBox.store.panels}>
      {(panel, index) => <FilePanel panel={panel} index={index} />}
    </For>

  </DockView>;
}
