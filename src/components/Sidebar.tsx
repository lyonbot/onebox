import { For, createMemo, createSignal } from "solid-js";
import { useOneBox } from "../store";
import { clsx, startMouseMove } from "yon-utils";
import { useLocalStorage, watch } from "~/utils/solid";

const LC_WIDTH = 'oneBox:sidebarWidth';

export function Sidebar() {
  const oneBox = useOneBox();
  const activeFile = createMemo(() => oneBox.store.activePanel?.file);

  const [width, setWidth] = useLocalStorage(LC_WIDTH, x => +x! || 300);

  const [isResizing, setIsResizing] = createSignal(false)

  return <div
    class={clsx("ob-sidebar", { isResizing: isResizing() })}
    style={`flex-basis: ${width()}px; display: ${oneBox.store.showSidebar ? "" : "none"}`}
    tabIndex={0}
    onKeyDown={ev => {
      const file = activeFile()

      if (ev.key === 'F2' || ev.key === 'Enter') {
        ev.preventDefault()
        if (file) {
          const newName = prompt('Rename File', file.filename);
          if (newName) file.filename = newName;
        }
        return
      }

      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        if (file) {
          oneBox.api.deleteFile(file)
        }
        return
      }
    }}
  >
    <div class="ob-sidebar-resizer" onPointerDown={ev => {
      const ow = width();
      ev.preventDefault()
      setIsResizing(true)
      startMouseMove({
        initialEvent: ev,
        onMove: ({ deltaX }) => setWidth(Math.max(100, ow + deltaX)),
        onEnd: () => setIsResizing(false),
      })
    }}></div>

    <div class="ob-sidebar-files">
      <For each={oneBox.store.files}>
        {file => {
          let div!: HTMLDivElement
          const isActive = createMemo(() => file.filename === activeFile()?.filename)
          const isOpened = createMemo(() => oneBox.store.panels.some(p => p.file.filename === file.filename))
          watch(isActive, e => e && div.scrollIntoView(), true)

          return <div
            ref={d => div = d!}
            class={clsx('ob-sidebar-item', {
              isActive: isActive(),
              isOpened: isOpened(),
            })}
            title={file.filename}
            draggable="true"
            onDragStart={ev => {
              ev.dataTransfer!.setData('text/plain', file.filename)
            }}
            onMouseDown={ev => {
              if (ev.button === 1) {
                ev.preventDefault()
                // mid click, close panels or delete file
                if (isOpened()) {
                  // close panel
                  oneBox.updateStore('panels', panels => panels.filter(p => p.file.filename !== file.filename));
                } else {
                  // delete file
                  oneBox.api.deleteFile(file)
                }
              }
            }}
            onClick={(ev) => {
              const index = ev.shiftKey ? -1 : oneBox.store.panels.findIndex(p => p.file.filename === file.filename)
              if (index === -1) {
                oneBox.api.openFile(file, true)
              } else {
                oneBox.updateStore('activePanelIndex', index)
              }
            }}
            onDblClick={() => oneBox.api.openFile(file, true)}
          >
            <div class="ob-sidebar-item-name">{file.filename}</div>
            <div class="ob-sidebar-item-actions">
              <button
                class="ob-sidebar-item-action"
                onClick={ev => {
                  ev.stopPropagation()
                  oneBox.api.deleteFile(file)
                }}
                title={`Delete File "${file.filename}"`}
              >
                <i class='i-mdi-trash-can text-6'></i>
              </button>
            </div>
          </div>
        }}
      </For>
    </div>
  </div>;
}
