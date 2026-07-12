function extractTag(html) {
  // BUG: 贪婪匹配跨标签
  const m = html.match(/<b>(.*)<\\/b>/)
  return m ? m[1] : null
}
module.exports = { extractTag }
