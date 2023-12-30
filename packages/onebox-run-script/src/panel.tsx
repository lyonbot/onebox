/// <reference types="vite/client" />

/* @refresh granular */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Show, createMemo, createSignal, on, onCleanup } from "solid-js"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "~/panels/adaptor"
import { clsx, delay, makePromise, startMouseMove } from "yon-utils"

import { watch } from "~/utils/solid"
import chiiTargetJS from "chii/public/target.js?url"
import { clamp } from "lodash"

export default function RunScriptPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = createMemo(() => oneBox.files.api.getControllerOf(props.params.filename))
  const [sandbox, setSandbox] = createSignal(null as null | { iframe: HTMLIFrameElement, document: Document, window: Window })

  const runScriptConf = createMemo(() => props.params.runScript!)

  watch(() => `▶️ ${file()?.filename}`, title => props.updateParams('title', title))

  watch(sandbox, (sandbox) => {
    if (!sandbox) return

    // adding if(..) to make top-level `let` works in incremental mode
    sandbox.document.write('<script>\nif (1) {\n' + file()?.content + '\n}</script>')
  })

  const [reconstructCounter, setReconstructCounter] = createSignal(0)
  const reconstruct = () => { setReconstructCounter(c => c + 1) }
  const activePanel = () => { props.api.setActive(); wrapperDiv?.dispatchEvent(new MouseEvent('mousedown')) }
  const [isResizing, setIsResizing] = createSignal(false)

  watch(() => runScriptConf().randomKey, () => {
    if (runScriptConf().alwaysReconstruct) {
      // destroy the iframe
      reconstruct()
    } else {
      // just re-run the script
      sandbox()?.document.write('<script>\n' + file()?.content + '\n</script>')
    }
  }, true)

  let wrapperDiv: null | HTMLDivElement = null
  let devtoolIFrame: HTMLIFrameElement | null = null

  const changeAlwaysReconstruct = () => {
    oneBox.prompt('When press F5 in code editor, should the sandbox be reconstructed?', {
      enumOptions: () => [
        { value: '1', label: 'Yes, Always Reconstruct the Sandbox!' },
        { value: '0', label: <div>Nope, just run code (very friendly to <code>var</code>s)</div> },
      ],
    }).then(ans => {
      if (!ans) return // cancel
      props.updateParams('runScript', 'alwaysReconstruct', ans === '1')
    })
  }

  return createMemo(on(reconstructCounter, () => <div class="h-full relative flex flex-col" ref={div => (wrapperDiv = div)}>
    <div class="ob-toolbar">
      <button onClick={changeAlwaysReconstruct}>{
        runScriptConf().alwaysReconstruct ? 'Refreshing Mode' : 'Incremental Mode'
      }</button>
      <button onClick={reconstruct}><i class="i-mdi-refresh"></i> Refresh Sandbox</button>

      <button onClick={() => void props.updateParams('runScript', 'showHTMLPreview', x => !x)}><i class="i-mdi-eye"></i> HTML Preview</button>

    </div>

    <iframe
      allow="clipboard-read *; clipboard-write *"
      src="about:blank"
      class="border-none flex-1 w-full min-h-0"
      ref={el => { devtoolIFrame = el }}
    ></iframe>

    <Show when={runScriptConf().showHTMLPreview}>
      <div class="w-full h-6px my--2px cursor-ns-resize hover:bg-#0002" onPointerDown={ev => {
        ev.preventDefault()
        const oldValue = runScriptConf().htmlPreviewHeight! || 30
        const pixelsPerPoint = sandbox()!.iframe.offsetHeight / oldValue
        setIsResizing(true)
        devtoolIFrame!.style.pointerEvents = 'none'

        startMouseMove({
          initialEvent: ev,
          onMove({ deltaY }) {
            const newValue = -deltaY / pixelsPerPoint + oldValue
            const percentage = clamp(Math.round(newValue), 5, 90)

            props.updateParams('runScript', 'htmlPreviewHeight', percentage)
          },
          onEnd() {
            setIsResizing(false)
            devtoolIFrame!.style.pointerEvents = 'auto'
          },
        })
      }}>
        <div class="h-1px bg-gray-5 mt-2px"></div>
      </div>
    </Show>

    {/* https://stackoverflow.com/questions/61401384/can-text-within-an-iframe-be-copied-to-clipboard#comment124556032_69741484 */}
    <iframe
      allow="clipboard-read *; clipboard-write *"
      src="about:blank"
      class={clsx("border-none w-full ob-darkMode-intact bg-white", isResizing() && 'pointer-events-none')}
      style={`height: ${runScriptConf().showHTMLPreview ? `${runScriptConf().htmlPreviewHeight}%` : '0'}`}
      ref={async el => {
        const retryEnd = Date.now() + 1000
        let doc: Document | undefined

        do {
          try {
            el.contentWindow!.document.createElement;
            doc = el.contentWindow!.document
            doc.write('&nbsp;')
            doc.title = 'ZZZZZ'
          } catch (e) {
            await delay(100)
          }
        } while ((!doc || !devtoolIFrame) && Date.now() < retryEnd)

        if (!doc) {
          console.error('iframe not ready')
          return
        }

        const win = doc.defaultView!;
        (win as any).ChiiDevtoolsIframe = devtoolIFrame

        const waitDevToolReady = makePromise<void>()

        localStorage.setItem('panel-selectedTab', '"console"');

        // setup message forwarding
        const messageForward = (event: MessageEvent): void => {
          win.postMessage(event.data, event.origin)
          if (event.data?.includes?.('Runtime.runIfWaitingForDebugger')) {
            waitDevToolReady.resolve()
          }
        }
        window.addEventListener('message', messageForward);
        onCleanup(() => window.removeEventListener('message', messageForward))

        const script = doc.createElement('script')
        script.src = chiiTargetJS + '#/target.js'   // chii relys on this filename
        script.setAttribute('cdn', 'https://cdn.jsdelivr.net/npm/chii/public')
        script.setAttribute('embedded', 'true')
        doc.body.appendChild(script)

        // ------------------------------
        await waitDevToolReady
        win.addEventListener('focus', activePanel)
        devtoolIFrame!.contentWindow!.addEventListener('focus', activePanel)
        setSandbox({ iframe: el, document: doc, window: win })
      }}
    ></iframe>
  </div>))
}
