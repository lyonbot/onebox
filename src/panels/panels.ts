export const panelSolidComponents: Record<string, () => Promise<any>> = {
  default: () => import('./EditorPanel'),
  markdownPreview: () => import('./MarkdownPreviewPanel'),
  diff: () => import('./DiffPanel'),
}
