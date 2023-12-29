import { JSXElement } from "solid-js"
import { Fn, Nil, getSearchMatcher } from "yon-utils"
import { OneBox } from "~/store"
import { Lang } from "~/utils/lang"
import JSON5 from 'json5'

export type OBAction = {
  label?: () => JSXElement
  value: string
  run: Fn
}

export async function getActions(oneBox: OneBox, filename: string | Nil) {
  const { files, panels, ui } = oneBox
  const file = files.api.getControllerOf(filename)
  if (!file) return []

  const actions: OBAction[] = [];

  // Markdown Preview
  if (file.lang === Lang.MARKDOWN) {
    actions.push({
      label: () => <div><i class="i-mdi-markdown"> </i> Preview Markdown</div >,
      value: 'preview markdown',
      run() {
        panels.api.openPanel({ panelType: 'markdownPreview', filename: file.filename }, 'right')
      },
    })
  }

  // JSON Formatting
  if (file.lang === Lang.JSON) {
    actions.push({
      label: () => <div><i class="i-mdi-code-json"></i> Format JSON</div>,
      value: 'format json',
      run() {
        file.setContent(JSON.stringify(JSON5.parse(file.content), null, 2))
      },
    })
  }

  // Diff
  actions.push({
    label: () => <div><i class="i-mdi-scale-balance"></i> Diff</div>,
    value: 'diff',
    async run() {
      const allList = oneBox.files.state.files.map(f => f.filename).filter(f => f !== file.filename)
      const createNewFilePlaceholder = '<create new file>'
      allList.unshift(createNewFilePlaceholder)

      let otherFile = await ui.api.prompt(`Diff "${file.filename}" with`, {
        enumOptions: (keyword) => getSearchMatcher(keyword()).filter(allList)
          .map(x => ({
            value: x,
            label: x === createNewFilePlaceholder
              ? () => <div><i class="i-mdi-plus-circle" />{' Create New File'}</div>
              : x,
          })),
      })
      if (!otherFile) return

      if (otherFile === createNewFilePlaceholder) {
        otherFile = files.api.createFile({
          content: file.content,
          filename: file.filename.replace(/\.[^.]+$/, p => `_diff${p}`),
        }).filename
      }

      panels.api.openPanel({
        panelType: 'diff',
        title: 'Diff: ' + file.filename,
        filename: file.filename,
        diff: { filename2: otherFile },
      }, 'within')
    },
  })

  return actions
}