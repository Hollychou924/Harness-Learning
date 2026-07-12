function createClient(opts = {}) {
  // BUG: 未暴露 timeout，默认应为 10000
  return { timeout: opts.timeout }
}
module.exports = { createClient }
