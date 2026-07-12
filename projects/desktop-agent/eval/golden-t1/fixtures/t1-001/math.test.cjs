const test = require('node:test')
const assert = require('node:assert/strict')
const { add } = require('./math.cjs')

test('add(2,3) === 5', () => {
  assert.equal(add(2, 3), 5)
})
