import * as monaco from 'monaco-editor';

export function setupMonacoLanguageDefaults() {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    allowComments: true,
    comments: 'ignore',
    trailingCommas: 'warning',
  })

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.React,
    resolveJsonModule: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  })
}
