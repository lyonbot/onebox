/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require("fs")

const dir = __dirname
const lastModified = fs.statSync(dir).mtime

const icons = {};

fs.readdirSync(dir).forEach((file) => {
  if (!file.endsWith('.svg')) return

  const name = file.replace(/\.svg$/, '')
  const txt = fs.readFileSync(`${dir}/${file}`, 'utf8')
  const body = txt.slice(txt.indexOf('>') + 1, txt.indexOf('</svg>'))
    .replace(/="(#000+|black)"/g, '="currentColor"')

  icons[name] = { body }
})

module.exports = {
  prefix: "ob",
  width: 32,
  height: 32,
  aliases: {},
  icons,
  lastModified,
}
