import { useOneBox } from "~/store"

export function StatusBar(props: { id: string }) {
  const oneBox = useOneBox()

  return <div id={props.id}>
    <button class="ob-status-button" title="Toggle Sidebar"
      onClick={() => oneBox.ui.api.toggleSidebar()}
      onMouseEnter={oneBox.ui.api.getActionHintEvFor(<>
        <div class='ob-status-actionHint'>
          <kbd>Cmd+B</kbd>
          Toggle Sidebar
        </div>
      </>)}
    >
      <i class="i-mdi-dock-left"></i>
    </button>
    {oneBox.ui.state.actionHints}
    <br />
  </div>
}
