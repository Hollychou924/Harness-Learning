function isPalindrome(s) {
  // BUG: 大小写未归一
  return s === s.split('').reverse().join('')
}
module.exports = { isPalindrome }
