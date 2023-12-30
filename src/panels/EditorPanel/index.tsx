import { createMemo } from "solid-js"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "../adaptor"
import { BinaryDisplay } from "~/components/BinaryDisplay"
import EditorMonacoPanel from "./EditorMonacoPanel"

export default function EditorPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const getFile = createMemo(() => oneBox.api.getFile(props.params.filename))
  const content = createMemo(() => {
    const file = getFile()

    if (!file) return <div>
      File not found: {props.params.filename}
    </div>

    if (file.contentBinary) return () => <BinaryDisplay
      filename={file.filename}
      buffer={file.contentBinary as any}
      objectURL={file.objectURL}
      class="h-full pt-6"
    />

    return () => <EditorMonacoPanel file={file} panelId={props.id} />
  })

  return content()
}
