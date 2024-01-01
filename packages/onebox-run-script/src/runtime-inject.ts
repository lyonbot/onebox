// this file runs in the context of the sandbox

import lodash from 'lodash'
import JSON5 from 'json5';
import { elt } from "yon-utils";
import { Buffer } from 'buffer'
import { simpleAMD } from './simpleAMD';
import CryptoJS from 'crypto-js/crypto-js'
import jsyaml from 'js-yaml'
import type { OBAPI } from './types/onebox-runtime';

export type SandboxWindow = typeof ctx & { ChiiDevtoolsIframe: HTMLIFrameElement | null };

const ctx = {
  ob: null as any as OBAPI,
  _: lodash,
  Buffer,
  CryptoJS,
  jsyaml,
  yaml: jsyaml,
  JSON5,
  print: (...args: any[]) => console.log(...args),
  React: {
    createElement: elt,
  },
  _oneBoxRuntime: {
    fetchModuleScript: null as (null | ((absolutePath: string) => Promise<string>)),
    amd: simpleAMD(async path => {
      const code = await (window as any)._oneBoxRuntime.fetchModuleScript(path);
      return { runner: new Function('define', code) as any }
    }),
    /** remove all registered module, then register buffer, lodash etc */
    resetAMD() {
      this.amd.reset()
      this.amd.preDefineModule('lodash', lodash)
      this.amd.preDefineModule('buffer', Buffer)
      this.amd.preDefineModule('crypto-js', CryptoJS)
      this.amd.preDefineModule('js-yaml', jsyaml)
    },
  },
}

Object.assign(window, ctx)
