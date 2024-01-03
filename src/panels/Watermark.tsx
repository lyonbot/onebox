import { WatermarkRendererInitParameters } from "dockview-core";
import { useOneBox } from "~/store";

export function Watermark({ params }: { params: WatermarkRendererInitParameters; }) {
  const oneBox = useOneBox();

  return <div
    class="ob-watermark"
    onDblClick={e => (e.preventDefault(), oneBox.api.createFileAndOpen())}
    onMouseEnter={oneBox.ui.api.getActionHintEvFor(<>
      <div class='ob-status-actionHint'>
        <kbd><i class='i-ob-mouse-left' />x2</kbd>
        New File
      </div>
      {!!oneBox.ui.state.rootHasFocus && <div class='ob-status-actionHint'>
        <kbd>Cmd+V</kbd>
        Paste from Clipboard
      </div>}
      <div class='ob-status-actionHint'>
        <kbd><i class="i-mdi-file" /><i class='i-mdi-hand-okay' />Drop</kbd>
        Import Files
      </div>
    </>)}
  >
    <div>
      <p class="text-lg">Create a file to start</p>

      <p class="flex gap-4 justify-center">
        <button class="ob-watermark-bigButton" onClick={() => oneBox.api.createFileAndOpen()}>
          <i class="i-mdi-plus"></i>
          New File
        </button>
        {params.group && <button class="ob-watermark-bigButton" onClick={() => params.containerApi.removeGroup(params.group!)}>
          <i class="i-mdi-close"></i>
          Close this Group
        </button>}
      </p>

      <div class="op-60 mt-16">
        <p>
          <i class="i-mdi-clipboard"></i> Paste from Clipboard? text or file?

          {oneBox.ui.state.rootHasFocus
            ? <span> press Cmd+V</span>
            : <span> click me</span>}
        </p>
        <p>
          <i class="i-mdi-hand-okay"></i> Drag-n-Drop? Accepted!
        </p>
      </div>
    </div>
  </div>;
}
