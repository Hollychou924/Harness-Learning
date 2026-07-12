const test = require('node:test')
const assert = require('node:assert/strict')
const { sum } = require('./sum.cjs')
test('sum', () => assert.equal(sum([1,2,3]), 6))
