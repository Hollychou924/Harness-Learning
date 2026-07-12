function parseJson(text, fallback) {
  // BUG: 非法 JSON 直接抛
  return JSON.parse(text)
}
module.exports = { parseJson }
