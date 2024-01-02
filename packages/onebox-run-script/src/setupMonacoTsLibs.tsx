import { forEach } from 'lodash';
import * as monaco from 'monaco-editor';
import bundledDts from '@onebox/bundled-dts';
import typesFileContent from './types/onebox-runtime.d.ts?raw';

export function setupMonacoTsLibs() {
  const obAPIDts = [
    'declare module "onebox-run-script-runtime" {',
    typesFileContent,
    '}',
    '',
    'declare const ob: import("onebox-run-script-runtime").OBAPI',
    'declare const _: typeof import("lodash")',
    '/** same as `console.log()` */',
    'declare function print(...args: any[]): void',
  ].join('\n');
  forEach(bundledDts, (content, packageId) => {
    const filename = 'file:///node_modules/@types/' + packageId + '/index.d.ts';
    monaco.languages.typescript.javascriptDefaults.addExtraLib(content, filename);
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filename);

    // avoid weird auto-fix of monaco: "import missing XXX from node_modules/@types/XXX"
    const pkgContent = JSON.stringify({ name: packageId, version: '0.0.0', types: "./index.d.ts" });
    const pkgFilename = 'file:///node_modules/@types/' + packageId + '/package.json';
    monaco.languages.typescript.javascriptDefaults.addExtraLib(pkgContent, pkgFilename);
    monaco.languages.typescript.typescriptDefaults.addExtraLib(pkgContent, pkgFilename);
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(obAPIDts, "file:///__runtime__/onebox-run-script-runtime/index.d.ts");
  monaco.languages.typescript.typescriptDefaults.addExtraLib(obAPIDts, "file:///__runtime__/onebox-run-script-runtime/index.d.ts");
}
