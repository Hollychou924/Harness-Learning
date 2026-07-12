const test = require('node:test')
const assert = require('node:assert/strict')
const { clamp } = require('./utils.cjs')
test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(99, 0, 10), 10)
})
