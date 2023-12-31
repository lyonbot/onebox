/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */
const { mkdirSync, writeFileSync, readFileSync } = require('fs')
const { join } = require('path')

const outFils = {}

mkdirSync('./dist', { recursive: true })
makeLodash()

for (const [name, content] of Object.entries(outFils)) {
  writeFileSync(join('./dist', name+'.d.ts'), content)
}
writeFileSync('./dist/index.js', "export default /** @type {Record<string,string>} */(" + JSON.stringify(outFils, null, 2) + ")")

function makeLodash() {
  const entries = Array.from(
    readFileSync(require.resolve('@types/lodash/index.d.ts'), 'utf-8').matchAll(/path="([^"]+)"/g),
    mat => mat[1]
  )

  const out = ['interface LoDashStatic {}']
  for (const entry of entries) {
    let content = readFileSync(require.resolve(`@types/lodash/${entry}`), 'utf-8')
    content = content.slice(content.indexOf('{') + 1, content.lastIndexOf('}'))
    out.push(content)
  }

  out.push('const _: LoDashStatic')
  out.push('export = _')

  outFils['lodash'] = out.join('\n\n')
}
