import type { OneBoxPlugin } from '~/plugins'

const oneBoxMarkdown: OneBoxPlugin = oneBox => ({
  name: 'onebox-markdown',
  panels: {
    'onebox-markdown-preview': () => import('./panel'),
  },
  async * getActions(file) {
    if (file.lang !== 'markdown') return

    yield {
      label: () => <div><i class="i-mdi-markdown" > </i> Preview Markdown</div >,
      value: 'preview markdown',
      run() {
        oneBox.panels.api.openPanel({
          panelType: 'onebox-markdown-preview',
          filename: file.filename,
        }, 'right')
      },
    }
  },
})

export default oneBoxMarkdown
