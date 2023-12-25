export const enum Langs {
  UNKNOWN = 'unknown',
  YAML = 'yaml',
  JSON = 'json', // can be json5
  JAVASCRIPT = 'javascript',
  BASE64 = 'base64',
  HEX = 'hex',
  QUERYSTRING = 'querystring',  // like ?foo=bar
  URLENCODED = 'urlencoded', // pure urlencoded, like foo%2Fbar
  TOML = 'toml', // key value, ini, toml, foo=bar
  STRING_LITERAL = 'string_literal',
}

export function guessLang(str: string): Langs {
  str = str.trim()

  if (/^.{0,10}['"]/.test(str)) {
    // earlier than json
    return Langs.STRING_LITERAL;
  }

  if (str.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(str)) {
    return Langs.BASE64;
  }

  if (/^([A-Fa-f0-9]{2})*$/.test(str)) {
    return Langs.HEX;
  }

  if (/^\??\w+=/.test(str)) {
    // like ?foo=bar
    return Langs.QUERYSTRING;
  }

  if (/^\w+\s*=\s*\S/m.test(str)) {
    // like foo=bar
    return Langs.TOML;
  }

  if (/^[\w-]+:\s*(\|<?\s*)?(#.*)?$/m.test(str)) {
    return Langs.YAML;
  }

  if (/^[{[]/.test(str)) {
    return Langs.JSON;
  }

  if (/\b(function|var |let |const |=>|return)\b/.test(str)) {
    return Langs.JAVASCRIPT;
  }

  if (/"[\w-]+":/.test(str)) {
    return Langs.JSON;
  }

  if (/%[A-Fa-f0-9]{2}/.test(str)) {
    return Langs.URLENCODED;
  }

  return Langs.UNKNOWN;
}
