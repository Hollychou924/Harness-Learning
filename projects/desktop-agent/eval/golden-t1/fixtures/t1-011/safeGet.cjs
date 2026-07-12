function safeGet(obj, key, fallback) {
  // BUG: obj 为 null/undefined 时直接抛错
  return obj[key] ?? fallback
}
module.exports = { safeGet }
