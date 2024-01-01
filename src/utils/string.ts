export function getRangeInsideDelim(text: string, pos: number, delim: RegExp) {
  let start = pos;
  let end = pos;

  while (start >= 0 && !delim.test(text[start - 1])) start--;
  while (end < text.length && !delim.test(text[end])) end++;

  return { start, end };
}
