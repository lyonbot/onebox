import { DockviewComponent, IWatermarkRenderer } from "dockview-core"
import { useOneBox } from "~/store"
import { getDockviewAdaptor, castConstructor, simpleRendererAdaptor, FAKE_PANEL_COMPONENT } from "./adaptor"
import { getOwner } from "solid-js"
import { noop } from "lodash"
import { Watermark } from "./Watermark"

export function OneBoxDockview() {
  const oneBox = useOneBox()
  const owner = getOwner()

  function setupWithDiv(parentElement: HTMLDivElement) {
    const adaptors = getDockviewAdaptor(oneBox, owner)
    const dockview = new DockviewComponent({
      parentElement,
      components: {
        adaptor: adaptors.DockviewContentAdaptor,
        [FAKE_PANEL_COMPONENT]: adaptors.FakePanelComponent,
      },
      tabComponents: {
        adaptor: adaptors.DockviewTabAdaptor,
      },
      createLeftHeaderActionsElement: (group) => simpleRendererAdaptor(() => (
        <button
          class="ob-tab-createBtn"
          onClick={(ev) => {
            ev.preventDefault()
            group.activePanel?.api.setActive()
            oneBox.api.createFileAndOpen(undefined, (ev.metaKey || ev.ctrlKey || ev.shiftKey) ? 'right' : 'within')
          }}
          onMouseEnter={oneBox.ui.api.getActionHintEvFor(
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
        ...simpleRendererAdaptor((props) => <Watermark {...props} />, owner),
        updateParentGroup: noop,
      })),
      floatingGroupBounds: 'boundedWithinViewport',
    })

    oneBox.panels.api.setupDockview(dockview)
  }

  return <div
    class="dockview-theme-light isolate absolute inset-0 backface-hidden"
    ref={setupWithDiv}
  />
}
