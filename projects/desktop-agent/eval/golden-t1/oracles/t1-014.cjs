const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'inRange.cjs'), 'function inRange(day,start,end){return day>=start&&day<=end}\nmodule.exports={inRange}\n')
}
