const test = require('node:test')
const assert = require('node:assert/strict')
const { greet } = require('./greet.cjs')
test('greet returns string', () => {
  assert.equal(typeof greet('a'), 'string')
  assert.equal(greet('a'), 'hello a')
})
