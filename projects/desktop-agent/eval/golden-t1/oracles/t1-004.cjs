const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'greet.cjs'), "/** @param {string} name */\nfunction greet(name){return 'hello '+name}\nmodule.exports={greet}\n")
}
