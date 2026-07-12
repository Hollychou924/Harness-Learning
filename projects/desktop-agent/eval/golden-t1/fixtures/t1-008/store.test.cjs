const test = require('node:test')
const assert = require('node:assert/strict')
const { runConcurrent } = require('./store.cjs')
test('concurrent inc', async () => {
  const got = await runConcurrent(20)
  assert.equal(got, 20)
})
