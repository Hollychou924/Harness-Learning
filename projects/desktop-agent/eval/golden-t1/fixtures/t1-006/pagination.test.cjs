const test = require('node:test')
const assert = require('node:assert/strict')
const { pageSlice } = require('./pagination.cjs')
test('pageSlice', () => {
  const items = [1,2,3,4,5]
  assert.deepEqual(pageSlice(items, 1, 2), [1,2])
  assert.deepEqual(pageSlice(items, 2, 2), [3,4])
  assert.deepEqual(pageSlice(items, 3, 2), [5])
})
