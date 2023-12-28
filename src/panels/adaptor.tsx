import { DockviewPanelApi, GroupPanelContentPartInitParameters, IContentRenderer, } from "dockview-core";
import { JSX, createEffect, createSignal, getOwner, lazy, runWithOwner } from "solid-js";
import { Portal } from "solid-js/web";
import { OneBox } from "~/store";
import { UIPanel } from "~/store/panels";
import { panelSolidComponents } from "./panels";

export interface AdaptedPanelProps {
  id: string;
  params: UIPanel
  api: DockviewPanelApi;
  isActive: boolean;
}

export function getDockviewContentAdaptor(oneBox: OneBox, owner = getOwner()) {
  return class DockviewContentAdaptor implements IContentRenderer {
    element = document.createElement('div');
    private $isActive = createSignal(false);

    init(parameters: GroupPanelContentPartInitParameters): void {
      this.element.style.display = 'contents'
      runWithOwner(owner, () => {
        createEffect(() => {
          if (!this.$isActive[0]()) return null
          const id = parameters.api.id
          const panelData = oneBox.panels.state.panels.find(x => x.id === id) // assuming the ref never change
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
      })
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
    }

    // focus(): void {
    // }
  }
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
    }
  }
}

export function castConstructor<T, Params extends any[]>(ctor: (...args: Params) => T) {
  return function (...args: Params) {
    return ctor(...args)
  } as unknown as { new(...args: Params): T }
}
