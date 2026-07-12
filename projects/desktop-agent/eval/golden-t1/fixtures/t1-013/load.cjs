let cached = null
async function fetchValue() {
  return 42
}
async function load() {
  // BUG: 未 await，cached 仍为 null
  fetchValue().then((v) => { cached = v })
  return cached
}
module.exports = { load }
