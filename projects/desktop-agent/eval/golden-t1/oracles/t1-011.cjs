const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'safeGet.cjs'), `function safeGet(obj, key, fallback) {
  if (obj == null) return fallback
  return obj[key] ?? fallback
}
module.exports = { safeGet }
`)
}
