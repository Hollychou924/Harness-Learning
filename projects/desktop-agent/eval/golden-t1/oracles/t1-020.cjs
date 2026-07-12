const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'normalizeKey.cjs'), `function normalizeKey(value) {
  return String(value).replace(/[\\r\\n\\t]/g, '').trim()
}
module.exports = { normalizeKey }
`)
}
