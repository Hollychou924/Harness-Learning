import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hiddenCountForTurn,
  navigatorMarkHeight,
  navigatorMarkWidth,
  navigatorRowPitch,
  shouldShowNavigator
} from './timelineNavigation'

test('定位已显示轮次时不改变折叠范围', () => {
  assert.equal(hiddenCountForTurn(82, 90), 82)
})

test('定位隐藏轮次时恢复到目标轮次', () => {
  assert.equal(hiddenCountForTurn(82, 50), 50)
  assert.equal(hiddenCountForTurn(82, 0), 0)
})

test('3、20 轮采用固定 20px 节奏，线条厚度 3px', () => {
  assert.equal(navigatorRowPitch(3, 600), 20)
  assert.equal(navigatorMarkHeight(3, 600), 3)
  assert.equal(navigatorRowPitch(20, 600), 20)
  assert.equal(navigatorMarkHeight(20, 600), 3)
})

test('100、230 轮超过窗口容量后压缩间距并减薄线条', () => {
  assert.equal(navigatorRowPitch(100, 600), 6)
  assert.equal(navigatorMarkHeight(100, 600), 1)
  assert.equal(navigatorRowPitch(230, 600), 6)
  assert.equal(navigatorMarkHeight(230, 600), 1)
})

test('悬停时按 52、28、20、12 逐级收回', () => {
  assert.equal(navigatorMarkWidth(0, true), 52)
  assert.equal(navigatorMarkWidth(1, false), 28)
  assert.equal(navigatorMarkWidth(2, false), 20)
  assert.equal(navigatorMarkWidth(3, false), 12)
  assert.equal(navigatorMarkWidth(10, false), 12)
})

test('定位条仅在 ≥4 轮时显示', () => {
  assert.equal(shouldShowNavigator(0), false)
  assert.equal(shouldShowNavigator(1), false)
  assert.equal(shouldShowNavigator(3), false)
  assert.equal(shouldShowNavigator(4), true)
  assert.equal(shouldShowNavigator(20), true)
  assert.equal(shouldShowNavigator(230), true)
})
