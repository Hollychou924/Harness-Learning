const test = require('node:test')
const assert = require('node:assert/strict')
const { extractTag } = require('./extractTag.cjs')
test('non-greedy', () => {
  assert.equal(extractTag('<b>one</b> and <b>two</b>'), 'one')
})
