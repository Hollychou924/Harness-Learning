const test = require('node:test')
const assert = require('node:assert/strict')
const { safeGet } = require('./safeGet.cjs')
test('safeGet', () => {
  assert.equal(safeGet({ a: 1 }, 'a', 0), 1)
  assert.equal(safeGet(null, 'a', 0), 0)
  assert.equal(safeGet(undefined, 'a', 9), 9)
})
