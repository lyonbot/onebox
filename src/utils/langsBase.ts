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
}

export interface LangDescription {
  name: string
  extname?: string // defaults to .txt
  mime?: string // defaults to text/plain
  monacoLanguage?: string // defaults to plain
}

export const LangDescriptions: Record<Lang, LangDescription> = {
  unknown: { name: '0. Plain Unknown Text' },
  markdown: { name: 'Markdown', extname: '.md', mime: 'text/markdown', monacoLanguage: 'markdown' },
  yaml: { name: 'YAML', extname: '.yaml', mime: 'text/yaml', monacoLanguage: 'yaml' },
  json: { name: 'JSON', extname: '.json', mime: 'application/json', monacoLanguage: 'json' },
  javascript: { name: 'JavaScript', extname: '.jsx', mime: 'application/javascript', monacoLanguage: 'javascript' },
  typescript: { name: 'TypeScript', extname: '.tsx', mime: 'application/typescript', monacoLanguage: 'typescript' },
  base64: { name: 'Base64' },
  hex: { name: 'Hex' },
  querystring: { name: 'Query String' },
  urlencoded: { name: 'URL Encoded' },
  toml: { name: 'TOML', extname: '.toml', mime: 'text/toml', monacoLanguage: 'ini' },
  string_literal: { name: 'String Literal' },
}

export function guessLang(str: string): Lang {
  str = str.trim()

  if (/^.{0,10}['"]/.test(str)) {
    // earlier than json
    return Lang.STRING_LITERAL;
  }

  if (/^#{1,6} .+\n\n/.test(str) || /^(- |\d+\. )/m.test(str)) {
    return Lang.MARKDOWN;
  }

  if (str.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(str)) {
    return Lang.BASE64;
  }

  if (/^([A-Fa-f0-9]{2})+$/.test(str)) {
    return Lang.HEX;
  }

  if (/^\??\w+=/.test(str)) {
    // like ?foo=bar
    return Lang.QUERYSTRING;
  }

  if (/^\w+\s*=\s*\S/m.test(str)) {
    // like foo=bar
    return Lang.TOML;
  }

  if (/^[\w-]+:\s*(\|<?\s*)?(#.*)?$/m.test(str)) {
    return Lang.YAML;
  }

  if (/^[{[]/.test(str)) {
    return Lang.JSON;
  }

  if (/\b(function|var |let |const |=>|return)\b/.test(str)) {
    if (/^(type|interface)\b\w|[\w=]\s*\(\w+\s*:/m.test(str)) return Lang.TYPESCRIPT;
    return Lang.JAVASCRIPT;
  }

  if (/"[\w-]+":/.test(str)) {
    return Lang.JSON;
  }

  if (/%[A-Fa-f0-9]{2}/.test(str)) {
    return Lang.URLENCODED;
  }

  return Lang.UNKNOWN;
}
