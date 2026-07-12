const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeKey } = require('./normalizeKey.cjs')
test('trim key', () => {
  assert.equal(normalizeKey('  abc\n'), 'abc')
  assert.equal(normalizeKey('\tsk-1  '), 'sk-1')
})
