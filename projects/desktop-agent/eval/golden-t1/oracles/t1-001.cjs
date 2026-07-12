const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'math.cjs'), 'function add(a,b){return a+b}\nmodule.exports={add}\n')
}
