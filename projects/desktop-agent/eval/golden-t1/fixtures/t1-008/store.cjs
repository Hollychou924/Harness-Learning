// BUG: 并发写入时丢失更新（用确定性错误便于黄金集稳定）
async function runConcurrent(n) {
  return Math.floor(n / 2)
}
module.exports = { runConcurrent }
