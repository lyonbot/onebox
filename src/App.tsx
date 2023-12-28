/* @refresh granular */
import { getOwner, onMount, runWithOwner } from "solid-js";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()

  onMount(() => {
    // oneBox.api.createTextFileWithContent('test.json5', '{\n "foo": 123,\n bar: 456,\n}');
  });

  return (
    <div id="ob-app">
      <Sidebar id="ob-sidebar" />
      <div id="ob-editZone"><EditZone /></div>
      <StatusBar id="ob-statusBar" />
    </div>
  );
}

function EditZone() {
  const oneBox = useOneBox()
  const owner = getOwner()

  watch(() => oneBox.panels.state.dockview, dockview => {
    if (!dockview) return

    // load from localStorage
    oneBox.api.loadLastProject()

    // update cache when window lost focus
    document.body.addEventListener('focusout', () => {
      runWithOwner(owner, () => oneBox.api.saveLastProject())
    })
  })

  return <OneBoxDockview />
}
