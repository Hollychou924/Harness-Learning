#!/bin/sh
# Alpine Linux 环境初始化脚本
# 由 AlpineBootstrapper 在首次启动时通过 proot 执行

set -e

echo "[1/4] 配置 DNS..."
echo "nameserver 8.8.8.8" > /etc/resolv.conf
echo "nameserver 8.8.4.4" >> /etc/resolv.conf
echo "nameserver 223.5.5.5" >> /etc/resolv.conf

echo "[2/4] 更新包索引..."
apk update

echo "[3/4] 安装 Python3..."
apk add --no-cache python3 py3-pip

echo "[4/4] 安装 Node.js..."
apk add --no-cache nodejs npm

# 验证安装
echo ""
echo "=== 安装验证 ==="
echo "Python: $(python3 --version 2>&1)"
echo "Node.js: $(node --version 2>&1)"
echo "npm: $(npm --version 2>&1)"
echo "pip: $(pip3 --version 2>&1)"
echo ""
echo "Alpine 环境初始化完成！"
