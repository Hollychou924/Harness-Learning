const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'http.cjs'), 'function createClient(opts={}){return{timeout:opts.timeout??10000}}\nmodule.exports={createClient}\n')
}
