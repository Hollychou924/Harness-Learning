const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'pagination.cjs'), 'function pageSlice(items,page,size){const start=(page-1)*size;return items.slice(start,start+size)}\nmodule.exports={pageSlice}\n')
}
