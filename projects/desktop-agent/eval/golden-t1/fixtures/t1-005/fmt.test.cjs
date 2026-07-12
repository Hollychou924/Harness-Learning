const test = require('node:test')
const assert = require('node:assert/strict')
const { labelA, labelB } = require('./fmt.cjs')
test('labels', () => {
  assert.equal(labelA(1), 'item:1')
  assert.equal(labelB(2), 'item:2')
})
