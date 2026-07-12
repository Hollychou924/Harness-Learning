const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'sortBy.cjs'), 'function sortAsc(nums){return [...nums].sort((a,b)=>a-b)}\nmodule.exports={sortAsc}\n')
}
