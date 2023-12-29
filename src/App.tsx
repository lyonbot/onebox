/* @refresh granular */
import { getOwner, onMount, runWithOwner } from "solid-js";
import { useOneBox } from "./store";
import { Sidebar } from "./components/Sidebar";
import * as monaco from 'monaco-editor';
import _ from 'lodash'
import { watch } from "./utils/solid";
import { OneBoxDockview } from "./panels";
import { StatusBar } from "./components/StatusBar";
import { clsx, modKey } from "yon-utils";
import './monaco/setup'

const global = window as any
global.monaco = monaco
global._ = _
global.lodash = _

export default function App() {
  const oneBox = useOneBox()

  onMount(() => {
    window.addEventListener('keydown', ev => {
      if (modKey(ev) === modKey.Mod && ev.code == 'KeyB') {
        ev.preventDefault()
        oneBox.ui.api.toggleSidebar()
      }
    });
  });

  return (
    <div id="ob-app" class={clsx(oneBox.ui.state.darkMode && 'darkMode')}>
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
    if (!oneBox.api.loadLastProject()) {
      console.log('create empty file')
      oneBox.api.createEmptyFile()
    }

    // update cache when window lost focus
    document.body.addEventListener('focusout', () => {
      runWithOwner(owner, () => oneBox.api.saveLastProject())
    })
  })

  return <OneBoxDockview />
}
