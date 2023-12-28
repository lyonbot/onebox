import { useOneBox } from "~/store"

export function StatusBar(props: { id: string }) {
  const oneBox = useOneBox()

  return <div id={props.id}>
    {oneBox.ui.state.actionHints}
    {/* 
    <i class="i-ob-mouse-left"></i>
    <i class="i-ob-mouse-mid"></i>
  <i class="i-ob-mouse-right"></i> */}
    <br />
  </div>
}