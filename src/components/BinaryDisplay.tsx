import { Buffer } from 'buffer';
import { Match, Switch, createMemo, onCleanup } from 'solid-js';
import { useOneBox } from '~/store';
import { guessFileNameType } from '~/utils/files';

interface BinaryDisplayProps {
  buffer: Buffer
  filename: string
  objectURL?: string

  style?: any
  class?: string
}

export function BinaryDisplay(props: BinaryDisplayProps) {
  const oneBox = useOneBox()

  const guessedType = createMemo(() => guessFileNameType(props.filename))
  const objectUrl = createMemo(() => {
    // use VTextFileController's cache
    if (!/\.pdf$/i.test(props.filename) && props.objectURL) return props.objectURL

    // regular way to generate a url
    const ext = props.filename.split('.').pop()
    let t = guessedType() as string
    if (t === 'unknown') t = 'application';   // stupid but works on pdf

    const blob = new Blob([props.buffer], { type: `${t}/${ext}` })
    const url = URL.createObjectURL(blob)

    onCleanup(() => URL.revokeObjectURL(url))

    return url
  })

  return <div class={'flex flex-col items-center overflow-auto ' + (props.class || '')} style={props.style}>
    <div class='text-xl'>{props.filename}</div>
    <div class='text-sm'>{props.buffer.length} bytes</div>
    <div class='mb-8'>
      <button onClick={() => oneBox.api.downloadCurrentFile()}>
        <i class="i-mdi-download"></i>
        Download
      </button>
    </div>

    <Switch>
      <Match when={guessedType() === 'image'}>
        <img src={objectUrl()} class="ob-binaryDisplay-preview ob-darkMode-intact max-w-full" />
      </Match>

      <Match when={guessedType() === 'audio'}>
        <audio controls src={objectUrl()} class='ob-binaryDisplay-preview ob-darkMode-intact w-80%' />
      </Match>

      <Match when={guessedType() === 'video'}>
        <video controls src={objectUrl()} class="ob-binaryDisplay-preview ob-darkMode-intact max-w-full" />
      </Match>

      <Match when={props.filename.endsWith('.pdf')}>
        <iframe class="ob-binaryDisplay-preview ob-darkMode-intact w-full flex-1 border-none" src={objectUrl()} />
      </Match>
    </Switch>
  </div>
}
