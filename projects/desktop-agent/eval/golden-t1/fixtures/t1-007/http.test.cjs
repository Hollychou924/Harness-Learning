const test = require('node:test')
const assert = require('node:assert/strict')
const { createClient } = require('./http.cjs')
test('default timeout 10s', () => {
  assert.equal(createClient().timeout, 10000)
  assert.equal(createClient({ timeout: 3000 }).timeout, 3000)
})
