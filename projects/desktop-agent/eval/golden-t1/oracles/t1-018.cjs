const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'cache.cjs'), `const store = new Map()
function setCache(userId, value) { store.set(String(userId), value) }
function getCache(userId) { return store.get(String(userId)) }
module.exports = { setCache, getCache }
`)
}
