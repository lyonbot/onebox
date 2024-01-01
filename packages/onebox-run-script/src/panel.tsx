/// <reference types="vite/client" />

/* @refresh granular */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { clamp } from "lodash"
import * as monaco from 'monaco-editor'
import { clsx, delay, makePromise, startMouseMove } from "yon-utils"
import { Show, createMemo, createSignal, getOwner, on, onCleanup, runWithOwner } from "solid-js"
import { Lang } from "~/utils/lang"
import { useOneBox } from "~/store"
import { AdaptedPanelProps } from "~/panels/adaptor"
import { addListener, watch } from "~/utils/solid"

import chiiTargetJS from "chii/public/target.js?url"
import runtimeInjectJS from "../dist/runtime-inject.js?url"
import { obFactory } from "./runtime-api"
import type { VTextFileController } from '~/store/files'
import type { SandboxWindow } from './runtime-inject'

export default function RunScriptPanel(props: AdaptedPanelProps) {
  const oneBox = useOneBox()
  const file = createMemo(() => oneBox.api.getFile(props.params.filename))


  async function transpile(file: VTextFileController): Promise<{ code: string, isAMD?: boolean }> {
    let { content } = file

    // transpile TS, ESM, JSX
    if (file.lang === Lang.TYPESCRIPT || /^(import|export)\s/m.test(content) || (file.lang === Lang.JAVASCRIPT && /<\w+/.test(content))) {
      const tsWorkerGetter = await monaco.languages.typescript[file.lang === Lang.TYPESCRIPT ? 'getTypeScriptWorker' : 'getJavaScriptWorker']()
      const ts = await tsWorkerGetter()
      const out = await ts.getEmitOutput('file:///' + encodeURI(file.filename))

      content = out.outputFiles[0].text
    }

    const isAMD = /^define\(/m.test(content)
    return { code: content, isAMD }
  }



  const [sandbox, setSandbox] = createSignal(null as null | {
    iframe: HTMLIFrameElement,
    document: Document,
    window: Window & typeof globalThis & SandboxWindow,
  })
  const obApi = createMemo(() => file() && obFactory()(file()!, () => sandbox()!.window))
  const runScriptInSandbox = async () => {
    const { document, window } = sandbox()!;

    // adding if(..) to make top-level `let` works in incremental mode
    window.console.log('%cOneBox execute at %s', 'color: #0a0', new Date().toLocaleTimeString())
    window.ob = obApi()!

    try {
      window._oneBoxRuntime.resetAMD()
      const out = await transpile(file()!)
      if (!out.isAMD) {
        // just run in window
        document.write('<script>\nif (1) {\n' + out.code + '\n}</script>')
      } else {
        // start a new AMD session
        window._oneBoxRuntime.amd.fetchModule(file()!.filename)
      }
    } catch (err) {
      window.console.error('[OneBox] Failed to execute', err)
    }
  }

  const runScriptConf = createMemo(() => props.params.runScript!)

  watch(() => `▶️ ${file()?.filename}`, title => props.updateParams('title', title))

  watch(sandbox, (sandbox) => sandbox && runScriptInSandbox())

  const [reconstructCounter, setReconstructCounter] = createSignal(0)
  const reconstruct = () => { setReconstructCounter(c => c + 1) }
  const activePanel = () => { props.api.setActive(); wrapperDiv?.dispatchEvent(new MouseEvent('mousedown')) }
  const [isResizing, setIsResizing] = createSignal(false)

  watch(() => runScriptConf().randomKey, () => {
    const mode = runScriptConf().mode ?? 'refreshing'
    if (mode === 'refreshing') {
      // destroy the iframe
      reconstruct()
    } else {
      // just re-run the script
      runScriptInSandbox()
    }
  }, true)

  let wrapperDiv: null | HTMLDivElement = null
  let devtoolIFrame: HTMLIFrameElement | null = null

  const changeRunnerMode = () => {
    oneBox.prompt('How to re-run? (eg. press F5 in code editor)', {
      enumOptions: () => [
        { value: 'refreshing', label: 'Always refresh the whole Sandbox!' },
        { value: 'incremental', label: 'Retain existing variables in iframe when re-run. I\'ll manually refresh.' },
      ],
    }).then(ans => {
      if (!ans) return // cancel
      props.updateParams('runScript', 'mode', ans as any)
    })
  }

  // focus kludge between devtool and editor
  const [justPointerDownAtDevTool, setJustPointerDownAtDevTool] = createSignal(false)

  const constructSandbox = () => {
    const owner = getOwner()
    onCleanup(() => setSandbox(null))
    const initializeFromSandboxIframe = async (el: HTMLIFrameElement) => {
      const retryEnd = Date.now() + 1000
      let doc: Document | undefined

      do {
        try {
          el.contentWindow!.document.createElement
          doc = el.contentWindow!.document
          doc.write('onebox')
          doc.title = 'OneBox Sandbox'
          doc.location.hash = '#sandbox'

          const preload = doc.createElement('link')
          preload.rel = 'preload'
          preload.as = 'script'
          preload.href = runtimeInjectJS
          preload.crossOrigin = "anonymous"
          doc.head.appendChild(preload)
        } catch (e) {
          await delay(100)
        }
      } while ((!doc || !devtoolIFrame) && Date.now() < retryEnd)

      if (!doc) {
        console.error('iframe not ready')
        return
      }

      const win = doc.defaultView as unknown as Window & typeof globalThis & SandboxWindow;
      win.ChiiDevtoolsIframe = devtoolIFrame

      const waitDevToolReady = makePromise<void>()

      if (!localStorage.getItem('panel-selectedTab')) localStorage.setItem('panel-selectedTab', '"console"')
      if (!localStorage.getItem('uiTheme')) localStorage.setItem('uiTheme', '"default"') // light theme


      // setup message forwarding
      const messageForward = (event: MessageEvent): void => {
        win.postMessage(event.data, event.origin)
        if (event.data?.includes?.('Runtime.runIfWaitingForDebugger')) {
          waitDevToolReady.resolve()
        }
      }
      runWithOwner(owner, () => addListener(window, 'message', messageForward))

      doc.body.textContent = ""

      const runtimeScript = doc.createElement('script')
      runtimeScript.src = runtimeInjectJS
      runtimeScript.type = 'module'
      runtimeScript.async = true
      doc.body.appendChild(runtimeScript)

      const script = doc.createElement('script')
      script.src = chiiTargetJS + '#/target.js' // chii relys on this filename
      script.async = true
      script.setAttribute('cdn', 'https://cdn.jsdelivr.net/npm/chii/public')
      script.setAttribute('embedded', 'true')
      doc.body.appendChild(script)

      // ------------------------------
      await waitDevToolReady
      win.addEventListener('focus', activePanel)
      devtoolIFrame!.contentWindow!.addEventListener('focus', activePanel)
      devtoolIFrame!.contentWindow!.addEventListener('pointerdown', () => setJustPointerDownAtDevTool(true))
      devtoolIFrame!.contentWindow!.addEventListener('pointerup', () => void setTimeout(() => setJustPointerDownAtDevTool(false), 100))

      // ------------------------------
      // wait for ./runtime-api flag set, and setup AMD
      {
        const waitEnd = Date.now() + 10000;
        while (!win._oneBoxRuntime && Date.now() < waitEnd) await delay(50);
        if (!win._oneBoxRuntime) throw new Error('OneBox runtime not ready');

        win._oneBoxRuntime.fetchModuleScript =
          async (rawName: string) => {
            let filename = rawName
            if (filename.startsWith('./')) filename = filename.slice(2)

            const file = oneBox.api.getFile(oneBox.files.api.completeFilename(decodeURI(filename)))
            if (!file) throw new Error(`File not found: ${rawName}`)

            const out = await transpile(file)

            let code = out.code
            if (!out.isAMD) code = 'define([], function() {\n' + code + '\n})'

            return code
          }
      }

      setSandbox({ iframe: el, document: doc, window: win })
    }

    // ------------------------------
    // the resizer between devtool and html preview
    const resizer = <Show when={runScriptConf().showHTMLPreview}>
      <div class="w-full h-6px my--2px cursor-ns-resize hover:bg-#0002" onPointerDown={ev => {
        const sandboxIframe = sandbox()?.iframe
        if (!sandboxIframe || !devtoolIFrame) return

        ev.preventDefault()
        const oldValue = runScriptConf().htmlPreviewHeight! || 30
        const pixelsPerPoint = sandboxIframe.offsetHeight / oldValue
        setIsResizing(true)
        devtoolIFrame.style.pointerEvents = 'none'

        startMouseMove({
          initialEvent: ev,
          onMove({ deltaY }) {
            const newValue = -deltaY / pixelsPerPoint + oldValue
            const percentage = clamp(Math.round(newValue), 5, 90)

            props.updateParams('runScript', 'htmlPreviewHeight', percentage)
          },
          onEnd() {
            setIsResizing(false)
            devtoolIFrame!.style.pointerEvents = ''
          },
        })
      }}>
        <div class="h-1px bg-gray-5 mt-2px"></div>
      </div>
    </Show>

    // ------------------------------
    // 2 iframe + 1 resizer
    return (<>
      <iframe
        allow="clipboard-read *; clipboard-write *"
        src="about:blank"
        class="border-none flex-1 w-full min-h-0"
        ref={el => { devtoolIFrame = el }}
        data-iframe-role={justPointerDownAtDevTool() ? '' : "onebox-run-script:devtool"}
      ></iframe>

      {resizer}

      {/* https://stackoverflow.com/questions/61401384/can-text-within-an-iframe-be-copied-to-clipboard#comment124556032_69741484 */}
      <iframe
        allow="clipboard-read *; clipboard-write *"
        src="about:blank"
        class={clsx("border-none w-full ob-darkMode-intact bg-white", (isResizing() || !sandbox()) && 'pointer-events-none')}
        style={`height: ${runScriptConf().showHTMLPreview ? `${runScriptConf().htmlPreviewHeight}%` : '0'}`}
        ref={initializeFromSandboxIframe}
      ></iframe>
    </>
    )
  }

  const sandboxBody = createMemo(on(reconstructCounter, constructSandbox))

  return <div
    class="h-full relative flex flex-col"
    ref={div => (wrapperDiv = div)}
  >
    <div class="ob-toolbar">
      <button onClick={changeRunnerMode}>
        <i class="i-mdi-cog-play"></i> mode: {runScriptConf().mode}
      </button>
      <button onClick={reconstruct}><i class="i-mdi-refresh"></i> Refresh Sandbox</button>

      <button onClick={() => void props.updateParams('runScript', 'showHTMLPreview', x => !x)}><i class="i-mdi-eye"></i> HTML Preview</button>
    </div>

    {!sandbox() && <div class="absolute translate--50% left-50% top-50% bg-#fff9 pointer-events-none">
      <i class="i-mdi-timer-sand-full"></i>
      Sandbox Loading...
    </div>}

    {sandboxBody()}
  </div>
}
