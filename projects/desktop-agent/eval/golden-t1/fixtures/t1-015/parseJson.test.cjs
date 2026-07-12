const test = require('node:test')
const assert = require('node:assert/strict')
const { parseJson } = require('./parseJson.cjs')
test('parseJson', () => {
  assert.deepEqual(parseJson('{"a":1}', {}), { a: 1 })
  assert.deepEqual(parseJson('not-json', { ok: false }), { ok: false })
})
