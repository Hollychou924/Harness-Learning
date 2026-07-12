const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'joinPath.cjs'), `function joinPath(a, b) {
  const left = String(a).replace(/\\/+$/, '')
  const right = String(b).replace(/^\\/+/, '')
  return left + '/' + right
}
module.exports = { joinPath }
`)
}
