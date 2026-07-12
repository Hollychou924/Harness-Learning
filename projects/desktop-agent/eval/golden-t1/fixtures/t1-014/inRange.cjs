function inRange(day, start, end) {
  // BUG: 用 < end，末日被排除
  return day >= start && day < end
}
module.exports = { inRange }
