const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'utils.cjs'), 'function clamp(n,min,max){return Math.min(max,Math.max(min,n))}\nmodule.exports={clamp}\n')
}
