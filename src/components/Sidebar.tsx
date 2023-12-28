import { For, createMemo, createSignal, onCleanup } from "solid-js";
import { useOneBox } from "../store";
import { clsx, startMouseMove } from "yon-utils";
import { useLocalStorage, watch } from "~/utils/solid";

const LC_WIDTH = 'oneBox:sidebarWidth';

export function Sidebar(props: { id: string }) {
  const oneBox = useOneBox();
  const activeFile = createMemo(() => {
    const filename = oneBox.panels.state.activePanel?.filename;
    if (!filename) return null;

    return oneBox.files.api.getControllerOf(filename)
  });

  const [width, setWidth] = useLocalStorage(LC_WIDTH, x => +x! || 300);

  const [isResizing, setIsResizing] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)

  watch(hasFocus, f => f && onCleanup(oneBox.ui.api.addActionHint(<>
    {!!activeFile() && <div class='ob-status-actionHint'><kbd>F2</kbd>Rename</div>}
    {!!activeFile() && <div class='ob-status-actionHint'><kbd>Del</kbd>Delete</div>}
  </>)))

  return <div
    id={props.id}
    class={clsx("ob-sidebar", { isResizing: isResizing() })}
    style={`width: ${width()}px; display: ${oneBox.ui.state.showSidebar ? "" : "none"}`}
    tabIndex={0}
    onKeyDown={ev => {
      const file = activeFile()

      if (ev.key === 'F2' || ev.key === 'Enter') {
        ev.preventDefault()
        if (file) {
          const newName = prompt('Rename File', file.filename);
          if (newName) file.setFilename(newName)
        }
        return
      }

      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        file?.delete()
        return
      }
    }}
    onFocusIn={(e) => e.target === e.currentTarget && setHasFocus(true)}
    onFocusOut={(e) => e.target === e.currentTarget && setHasFocus(false)}
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
      <For each={oneBox.files.state.files}>
        {file => {
          let div!: HTMLDivElement
          const isActive = createMemo(() => file.filename === activeFile()?.filename)
          const isOpened = createMemo(() => oneBox.panels.state.panels.find(p => p.filename === file.filename))
          watch(isActive, e => e && div.scrollIntoView(), true)

          return <div
            ref={d => div = d!}
            class={clsx('ob-sidebar-item', {
              isActive: isActive(),
              isOpened: !!isOpened(),
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
                  oneBox.panels.api.closePanel(isOpened()!.id);
                } else {
                  // delete file
                  oneBox.files.api.getControllerOf(file.filename)!.delete()
                }
              }
            }}
            onClick={(ev) => {
              if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return // TODO: make multiple selection
              oneBox.api.openFile(file.filename)
            }}
            onDblClick={(ev) => {
              oneBox.api.openFile(file.filename, (ev.metaKey || ev.ctrlKey) ? 'right' : 'within')
            }}
            onMouseEnter={oneBox.ui.api.getActionHintEvForMouse(<>
              <div class='ob-status-actionHint'>
                <kbd><i class='i-ob-mouse-mid' /></kbd>
                {isOpened() ? 'Close Editor' : <span class="text-red-2">Delete File</span>}
              </div>
              <div class='ob-status-actionHint'>
                <kbd>Cmd+<i class='i-ob-mouse-left' />x2</kbd>
                Open Aside
              </div>
            </>)}
          >
            <div class="ob-sidebar-item-name">{file.filename}</div>
            <div class="ob-sidebar-item-actions">
              <button
                class="ob-sidebar-item-action"
                onClick={ev => {
                  ev.stopPropagation()
                  oneBox.files.api.getControllerOf(file.filename)?.delete()
                }}
                title={`Delete File "${file.filename}"`}
              >
                <i class={clsx('i-mdi-trash-can w-6 h-6', !isOpened() && 'text-red-8 hover:text-red-6')}></i>
              </button>
            </div>
          </div>
        }}
      </For>
    </div>

    <div class="ob-sidebar-footer">
      <a href="#" onClick={e => {
        e.preventDefault();
        if (confirm('All files will be gone. Are you sure?')) {
          oneBox.api.resetProject()
          oneBox.api.saveLastProject()
        }
      }} title="Reset Project">
        <i class="i-mdi-delete-sweep"></i>
      </a>

      <a href="https://github.com/lyonbot/onebox" target="_blank" title="GitHub">
        <i class="i-mdi-github"></i>
      </a>

      <a href="#" onClick={e => {
        e.preventDefault();
        oneBox.ui.api.toggleDarkMode()
      }} title="Toggle Dark Mode">
        {
          oneBox.ui.state.darkMode
            ? <i class='i-mdi-weather-sunny' />
            : <i class='i-mdi-weather-night' />
        }
      </a>
    </div>
  </div>
}
