const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
module.exports = function apply(workdir) {
  writeFileSync(join(workdir, 'extractTag.cjs'), `function extractTag(html) {
  const m = html.match(/<b>(.*?)<\\/b>/)
  return m ? m[1] : null
}
module.exports = { extractTag }
`)
}
