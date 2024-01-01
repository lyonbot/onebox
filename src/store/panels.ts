import { DockviewComponent, DockviewPanelApi } from "dockview-core"
import { batch, createEffect, mapArray, onCleanup } from "solid-js"
import { SetStoreFunction, createStore } from "solid-js/store"
import { addListener, watch } from "~/utils/solid"
import { uniqueId } from "lodash"
import type * as monaco from 'monaco-editor'
import { OneBoxPanelData } from "~/plugins"

export type PanelsStore = ReturnType<typeof createPanelsStore>

const idPrefix = `panel-${Date.now().toString(36)}-`

export interface UIPanel extends OneBoxPanelData {
  id: string
  filename: string
  title?: string
  panelType?: string
  panelApi?: () => DockviewPanelApi
}

export function createPanelsStore(/*root: () => OneBox*/) {
  const [state, update] = createStore({
    panels: [] as UIPanel[],
    activePanelId: '',
    get activePanel() { return state.panels.find(x => x.id === this.activePanelId) },

    isDraggingPanel: false,
    dockview: null as unknown as DockviewComponent,
    activeMonacoEditor: undefined as undefined | monaco.editor.IStandaloneCodeEditor,
  })

  // avoid dockview's drag-n-drop polluting monaco
  watch(() => state.isDraggingPanel, (dragging) => {
    if (!dragging) return

    const listener = () => update('isDraggingPanel', false)
    addListener(window, 'dragend', listener,)
    addListener(window, 'drop', listener,)
  })

  const api = {
    openPanel(panel: Omit<UIPanel, 'id'> & { id?: string }, direction?: 'within' | 'left' | 'right' | 'above' | 'below') {
      const id = panel.id || uniqueId(idPrefix)

      batch(() => {
        update('panels', x => [...x, { id, ...panel }])
        if (direction && direction !== 'within' && state.activePanel) {
          state.dockview.addPanel({
            id,
            component: 'adaptor',
            tabComponent: 'adaptor',
            params: state.panels.at(-1)!,
            position: {
              referencePanel: state.activePanelId,
              referenceGroup: state.dockview.activeGroup?.id,
              direction,
            },
          })
        }
      })

      return id
    },
    closePanel(id: string) {
      update('panels', panels => panels.filter(x => x.id !== id))

      // maybe is a zombie panel from dockview
      try {
        const panel = state.dockview.getGroupPanel(id)
        if (panel) state.dockview.removePanel(panel)
      } catch {
        // ignore errors; maybe the panel is already removed
      }
    },
    updatePanel(id: string) {
      return ((...args: any[]) => update('panels', p => p.id === id, ...args as [any])) as SetStoreFunction<UIPanel>
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
            tabComponent: 'adaptor',
            params: panelData,
          })

          update('panels', index(), { panelApi: () => panel.api })

          onCleanup(() => {
            try {
              const p = dockview.getGroupPanel(panel.id)
              if (p) dockview.removePanel(p)
            } catch {
              // ignore errors; maybe the panel is already removed
            }
          })

          return null
        }
      ))

      // sync active panel
      const syncActivePanelFromDockview = () => {
        update('activePanelId', dockview.activePanel?.id || '')
      }
      dockview.onDidActiveGroupChange(syncActivePanelFromDockview)
      dockview.onDidActivePanelChange(syncActivePanelFromDockview)
      watch(() => state.activePanelId, id => {
        if (dockview.activePanel?.id === id) return

        setTimeout(() => {
          const g = dockview.getGroupPanel(id)
          if (g) {
            g.api.setActive()
            g.group.model.setActive(true)
          }
        })
      })
    },
  }

  return {
    state,
    update,
    api,
  }
}
