const test = require('node:test')
const assert = require('node:assert/strict')
const { setCache, getCache } = require('./cache.cjs')
test('cache by id', () => {
  setCache('u1', 7)
  assert.equal(getCache('u1'), 7)
})
