/* eslint-disable @typescript-eslint/no-unused-vars */
import * as IncrementalDOM from 'incremental-dom'
import MarkdownIt from 'markdown-it'

export function getModifiedMarkdownIt() {
  let lineMapping = {} as Record<number, HTMLElement>

  const md = MarkdownIt({
    linkify: true,
  })
  md.renderer.rules.text = (tokens, idx,) => {
    const token = tokens[idx]!
    IncrementalDOM.text(token.content)
    return ''
  }
  md.renderer.rules.code_inline = (tokens, idx, options) => {
    const token = tokens[idx]!
    IncrementalDOM.elementOpen('code')
    IncrementalDOM.text(token.content)
    IncrementalDOM.elementClose('code')
    return ''
  }
  md.renderer.rules.fence = md.renderer.rules.code_block = (tokens, idx, options) => {
    const token = tokens[idx]!
    const startLine = token.map![0]

    IncrementalDOM.elementOpen('pre')

    token.content.split('\n').forEach((line, i) => {
      const lineNo = startLine + i + 1
      const element = IncrementalDOM.elementOpen('div', undefined, undefined, 'data-source-line', lineNo)
      IncrementalDOM.elementOpen('code')
      IncrementalDOM.text(line)
      IncrementalDOM.elementClose('code')
      IncrementalDOM.elementClose('div')
      IncrementalDOM.text('\n')

      lineMapping[lineNo] = element
    })
    IncrementalDOM.elementClose('pre')
    return ''
  }
  md.renderer.rules.hardbreak = (tokens, idx, options) => {
    IncrementalDOM.elementVoid('br')
    return ''
  }
  md.renderer.rules.softbreak = (tokens, idx, options) => {
    options.breaks && IncrementalDOM.text('\n')
    return ''
  }
  // TODO: html_block and html_inline
  md.renderer.renderToken = function (tokens, idx) {
    const token = tokens[idx];
    // Tight list paragraphs
    if (token.hidden) return ''

    // Insert a newline between hidden paragraph and subsequent opening
    // block-level tag.

    // For example, here we should insert a newline before blockquote:
    //  - a
    //    >

    if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
      IncrementalDOM.text("\n")
    }

    // Add token name, e.g. `<img`
    (token.nesting === -1) ? IncrementalDOM.elementClose(token.tag)
      : IncrementalDOM.elementOpenStart(token.tag)

    // Encode attributes, e.g. `<img src="foo"`
    for (const [name, value] of token.attrs || []) IncrementalDOM.attr(name, value)

    // Check if we need to add a newline after this tag
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        if (idx + 1 < tokens.length) {
          const nextToken = tokens[idx + 1];
          if (nextToken.type === "inline" || nextToken.hidden) {
            // Block-level tag containing an inline tag.
            needLf = false;
          } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
            // Opening tag + closing tag of the same type. E.g. `<li></li>`.
            needLf = false;
          }
        }
      }
    }

    if (token.nesting !== -1) {
      const element = IncrementalDOM.elementOpenEnd()
      // Special: adding mapping!
      if (token.map) {
        IncrementalDOM.attr('data-source-line', token.map[0])
        lineMapping[token.map[0]] = element
      }
    }
    if (token.nesting === 0) IncrementalDOM.elementClose(token.tag) // for <img />

    if (needLf) IncrementalDOM.text("\n")

    return '';
  }

  function render(tokens: MarkdownIt.Token[], container: HTMLElement, env: any = {}) {
    lineMapping = {}
    IncrementalDOM.patch(container, () => {
      md.renderer.render(tokens, md.options, env)
    })

    return {
      lineMapping,
      findLineElement(lineNo: number) {
        for (let i = lineNo; i >= 0; i--) {
          const element = lineMapping[i]
          if (element) return element
        }
      },
    }
  }

  return {
    md,
    render,
  }
}
