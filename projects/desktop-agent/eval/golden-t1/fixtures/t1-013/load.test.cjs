const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load.cjs')
test('load awaits', async () => {
  assert.equal(await load(), 42)
})
