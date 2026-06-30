#!/bin/bash
# 修复 "Can't assign requested address" 的构建脚本
# 用法: ./build-with-fix.sh  或  ./build-with-fix.sh compileDebugKotlin
# 说明：VPN 下 IPv4 回环失效时，gradle.properties 已配置 preferIPv6Addresses，本脚本为备用

set -e
TASK="${1:-assembleDebug}"
./gradlew ":app:$TASK"
