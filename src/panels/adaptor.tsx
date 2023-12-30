import { DockviewPanelApi, GroupPanelContentPartInitParameters, GroupPanelPartInitParameters, IContentRenderer, ITabRenderer } from "dockview-core";
import { JSX, createEffect, createMemo, createSignal, getOwner, lazy, runWithOwner } from "solid-js";
import { Portal } from "solid-js/web";
import { OneBox } from "~/store";
import { UIPanel } from "~/store/panels";
import { panelSolidComponents } from "./panels";
import { modKey } from "yon-utils";

export interface AdaptedPanelProps {
  id: string;
  params: UIPanel
  api: DockviewPanelApi;
  isActive: boolean;
}

export function getDockviewAdaptor(oneBox: OneBox, owner = getOwner()) {
  class DockviewContentAdaptor implements IContentRenderer {
    element = document.createElement('div');
    $isAlive = createSignal(true);
    $isActive = createSignal(false);

    init(parameters: GroupPanelContentPartInitParameters): void {
      this.element.style.display = 'contents'
      runWithOwner(owner, () => createEffect(() => {
        if (!this.$isAlive[0]()) return

        const id = parameters.api.id
        const getPanelData = createMemo(() => oneBox.panels.state.panels.find(x => x.id === id))

        createEffect(() => {
          if (!this.$isActive[0]()) return null
          const panelData = getPanelData() // assuming the ref never change
          if (!panelData) return null

          const PanelComponent = lazy(panelSolidComponents[panelData.panelType || 'default'])

          return <Portal mount={this.element} ref={x => { x.className = 'ob-dockview-panel-content' }}>
            <PanelComponent
              id={id}
              api={parameters.api}
              params={panelData}
              isActive={oneBox.panels.state.activePanelId === id}
            />
          </Portal>
        })
      }))
    }

    // onGroupChange?(group: DockviewGroupPanel): void {
    // }

    onPanelVisibleChange(isPanelVisible: boolean): void {
      if (isPanelVisible) this.$isActive[1](true)
    }

    // layout(width: number, height: number): void {
    // }

    update(/* event: PanelUpdateEvent<UIPanel> */): void {
    }

    dispose() {
      this.$isActive[1](false)
      this.$isAlive[1](false)
    }

    // focus(): void {
    // }
  }

  class DockviewTabAdaptor implements ITabRenderer {
    element = document.createElement('div');
    $isAlive = createSignal(true);

    init(parameters: GroupPanelPartInitParameters): void {
      this.element.style.display = 'contents'

      runWithOwner(owner, () =>
        createEffect(() => {
          if (!this.$isAlive[0]()) return null

          const panelId = parameters.api.id
          const getPanelData = createMemo(() => oneBox.panels.state.panels.find(x => x.id === panelId))

          const title = createMemo(() => getPanelData()?.title || getPanelData()?.filename || panelId)

          const closePanel = () => {
            oneBox.panels.api.closePanel(panelId)
          }

          const rename = async () => {
            const panelData = getPanelData()
            if (!panelData) return

            await oneBox.api.interactiveRenameFile(panelData?.filename)
          };

          const copyPanel = (pos: 'right' | 'below') => {
            const panelData = getPanelData()
            if (!panelData) return

            oneBox.panels.update('activePanelId', panelId) // fix "openPanel" position
            oneBox.panels.api.openPanel({
              panelType: panelData.panelType,
              filename: panelData.filename,
            }, pos)
          }

          return <Portal mount={this.element} ref={el => void (el.style.display = 'contents')}>
            <div
              class="default-tab"
              onMouseDown={ev => {
                if (ev.button === 1) {
                  ev.preventDefault()
                  closePanel()
                  return
                }
                if (modKey(ev) === modKey.Mod) {
                  copyPanel('right')
                  return
                }
                if (modKey(ev) === (modKey.Mod | modKey.Alt)) {
                  copyPanel('below')
                  return
                }
              }}
              onDblClick={rename}
              onMouseEnter={oneBox.ui.api.getActionHintEvFor(<>
                <div class='ob-status-actionHint'>
                  <kbd><i class='i-ob-mouse-mid' /></kbd>
                  Close
                </div>

                <div class='ob-status-actionHint'>
                  <kbd><i class='i-ob-mouse-left' />x2</kbd>
                  Rename
                </div>

                <div class='ob-status-actionHint'>
                  <kbd>Shift+<i class='i-ob-mouse-left' /></kbd>
                  Float
                </div>

                <div class='ob-status-actionHint'>
                  <kbd>Cmd+<i class='i-ob-mouse-left' /></kbd>
                  Split Panel
                </div>
              </>)}
            >
              <div class="tab-content">{title()}</div>
              <div class="action-container">
                <ul class="tab-list">
                  <div class="tab-action" onClick={closePanel}>
                    <i class="i-mdi-close" />
                  </div>
                </ul>
              </div>
            </div>
          </Portal>
        })
      )
    }

    update(): void {
    }

    dispose() {
      this.$isAlive[1](false)
    }
  }

  return { DockviewContentAdaptor, DockviewTabAdaptor }
}

export function simpleRendererAdaptor(render: () => JSX.Element, owner = getOwner()) {
  const element = document.createElement('div');
  const [active, setActive] = createSignal(false);

  element.style.display = 'contents'

  runWithOwner(owner, () => {
    createEffect(() => {
      if (!active()) return null
      return <Portal mount={element} ref={el => {
        el.style.display = 'contents'
      }}>{render()}</Portal>
    })
  })

  return {
    element,
    init() {
      setActive(true)
    },
    dispose() {
      setActive(false)
    },
  }
}

export function castConstructor<T, Params extends any[]>(ctor: (...args: Params) => T) {
  return function (...args: Params) {
    return ctor(...args)
  } as unknown as { new(...args: Params): T }
}
