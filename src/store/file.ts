import * as monaco from 'monaco-editor'
import { onCleanup, untrack } from 'solid-js'
import { signal, forSolid, memo } from '~/utils/forSolidClass'
import { Lang, LangDescriptions } from '~/utils/langsBase'
import { watch } from '~/utils/solid'

export type VFile = VTextFile

@forSolid
export class VTextFile {
  readonly is = "textFile"

  @signal filename: string
  @signal content: string
  @signal lang: Lang

  @memo
  get model() {
    const uri = monaco.Uri.parse(`file:///${this.filename}`)
    const model = untrack(() => monaco.editor.createModel(this.content, 'plaintext', uri))

    watch(() => LangDescriptions[this.lang]?.monacoLanguage || 'plaintext', lang => monaco.editor.setModelLanguage(model, lang))
    watch(() => this.content, content => model.getValue() !== content && model.setValue(content), true)
    model.onDidChangeContent(() => this.content = model.getValue())

    onCleanup(() => {
      model.dispose()
    })

    return model
  }

  constructor(filename: string, content: string = '') {
    this.filename = filename
    this.content = content
    this.lang = Lang.UNKNOWN

    onCleanup(() => {
      console.log('cleanup', this.filename, this.content)
    })

    console.log('creating', this)
  }
}
