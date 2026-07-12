const test = require('node:test')
const assert = require('node:assert/strict')
const { isPalindrome } = require('./isPal.cjs')
test('pal', () => {
  assert.equal(isPalindrome('Abba'), true)
  assert.equal(isPalindrome('hello'), false)
})
