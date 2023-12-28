import { DockviewComponent, DockviewPanelApi } from "dockview-core"
import { createEffect, mapArray, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { watch } from "~/utils/solid"
import { uniqueId } from "lodash"

export type PanelsStore = ReturnType<typeof createPanelsStore>

export interface UIPanel {
  id: string
  filename: string
  panelApi?: DockviewPanelApi
}

export function createPanelsStore(/*root: () => OneBox*/) {
  const [state, update] = createStore({
    panels: [] as UIPanel[],
    activePanelId: '',
    get activePanel() { return state.panels.find(x => x.id === this.activePanelId) },

    isDraggingPanel: false,
    dockview: null as unknown as DockviewComponent
  })

  // avoid dockview's drag-n-drop polluting monaco
  watch(() => state.isDraggingPanel, (dragging) => {
    if (!dragging) return

    const listener = () => update('isDraggingPanel', false)
    window.addEventListener('dragend', listener,)
    window.addEventListener('drop', listener,)

    onCleanup(() => {
      window.removeEventListener('dragend', listener,)
      window.removeEventListener('drop', listener,)
    })
  })

  const api = {
    openPanel(panel: Omit<UIPanel, 'id'> & { id?: string }) {
      const id = panel.id || uniqueId('panel-')
      update('panels', x => [...x, { ...panel, id }])
      return id
    },
    closePanel(id: string) {
      update('panels', panels => panels.filter(x => x.id !== id))
    },

    setupDockview(dockview: DockviewComponent) {
      update('dockview', dockview)

      dockview.onWillDragGroup(() => update('isDraggingPanel', true))
      dockview.onWillDragPanel(() => update('isDraggingPanel', true))

      // sync panel's creating and removing
      dockview.onDidAddPanel(panel => {
        if (state.panels.some(x => x.id === panel.id)) return
        update('panels', x => [...x, { id: panel.id, ...panel.params as any }])
      })
      dockview.onDidRemovePanel(panel => {
        update('panels', panels => panels.filter(x => x.id !== panel.id))
      })
      createEffect(mapArray(
        () => state.panels,
        (panelData, index) => {
          const panel = dockview.getGroupPanel(panelData.id) || dockview.addPanel({
            id: panelData.id,
            component: 'adaptor',
            params: panelData
          })

          update('panels', index(), 'panelApi', panel.api)

          onCleanup(() => {
            const p = dockview.getGroupPanel(panel.id)
            if (p) dockview.removePanel(p)
          })

          return null
        }
      ))

      // sync active panel
      dockview.onDidActivePanelChange(() => {
        update('activePanelId', dockview.activePanel?.id || '')
      })
      watch(() => state.activePanelId, id => {
        if (dockview.activePanel?.id === id) return
        dockview.getGroupPanel(id)?.api.setActive()
      })
    }
  }

  return {
    state,
    update,
    api,
  }
}
