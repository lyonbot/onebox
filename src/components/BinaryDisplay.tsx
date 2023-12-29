import { Buffer } from 'buffer';
import { Match, Switch, createMemo, onCleanup } from 'solid-js';
import { useOneBox } from '~/store';
import { guessFileNameType } from '~/utils/files';

interface BinaryDisplayProps {
  buffer: Buffer
  filename: string
}

export function BinaryDisplay(props: BinaryDisplayProps) {
  const oneBox = useOneBox()

  const guessedType = createMemo(() => guessFileNameType(props.filename))
  const objectUrl = createMemo(() => {
    const ext = props.filename.split('.').pop()
    const blob = new Blob([props.buffer], { type: `${guessedType()}/${ext}` })
    const url = URL.createObjectURL(blob)

    onCleanup(() => URL.revokeObjectURL(url))

    return url
  })

  return <div class='flex flex-col items-center overflow-auto'>
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
        <img src={objectUrl()} class="ob-binaryDisplay-preview max-w-full" />
      </Match>

      <Match when={guessedType() === 'audio'}>
        <audio controls src={objectUrl()} class='ob-binaryDisplay-preview w-80%' />
      </Match>

      <Match when={guessedType() === 'video'}>
        <video controls src={objectUrl()} class="ob-binaryDisplay-preview max-w-full" />
      </Match>
    </Switch>
  </div>
}