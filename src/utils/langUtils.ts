import { extname } from "path";
import { Lang, LangDescriptions } from "./lang";

export function guessLangFromName(filename: string, fallback = Lang.UNKNOWN): Lang {
  const e = extname(filename).toLowerCase()
  if (!e) return fallback

  const guess = Object.entries(LangDescriptions).filter(([, desc]) => {
    return desc.extname === e || desc.altExtname?.includes(e)
  }).map(x => x[0] as Lang)

  return guess.includes(fallback) ? fallback : guess[0] || fallback
}

export function guessLangFromContent(str: string): Lang {
  str = str.trim();

  if (/^#{1,6} .+\n\n/.test(str) || /^(- |\d+\. |```\w*$)|\[[^\]\n]*\]\([^)\n]+\)$/m.test(str)) {
    // markdown: detecting by heading, list, code block, link at end of line
    return Lang.MARKDOWN;
  }

  if (str.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(str)) {
    return Lang.BASE64;
  }

  if (/^([A-Fa-f0-9]{2})+$/.test(str)) {
    return Lang.HEX;
  }

  if (/^<\w+/.test(str)) {
    return Lang.HTML;
  }

  if (/^@import/.test(str) || /^(body|html|butt|div|[.#]\w)/m.test(str)) {
    return Lang.CSS;
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

  if (/\b(function|var |let |const |=>|return)\b/.test(str) || /^print\(/m.test(str)) {
    if (/^(type|interface)\b\w|[\w=]\s*\(\w+\s*:/m.test(str)) return Lang.TYPESCRIPT;
    return Lang.JAVASCRIPT;
  }

  if (/"[\w-]+":/.test(str)) {
    return Lang.JSON;
  }

  if (/%[A-Fa-f0-9]{2}/.test(str)) {
    return Lang.URLENCODED;
  }

  if (/^.{0,10}['"]/.test(str)) {
    // earlier than json
    return Lang.STRING_LITERAL;
  }

  return Lang.UNKNOWN;
}
