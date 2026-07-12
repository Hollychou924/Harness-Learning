/** @param {string} name */
function greet(name) {
  // BUG: 返回了 number，类型契约要求 string
  return 42
}
module.exports = { greet }
