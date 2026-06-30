---
name: "美团外卖"
description: "帮助用户通过美团外卖点餐。当用户提到点外卖、美团、叫外卖等关键词时触发。"
category: utility
enabled: true
---

# Meituan Waimai Ordering (美团外卖点餐)

This skill requires the `browser-automation` skill and Playwright MCP tools.

## Workflow

### Phase 1: Open Meituan
```
browser_navigate("https://waimai.meituan.com")
browser_snapshot()
```
Check if user is logged in by looking for user avatar/name in the snapshot.

### Phase 2: Handle Login
If not logged in (snapshot shows login prompt or no user info):
1. Tell user: "请在浏览器窗口中登录美团账号（支持手机号或微信扫码）。登录完成后告诉我。"
2. Wait for user confirmation
3. Verify: `browser_snapshot()` — confirm logged-in state

### Phase 3: Verify Delivery Address
Read the current delivery address from the page header.
Ask user: "当前配送地址是「XXX」，是否正确？如需修改请告诉我新地址。"

### Phase 4: Search
Based on user request (e.g., "奶茶"):
```
browser_click(ref=SEARCH_BOX)
browser_type(ref=SEARCH_BOX, text="奶茶", submit=true)
browser_wait_for(time=3000)
browser_snapshot()
```
Parse the results and present to user as a numbered list with:
- Shop name
- Rating
- Estimated delivery time
- Minimum order amount
- Monthly sales

### Phase 5: Browse Shop Menu
After user picks a shop:
```
browser_click(ref=SHOP_LINK)
browser_wait_for(time=2000)
browser_snapshot()
```
Parse menu categories and items. Present organized menu to user.

### Phase 6: Add Items to Cart
When user selects items and customizations (size, sugar, ice level):
1. Click the item
2. Select customization options from the modal
3. Click "Add to Cart"
4. Confirm cart contents via snapshot

### Phase 7: Checkout
```
browser_click(ref=CHECKOUT_BTN)
browser_wait_for(time=2000)
browser_snapshot()
```
Read and present order summary:
- Items and quantities
- Subtotal
- Delivery fee
- Discounts/coupons
- Total amount

### Phase 8: Payment Handoff
Tell user: "订单已确认，总计 ¥XX。请在浏览器窗口中选择支付方式并完成支付。支付完成后告诉我。"

**NEVER** attempt to automate payment. This is a security boundary.

### Phase 9: Order Monitoring
After user confirms payment:
```
loop every 30-60 seconds:
  browser_snapshot()
  parse order status (商家已接单 / 骑手已接单 / 骑手已到店 / 配送中 / 已送达)
  if status changed:
    notify user with the new status
  if status == "已送达":
    congratulate user and end monitoring
```

## Tips for Meituan's UI
- The search box is usually in the top navigation area
- Shop listings are in a scrollable list; use `browser_press_key("PageDown")` to load more
- Menu items may be in a left-right split layout: categories on the left, items on the right
- Customization options (甜度/冰量/规格) appear in a modal after clicking an item
- Cart button is typically at the bottom-right of the shop page
- The delivery address selector is in the page header
