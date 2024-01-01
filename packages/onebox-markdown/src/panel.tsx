/* eslint-disable @typescript-eslint/no-unused-vars */
import { basename, dirname, join } from "path"
import { Show, createMemo } from "solid-js"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "~/panels/adaptor"
import { VTextFileController } from "~/store/files"
import { Fn, Nil } from "yon-utils"

import { addListener, watch } from "~/utils/solid"
import { getModifiedMarkdownIt } from "./hyperMarkdownIt"

export default function MarkdownPreviewPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = createMemo(() => oneBox.api.getFile(props.params.filename))

  watch(() => `📘 ${file()?.filename}`, title => props.updateParams('title', title))

  return <Show when={file()}>
    <Markdown file={file()!} panelId={props.id} />
  </Show>
}

function chainBefore<T extends Fn>(fn: T | Nil, newFn: (...args: Parameters<T>) => void): T {
  return function (this: any, ...args: Parameters<T>) {
    newFn(...args)
    return fn?.apply(this, args) ?? ''
  } as any
}

function Markdown(props: { file: VTextFileController, panelId: string }) {
  const { file } = props; // assuming not change
  const oneBox = useOneBox()

  function getFileFromURL(url: string | Nil) {
    if (!url) return
    const rel = decodeURI(url.replace(/[?#].*$/, ''))
    const ctrl = oneBox.api.getFile(file.resolvePath(rel))

    if (ctrl) return ctrl
    return
  }

  const { md, render } = getModifiedMarkdownIt()
  md.renderer.rules.image = chainBefore(md.renderer.rules.image!, (tokens, idx) => {
    const token = tokens[idx]!
    const file = getFileFromURL(token.attrGet('src'))
    if (file) {
      token.attrSet('src', file.objectURL)
    }
  })
  md.renderer.rules.link_open = (tokens, idx, options) => {
    const token = tokens[idx]!
    const file = getFileFromURL(token.attrGet('href'))
    if (file) {
      token.attrSet('href', file.objectURL)
      token.attrPush(['target', '_blank'])
      token.attrPush(['download', basename(file.filename)])
    }
    return md.renderer.renderToken(tokens, idx, options)
  }

  const tokensToRender = createMemo(() => {
    const fm = file.content.match(/^---\n([\s\S]*?)\n---\n/)?.[0] || '' // remove frontmatter
    const env = {}
    return [md.parse(file.content.slice(fm.length), env), env, fm.split('\n').length - 1] as const
  })

  return <div class="h-full overflow-auto p-8 max-w-4xl mx-a box-border">
    <article
      class="markdown-body"
      ref={articleEl => {
        watch(tokensToRender, ([tokens, env, lineMappingSkip]) => {
          const renderResult = render(tokens, articleEl, env)

          setTimeout(() => {
            const { activeMonacoEditor, activePanel } = oneBox.panels.state
            if (activeMonacoEditor && activePanel?.filename === file.filename) {
              const { lineNumber: activeLine } = activeMonacoEditor.getPosition()!
              const element = renderResult.findLineElement(activeLine - lineMappingSkip)

              if (element) {
                element.scrollIntoView({ behavior: 'instant', block: 'nearest' })
              }
            }
          }, 100)
        })

        const goEditor = (target: HTMLElement/* , setCursor?: boolean */) => {
          const { activeMonacoEditor } = oneBox.panels.state
          if (!activeMonacoEditor) return

          const lineStr = target.closest('[data-source-line]')?.getAttribute('data-source-line')
          if (!lineStr) return
          const lineNo = parseInt(lineStr, 10) + tokensToRender()[2]

          // if (setCursor) activeMonacoEditor.setPosition({ lineNumber: lineNo, column: 1 })
          activeMonacoEditor.revealLineInCenterIfOutsideViewport(lineNo)
          activeMonacoEditor.focus()
        }

        addListener(articleEl, 'mouseenter', ev => goEditor(ev.target as HTMLElement), true)
      }}
    ></article>
  </div>
}
