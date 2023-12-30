export const panelSolidComponents: Record<string, () => Promise<any>> = {
  default: () => import('./EditorPanel'),
  diff: () => import('./DiffPanel'),
}
