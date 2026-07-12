function joinPath(a, b) {
  // BUG: 简单相加，可能出现双斜杠或漏斜杠
  return a + b
}
module.exports = { joinPath }
