const test = require('node:test')
const assert = require('node:assert/strict')
const { inRange } = require('./inRange.cjs')
test('inclusive end', () => {
  assert.equal(inRange(1, 1, 3), true)
  assert.equal(inRange(3, 1, 3), true)
  assert.equal(inRange(4, 1, 3), false)
})
