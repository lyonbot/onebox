import { DockviewComponent, IWatermarkRenderer } from "dockview-core"
import { useOneBox } from "~/store"
import { getDockviewContentAdaptor, castConstructor, simpleRendererAdaptor } from "./adaptor"
import { getOwner } from "solid-js"
import { noop } from "lodash"

function Watermark() {
  const oneBox = useOneBox()

  return <div
    class="ob-watermark"
    onDblClick={e => (e.preventDefault(), oneBox.api.createEmptyFile())}
    onMouseEnter={oneBox.ui.api.getActionHintEvForMouse([
      <div class='ob-status-actionHint'>
        <kbd><i class='i-ob-mouse-left' />x2</kbd>
        New File
      </div>
    ])}
  >
    <div>
      <p>Create a file to start</p>
      <button onClick={() => oneBox.api.createEmptyFile()}>
        <i class="i-mdi-plus"></i>
        New File
      </button>
    </div>
  </div>
}

export function OneBoxDockview() {
  const oneBox = useOneBox()
  const owner = getOwner()

  function setupWithDiv(parentElement: HTMLDivElement) {
    const dockview = new DockviewComponent({
      parentElement,
      components: {
        adaptor: getDockviewContentAdaptor(oneBox, owner),
      },
      createLeftHeaderActionsElement: () => simpleRendererAdaptor(() => (
        <button class="ob-tab-createBtn" onClick={() => oneBox.api.createEmptyFile()}>
          <i class="i-mdi-plus"></i>
          New File
        </button>
      ), owner),
      watermarkComponent: castConstructor((): IWatermarkRenderer => ({
        ...simpleRendererAdaptor(() => <Watermark />, owner),
        updateParentGroup: noop,
      })),
    })

    oneBox.panels.api.setupDockview(dockview)
  }

  return <div
    class="dockview-theme-light absolute inset-0 backface-hidden"
    ref={setupWithDiv}
  />
}