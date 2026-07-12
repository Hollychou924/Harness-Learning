const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'parseJson.cjs'), `function parseJson(text, fallback) {
  try { return JSON.parse(text) } catch { return fallback }
}
module.exports = { parseJson }
`)
}
