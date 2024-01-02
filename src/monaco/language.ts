import * as monaco from 'monaco-editor';

export function setupMonacoLanguageDefaults() {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    allowComments: true,
    comments: 'ignore',
    trailingCommas: 'warning',
  })

  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    resolveJsonModule: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.AMD,
    typeRoots: ['node_modules/@types'],
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    allowJs: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    outDir: '__out__',
  };
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
}
