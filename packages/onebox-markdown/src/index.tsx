import type { OneBoxPlugin } from '~/plugins'

const oneBoxMarkdown: OneBoxPlugin = oneBox => {
  function preview(filename: string) {
    oneBox.panels.api.openPanel({
      panelType: 'onebox-markdown-preview',
      filename,
    }, 'right')
  }

  return ({
    name: 'onebox-markdown',
    panels: {
      'onebox-markdown-preview': () => import('./panel'),
    },
    async *getActions(file) {
      if (file.lang !== 'markdown') return

      yield {
        label: () => <div><i class="i-mdi-markdown"> </i> Preview Markdown</div>,
        value: 'preview markdown',
        run: () => preview(file.filename),
      }
    },
    *getQuickActions(file) {
      if (file.lang !== 'markdown') return

      yield {
        label: () => <div><i class="i-mdi-markdown"> </i> Preview</div>,
        run: () => preview(file.filename),
      }
    },
  })
}

export default oneBoxMarkdown
