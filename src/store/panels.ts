import { DockviewComponent, DockviewPanelApi } from "dockview-core"
import { LocalSelectionTransfer, PanelTransfer } from "dockview-core";
import { batch, createEffect, mapArray, onCleanup } from "solid-js"
import { SetStoreFunction, createStore } from "solid-js/store"
import { addListener, nextTick, watch } from "~/utils/solid"
import { uniqueId } from "lodash"
import type * as monaco from 'monaco-editor'
import { OneBoxPanelData } from "~/plugins"
import { FAKE_PANEL_COMPONENT } from "~/panels/adaptor"
import { basename } from "path";

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

    isDraggingPanel: false as false | { groupId: string } | { panelId: string } | { toOpenFile: string },
    dockview: null as unknown as DockviewComponent,
    activeMonacoEditor: undefined as undefined | monaco.editor.IStandaloneCodeEditor,
  })

  // avoid dockview's drag-n-drop polluting monaco
  watch(() => state.isDraggingPanel, (dragging) => {
    if (!dragging) return

    if ('toOpenFile' in dragging) {
      const filename = dragging.toOpenFile
      const dockview = state.dockview

      const panelTransfer = LocalSelectionTransfer.getInstance<PanelTransfer>()
      const fakePanel = dockview.addPanel({
        floating: { x: 0, y: -10, width: 0, height: 0 },
        id: `dnd-fake-${Date.now()}`,
        component: FAKE_PANEL_COMPONENT,
        title: basename(filename),
      })
      const floatingGroupId = fakePanel.group.id
      panelTransfer.setData(
        [new PanelTransfer(dockview.id, fakePanel.group.id, fakePanel.id)],
        PanelTransfer.prototype,
      )

      let dropped = false
      addListener(window, 'drop', () => (dropped = true), true)

      onCleanup(() => {
        panelTransfer.clearData(PanelTransfer.prototype);
        if (!dropped || (fakePanel.group?.id === floatingGroupId && fakePanel.group.model.isFloating)) {
          // aborted dropping panel. remove fake panel
          dockview.removePanel(fakePanel)
        }

        // dropping. open it
        const panelId = api.openPanel({ filename }, 'within')
        const movingTo = {
          group: fakePanel.group,
          index: fakePanel.group.model.panels.indexOf(fakePanel),
        };

        nextTick(() => {
          const panel = dockview.getGroupPanel(panelId)
          panel?.api.moveTo(movingTo)
          dockview.removePanel(fakePanel)
        })
      })

      return
    }

    addListener(window, 'dragend', () => update('isDraggingPanel', false))
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

      dockview.onWillDragGroup((ev) => update('isDraggingPanel', { groupId: ev.group.id }))
      dockview.onWillDragPanel((ev) => update('isDraggingPanel', { panelId: ev.panel.id }))

      // sync panel's creating and removing
      dockview.onDidAddPanel(panel => {
        if (panel.view.contentComponent === FAKE_PANEL_COMPONENT) return

        // in case the panel is created by dockview itself, or importing (which handled by dockview too)
        update('panels', arr => {
          if (state.panels.some(x => x.id === panel.id)) return arr;
          return [...arr, { id: panel.id, ...panel.params as any }]
        })
      })
      dockview.onDidRemovePanel(panel => {
        if (panel.view.contentComponent === FAKE_PANEL_COMPONENT) return

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
