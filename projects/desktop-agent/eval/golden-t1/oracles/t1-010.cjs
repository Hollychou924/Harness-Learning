const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'isPal.cjs'), `function isPalindrome(s){const t=s.toLowerCase();return t===t.split('').reverse().join('')}
module.exports={isPalindrome}
`)
}
