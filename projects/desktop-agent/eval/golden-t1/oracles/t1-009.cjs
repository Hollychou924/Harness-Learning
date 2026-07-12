const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'sum.cjs'), 'function sum(arr){return arr.reduce((a,b)=>a+b,0)}\nmodule.exports={sum}\n')
}
