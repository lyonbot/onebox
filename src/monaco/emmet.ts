import * as monaco from 'monaco-editor';
import { getMonacoTokenAt } from './utils';

const aliases: Record<string, [tag: string, attrs?: Record<string, string>]> = {
  btn: ['button'],
  inp: ['input'],
  a: ['a', { href: '$1' }],
  img: ['img', { src: '$1' }],
  link: ['link', { rel: 'stylesheet', href: '$1' }],
  option: ['option', { value: '$1' }],
  opt: ['option', { value: '$1' }],
}

const lorem = "Lorem ipsum dolor sit amet consectetur adipisicing elit. OneBox, voluptatum."
const presetTemplate: Record<string, string> = {
  'html:5': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${1:OneBox Quick Page}</title>
</head>
<body>
  $2
</body>
</html>`,
  'script:src': `<script src="$1"></script>`,
  'link:css': `<link rel="stylesheet" href="$1">`,
}
const presetTemplateKeys = Object.keys(presetTemplate)

const emmetSplitterRe = /(?=[{}.#*])/
const emmetTokens = (parts: string[], index: number) => {
  let sweptCount = 0
  let tag = 'div'
  let attrs = {} as Record<string, string>
  let repeat = 1;
  let content = '$9'

  for (; index < parts.length; index++, sweptCount++) {
    const part = parts[index]!.trim()
    const lead = part[0]
    const rest = part.slice(1)

    if (lead === '}') {
      // nest case dirty it up
      parts[index] = rest
      break
    }
    if (lead === '{') {
      if (parts[index + 1]?.startsWith('}')) {
        // pure text situation
        content = rest === 'lorem' ? lorem : rest
        parts[index + 1] = parts[index + 1]!.slice(1)
      } else {
        // recursive case
        parts[index] = rest
        const { text, index: newIndex } = emmetTokens(parts, index)
        content = text
        index = newIndex - 1 // -1 because of `for`
      }
      continue
    }

    if (lead === '.') attrs['class'] = ((attrs['class'] || '') + ' ' + rest).trim()
    else if (lead === '#') attrs = { id: rest, ...attrs }
    else if (lead === '*') repeat = +rest

    if (sweptCount === 0 && /^\w/.test(part)) {
      const alias = aliases[part]
      tag = alias?.[0] || part
      Object.assign(attrs, alias?.[1])
    }
  }

  if (content.includes('\n')) content = `\n${content}\n`

  return {
    text: `<${tag}${Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')}>${content}</${tag}>\n`.repeat(repeat).trim(),
    index,
  }
}

const provideCompletionItems =
  ((model, position) => {
    // a simple completion that convert div.foo to <div class="foo">|</div>

    const t = getMonacoTokenAt(model, position.lineNumber, position.column);
    if (t && (t.isString | t.isComment)) return; // string or comment

    // extract nearest strings

    let textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column + 1, // peek one more, for auto-closing }
    });
    const hasAutoClose = textUntilPosition.endsWith('}') ? 1 : 0
    if (hasAutoClose) textUntilPosition = textUntilPosition.slice(0, -hasAutoClose)

    const match = textUntilPosition.match(/\s?[a-zA-Z.#]([-\w.#*{}]+)?$/)?.[0].trim();
    if (!match || match.length < 3) return;

    const suggestions: { label: string, insertText: string }[] = []
    if (match in presetTemplate === false) suggestions.push({
      label: match,
      insertText: emmetTokens(match.split(emmetSplitterRe), 0).text,
    })
    presetTemplateKeys.filter(x => x.startsWith(match)).forEach(key => {
      suggestions.push({ label: key, insertText: presetTemplate[key] })
    })

    return {
      suggestions: suggestions.map((x, i) => ({
        range: monaco.Range.fromPositions(position, position.delta(0, hasAutoClose)),
        insertText: x.insertText,
        label: x.label,
        documentation: x.insertText,
        kind: monaco.languages.CompletionItemKind.Property,
        preselect: i === 0,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        additionalTextEdits: [
          {
            range: monaco.Range.fromPositions(position.delta(0, -match.length), position),
            text: '',
          },
        ],
      })),
    };
  }) satisfies monaco.languages.CompletionItemProvider['provideCompletionItems']

export function setupMonacoEmmet() {
  monaco.languages.registerCompletionItemProvider(['html', 'typescript'], {
    provideCompletionItems,
  });
}
