const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'load.cjs'), `async function fetchValue(){return 42}
async function load(){return await fetchValue()}
module.exports={load}
`)
}
