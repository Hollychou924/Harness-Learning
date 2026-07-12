const test = require('node:test')
const assert = require('node:assert/strict')
const { cloneUser } = require('./clone.cjs')
test('deep-ish clone settings', () => {
  const a = { name: 'x', settings: { theme: 'dark' } }
  const b = cloneUser(a)
  b.settings.theme = 'light'
  assert.equal(a.settings.theme, 'dark')
  assert.equal(b.settings.theme, 'light')
})
