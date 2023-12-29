export const panelSolidComponents: Record<string, () => Promise<any>> = {
  default: () => import('./EditorPanel'),
  binary: () => import('../components/BinaryDisplay'),
}