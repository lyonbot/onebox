import * as monaco from 'monaco-editor'
import { onCleanup, untrack } from 'solid-js'
import { signal, forSolid, memo } from '~/utils/forSolidClass'
import { watch } from '~/utils/solid'

export type VFile = VTextFile

@forSolid
export class VTextFile {
  readonly is = "textFile"

  @signal filename: string
  @signal content: string
  @signal language: string

  @memo
  get model() {
    const uri = monaco.Uri.parse(`file:///${this.filename}`)
    const model = untrack(() => monaco.editor.createModel(this.content, this.language, uri))

    watch(() => this.language, lang => monaco.editor.setModelLanguage(model, lang), true)
    watch(() => this.content, content => model.getValue() !== content && model.setValue(content), true)
    model.onDidChangeContent(() => this.content = model.getValue())
    model.onDidChangeLanguage(() => this.language = model.getLanguageId())

    onCleanup(() => {
      model.dispose()
    })

    return model
  }

  constructor(filename: string, content: string = '') {
    this.filename = filename
    this.content = content
    this.language = 'plaintext'

    onCleanup(() => {
      console.log('cleanup', this.filename, this.content)
    })
  }
}
