const test = require('node:test')
const assert = require('node:assert/strict')
const { sortAsc } = require('./sortBy.cjs')
test('asc', () => assert.deepEqual(sortAsc([3,1,2]), [1,2,3]))
