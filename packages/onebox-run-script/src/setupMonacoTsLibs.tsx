import { forEach } from 'lodash';
import * as monaco from 'monaco-editor';
import bundledDts from '@onebox/bundled-dts';
import typesFileContent from './types?raw';

export function setupMonacoTsLibs() {
  const obAPIDts = [
    'declare module "onebox-run-script-runtime" {',
    typesFileContent,
    '}',
    'declare const ob: import("onebox-run-script-runtime").OBAPI',
    'declare const _: typeof import("lodash")',
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
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    resolveJsonModule: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.AMD,
    typeRoots: ['node_modules/@types'],
    allowSyntheticDefaultImports: true,
    allowJs: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    outDir: '__out__',
  };
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
}
