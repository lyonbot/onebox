/* @refresh granular */
import { onMount } from "solid-js";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";

window.monaco = monaco
window._ = _
window.lodash = _

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

  watch(() => oneBox.panels.state.dockview, dockview => {
    if (!dockview) return
    // const owner = getOwner()

    // load from localStorage
    // oneBox.api.projectCacheLoad()

    // // update cache when window lost focus
    // window.addEventListener('blur', () => {
    //   runWithOwner(owner, () => oneBox.api.projectCacheSave())
    // })
  })

  return <OneBoxDockview />
}
