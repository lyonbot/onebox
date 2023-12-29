import { DockviewComponent, IWatermarkRenderer } from "dockview-core"
import { useOneBox } from "~/store"
import { getDockviewAdaptor, castConstructor, simpleRendererAdaptor } from "./adaptor"
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
    const adaptors = getDockviewAdaptor(oneBox, owner)
    const dockview = new DockviewComponent({
      parentElement,
      components: {
        adaptor: adaptors.DockviewContentAdaptor,
      },
      tabComponents: {
        adaptor: adaptors.DockviewTabAdaptor,
      },
      createLeftHeaderActionsElement: () => simpleRendererAdaptor(() => (
        <button
          class="ob-tab-createBtn"
          onClick={(ev) => {
            ev.preventDefault()
            oneBox.api.createEmptyFile(undefined, (ev.metaKey || ev.ctrlKey || ev.shiftKey) ? 'right' : 'within')
          }}
          onMouseEnter={oneBox.ui.api.getActionHintEvForMouse(
            <div class='ob-status-actionHint'>
              <kbd>Cmd+<i class='i-ob-mouse-left' /></kbd>
              Create and Open Aside
            </div>
          )}
        >
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