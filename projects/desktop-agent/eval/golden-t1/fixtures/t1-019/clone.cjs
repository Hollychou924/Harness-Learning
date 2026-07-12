function cloneUser(user) {
  // BUG: 浅拷贝，嵌套 settings 仍共享
  return { ...user }
}
module.exports = { cloneUser }
