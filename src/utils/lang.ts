export const enum Lang {
  UNKNOWN = 'unknown',
  YAML = 'yaml',
  JSON = 'json', // in monaco, use jsonc
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  BASE64 = 'base64',
  HEX = 'hex',
  QUERYSTRING = 'querystring',  // like ?foo=bar
  URLENCODED = 'urlencoded', // pure urlencoded, like foo%2Fbar
  TOML = 'toml', // key value, ini, toml, foo=bar
  STRING_LITERAL = 'string_literal',
  MARKDOWN = 'markdown',
  HTML = 'html',
  CSS = 'css', // can be scss
  BINARY = 'binary',
}

export interface LangDescription {
  name: string
  extname?: string // defaults to .txt
  mime?: string // defaults to text/plain
  monacoLanguage?: string // defaults to plain
  altExtname?: string[]
}

export const LangDescriptions: Record<Lang, LangDescription> = {
  unknown: { name: 'Unknown Text' },
  markdown: { name: 'Markdown', extname: '.md', mime: 'text/markdown', monacoLanguage: 'markdown' },
  yaml: { name: 'YAML', extname: '.yaml', mime: 'text/yaml', monacoLanguage: 'yaml', altExtname: ['.yml'] },
  json: { name: 'JSON', extname: '.json', mime: 'application/json', monacoLanguage: 'json' },
  javascript: { name: 'JavaScript', extname: '.js', mime: 'application/javascript', monacoLanguage: 'javascript', altExtname: ['.jsx', '.cjs', '.mjs'] },
  typescript: { name: 'TypeScript', extname: '.tsx', mime: 'application/typescript', monacoLanguage: 'typescript', altExtname: ['.ts'] },
  base64: { name: 'Base64' },
  hex: { name: 'Hex' },
  querystring: { name: 'Query String' },
  urlencoded: { name: 'URL Encoded' },
  toml: { name: 'TOML', extname: '.toml', mime: 'text/toml', monacoLanguage: 'ini', altExtname: ['.ini'] },
  string_literal: { name: 'String Literal' },
  html: { name: 'HTML', extname: '.html', mime: 'text/html', monacoLanguage: 'html' },
  css: { name: 'CSS', extname: '.scss', mime: 'text/css', monacoLanguage: 'scss', altExtname: ['.css', '.less'] },
  binary: {
    name: 'Binary',
    extname: '.bin',
    mime: 'application/octet-stream',
    altExtname: [
      '.ico', '.png', '.jpg', '.gif', '.mp4', '.ogg', '.m4a', '.mp3',
      '.ttf', '.woff', '.woff2', '.eot',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.tgz', '.gz', '.7z',
    ],
  },
}
