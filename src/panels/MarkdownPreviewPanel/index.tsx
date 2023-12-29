import { Show, createMemo } from "solid-js"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "../adaptor"
import { VTextFileController } from "~/store/files"
import markdownit from 'markdown-it'

export default function MarkdownPreviewPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = createMemo(() => oneBox.files.api.getControllerOf(props.params.filename))

  return <Show when={file()}>
    <Markdown file={file()!} panelId={props.id} />
  </Show>
}

function Markdown(props: { file: VTextFileController, panelId: string }) {
  const { file } = props; // assuming not change
  const oneBox = useOneBox()

  function fixUrl(url: string) {
    const rel = url.replace(/^\.\//, '').replace(/[?#].*$/, '')
    const ctrl = oneBox.files.api.getControllerOf(rel)

    if (ctrl) return ctrl.objectURL
    return url
  }

  const md = markdownit({
    linkify: true,
  })
  md.renderer.rules.image = function (tokens, idx, options, env, slf) {
    const token = tokens[idx]!

    token.attrs![token.attrIndex('alt')][1] = slf.renderInlineAsText(token.children!, options, env)
    token.attrs![token.attrIndex('src')][1] = fixUrl(token.attrs![token.attrIndex('src')][1])

    return slf.renderToken(tokens, idx, options)
  }

  const html = createMemo(() => {
    const env = {}
    const tokens = md.parse(file.content, env)
    return md.renderer.render(tokens, md.options, env)
  })

  return <div class="max-h-full overflow-auto p-8 max-w-4xl mx-a">
    <article class="markdown-body" innerHTML={html()}></article>
  </div>
}
