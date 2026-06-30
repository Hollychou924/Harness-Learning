Alpine Linux 环境 - 资源文件准备说明
======================================

此目录需要放置以下两个二进制文件（不包含在 Git 中，需手动下载）：

1. proot-aarch64
   ─────────────
   预编译的 proot 静态二进制文件（aarch64/arm64 架构）

   下载来源（任选其一）：
   - Termux 预编译: https://github.com/AvironAcadem/proot-portable-android-binaries/releases
   - 自行编译: 从 https://github.com/proot-me/proot 使用 NDK 交叉编译

   下载后重命名为: proot-aarch64
   放置路径: app/src/main/assets/alpine/proot-aarch64

2. alpine-minirootfs-aarch64.tar.gz
   ──────────────────────────────────
   Alpine Linux 最小根文件系统（aarch64 架构）

   下载地址:
   https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/aarch64/

   找到文件: alpine-minirootfs-{版本}-aarch64.tar.gz（约 3.5MB）
   下载后重命名为: alpine-minirootfs-aarch64.tar.gz
   放置路径: app/src/main/assets/alpine/alpine-minirootfs-aarch64.tar.gz

准备完成后目录结构：
  assets/alpine/
  ├── proot-aarch64                         (~1.5MB)
  ├── alpine-minirootfs-aarch64.tar.gz      (~3.5MB)
  ├── setup.sh                              (包安装脚本)
  └── README-SETUP.txt                      (本文件)

注意事项：
- 二进制文件需与目标设备架构匹配（aarch64 = arm64-v8a）
- proot 必须是静态编译版本（static linked），不能依赖动态库
- 这两个文件会使 APK 增加约 5MB
