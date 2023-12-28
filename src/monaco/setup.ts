import * as monaco from 'monaco-editor';

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  allowComments: true,
  comments: 'ignore',
  trailingCommas: 'warning',
})
