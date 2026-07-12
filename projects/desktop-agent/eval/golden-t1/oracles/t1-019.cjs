const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'clone.cjs'), `function cloneUser(user) {
  return { ...user, settings: { ...(user.settings || {}) } }
}
module.exports = { cloneUser }
`)
}
