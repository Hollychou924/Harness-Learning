const test = require('node:test')
const assert = require('node:assert/strict')
const { joinPath } = require('./joinPath.cjs')
test('joinPath', () => {
  assert.equal(joinPath('/tmp/ws', 'a.js'), '/tmp/ws/a.js')
  assert.equal(joinPath('/tmp/ws/', 'a.js'), '/tmp/ws/a.js')
  assert.equal(joinPath('/tmp/ws', '/a.js'), '/tmp/ws/a.js')
})
