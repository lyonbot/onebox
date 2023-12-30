import { Component, createSignal } from 'solid-js'
import { AdaptedPanelProps } from './adaptor'

type PanelComponent = Component<AdaptedPanelProps>

const initial: Record<string, () => Promise<any>> = {
  default: () => import('./EditorPanel'),
  diff: () => import('./DiffPanel'),
}

const [getPanelSolidComponents, setPanelSolidComponents] = createSignal(initial)

export const getPanelSolidComponent = (name: string) => (getPanelSolidComponents()[name] || fallbackModule) as () => Promise<{ default: PanelComponent }>
export const setPanelSolidComponent = (name: string, component: () => Promise<{ default: any }>) => {
  setPanelSolidComponents((prev) => ({ ...prev, [name]: component }))
}

const fallbackComponent: PanelComponent = () => <div>loading...</div>
const fallbackModule = () => Promise.resolve({ default: fallbackComponent })
