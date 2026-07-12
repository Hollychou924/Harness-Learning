const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'store.cjs'), `async function runConcurrent(n) {
  let value = 0
  for (let i = 0; i < n; i++) value += 1
  return value
}
module.exports = { runConcurrent }
`)
}
