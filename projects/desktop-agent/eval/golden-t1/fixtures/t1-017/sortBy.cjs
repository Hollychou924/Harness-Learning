function sortAsc(nums) {
  // BUG: 降序
  return [...nums].sort((a, b) => b - a)
}
module.exports = { sortAsc }
