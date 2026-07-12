function sum(arr) {
  // BUG: 漏掉第一个元素
  return arr.slice(1).reduce((a,b)=>a+b,0)
}
module.exports = { sum }
