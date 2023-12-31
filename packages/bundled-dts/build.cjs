/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */
const { mkdirSync, writeFileSync, readFileSync } = require('fs')
const { join } = require('path')
const outFils = {}

mkdirSync('./dist', { recursive: true })
makeLodash()
makeBuffer()
makeCryptoJS()
makeJsYaml()

for (const [name, content] of Object.entries(outFils)) {
  writeFileSync(join('./dist', name + '.d.ts'), content)
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

function makeBuffer() {
  let content = readFileSync(require.resolve('@types/node/buffer.d.ts'), 'utf-8')

  const lead = 'declare module "buffer" {'
  const tail = 'declare module "node:buffer"'
  content = content.slice(content.indexOf(lead) + lead.length, content.lastIndexOf('}', content.lastIndexOf(tail)))
  content = content.replace(/^.+BinaryLike.+$/m, 'type BinaryLike = string | ArrayBufferView;')
  content = content.replace(/^.+WebReadableStream.+$/m, 'type WebReadableStream = ReadableStream;')

  outFils['buffer'] = content
}

function makeCryptoJS() {
  const content = readFileSync(require.resolve('@types/crypto-js/index.d.ts'), 'utf-8')
  outFils['crypto-js'] = content
}

function makeJsYaml() {
  const content = readFileSync('node_modules/@types/js-yaml/index.d.ts', 'utf-8')
  outFils['js-yaml'] = content
}
