function pageSlice(items, page, size) {
  const start = (page - 1) * size
  // BUG: end 少了 1
  const end = start + size - 1
  return items.slice(start, end)
}
module.exports = { pageSlice }
