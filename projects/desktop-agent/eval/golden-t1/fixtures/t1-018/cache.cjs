const store = new Map()
function setCache(userId, value) {
  // BUG: 用对象当 key，下次查不到
  store.set({ id: userId }, value)
}
function getCache(userId) {
  return store.get({ id: userId })
}
module.exports = { setCache, getCache }
