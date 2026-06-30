#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APK 打包前数据保留检查脚本
===============================

该脚本在打包 APK 完成后自动执行，检查以下内容：
1. 签名配置是否正确
2. 包名是否变更
3. versionCode 是否递增
4. 数据库版本是否变更（需要迁移）
5. SharedPreferences 文件名是否变更
6. 文件存储路径是否变更

如果检测到数据库版本变更但缺少迁移，会发出强烈警告！

使用方法：
    python scripts/check_data_preservation.py [--baseline baseline.json] [--save-baseline]

作者: 超级记忆开发团队
"""

import os
import re
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime

# 颜色输出
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.CYAN}{Colors.BOLD}{'=' * 60}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}  {text}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}{'=' * 60}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_critical(text):
    print(f"\n{Colors.RED}{Colors.BOLD}{'!' * 60}{Colors.END}")
    print(f"{Colors.RED}{Colors.BOLD}  ⛔ 严重警告: {text}{Colors.END}")
    print(f"{Colors.RED}{Colors.BOLD}{'!' * 60}{Colors.END}\n")

def print_info(text):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

class DataPreservationChecker:
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.app_dir = self.project_root / "app"
        self.src_dir = self.app_dir / "src" / "main"
        self.issues = []
        self.warnings = []
        self.current_state = {}
        self.build_gradle = self.app_dir / "build.gradle.kts"
        self.build_gradle_content = self._read_text(self.build_gradle) if self.build_gradle.exists() else ""

    def _read_text(self, path):
        return path.read_text(encoding='utf-8', errors='ignore')

    def _extract_first(self, pattern, content=None):
        target = self.build_gradle_content if content is None else content
        match = re.search(pattern, target)
        return match.group(1) if match else None

    def _extract_application_id(self):
        return self._extract_first(r'applicationId\s*=\s*"([^"]+)"')

    def _extract_namespace(self):
        return self._extract_first(r'namespace\s*=\s*"([^"]+)"')

    def _extract_release_keystore(self):
        release_block = self._extract_first(r'create\("release"\)\s*\{([\s\S]*?)\n\s*\}')
        if not release_block:
            return None
        return self._extract_first(r'storeFile\s*=\s*file\("([^"]+)"\)', release_block)

    def _find_database_file(self):
        package_name = self.current_state.get("package_name") or self._extract_application_id()
        candidates = []

        if package_name:
            preferred = self.src_dir / "java" / Path(*package_name.split(".")) / "data" / "MemoryDatabase.kt"
            if preferred.exists():
                return preferred

        candidates.extend(sorted(self.src_dir.rglob("MemoryDatabase.kt")))
        if candidates:
            return candidates[0]

        for kt_file in sorted((self.src_dir / "java").rglob("*.kt")):
            content = self._read_text(kt_file)
            if "@Database(" in content and "RoomDatabase" in content:
                return kt_file

        return None
    
    def check_all(self):
        """执行所有检查"""
        print_header("🔍 APK 数据保留完整性检查")
        print(f"项目路径: {self.project_root}\n")
        
        checks = [
            ("签名配置", self.check_signing_config),
            ("包名", self.check_package_name),
            ("版本号", self.check_version_code),
            ("数据库配置", self.check_database),
            ("SharedPreferences", self.check_shared_preferences),
            ("文件存储路径", self.check_file_storage),
        ]
        
        for name, check_func in checks:
            print(f"\n{Colors.BOLD}检查 {name}...{Colors.END}")
            try:
                check_func()
            except Exception as e:
                print_error(f"检查 {name} 时发生错误: {e}")
                self.issues.append(f"{name}: 检查失败 - {e}")
    
    def check_signing_config(self):
        """检查签名配置"""
        if not self.build_gradle.exists():
            print_error("找不到 build.gradle.kts")
            self.issues.append("找不到 build.gradle.kts 文件")
            return
        content = self.build_gradle_content
        
        # 检查是否配置了签名
        if "signingConfigs" in content and 'create("release")' in content:
            print_success("签名配置存在")
            self.current_state["signing_config"] = True
        else:
            print_warning("未找到 release 签名配置")
            self.warnings.append("建议配置统一的 release 签名")
            self.current_state["signing_config"] = False
        
        # 检查 debug buildType 是否使用 release 签名
        if 'debug {' in content and 'signingConfig = signingConfigs.getByName("release")' in content:
            print_success("Debug 构建使用统一签名")
        else:
            print_warning("Debug 构建未使用统一签名，升级时可能丢失数据")
            self.warnings.append("建议 Debug 也使用 release 签名")
        
        # 检查实际配置的 keystore 文件
        keystore_relative_path = self._extract_release_keystore()
        if not keystore_relative_path:
            print_error("无法从 release 签名配置中提取 storeFile")
            self.issues.append("无法提取 release keystore 配置")
            self.current_state["keystore_exists"] = False
            return

        keystore_file = self.app_dir / keystore_relative_path
        if keystore_file.exists():
            print_success(f"签名文件存在: {keystore_file.name}")
            self.current_state["keystore_exists"] = True
            self.current_state["keystore_file"] = keystore_relative_path
        else:
            print_error(f"签名文件不存在: {keystore_relative_path}")
            self.issues.append(f"缺少签名文件: {keystore_relative_path}")
            self.current_state["keystore_exists"] = False
    
    def check_package_name(self):
        """检查包名"""
        # 提取 applicationId
        package_name = self._extract_application_id()
        namespace = self._extract_namespace()

        if package_name:
            print_success(f"包名: {package_name}")
            self.current_state["package_name"] = package_name
        else:
            print_error("无法从 build.gradle.kts 提取包名")
            self.issues.append("无法提取包名")

        if namespace:
            self.current_state["namespace"] = namespace
            if package_name == namespace:
                print_success("namespace 与 applicationId 一致")
            else:
                print_warning(f"namespace 与 applicationId 不一致: {namespace}")
    
    def check_version_code(self):
        """检查版本号"""
        content = self.build_gradle_content
        
        # 提取 versionCode
        match = re.search(r'versionCode\s*=\s*(\d+)', content)
        if match:
            version_code = int(match.group(1))
            print_success(f"versionCode: {version_code}")
            self.current_state["version_code"] = version_code
            
            if version_code <= 0:
                print_error("versionCode 必须大于 0")
                self.issues.append("versionCode 无效")
        else:
            print_error("无法从 build.gradle.kts 提取 versionCode")
            self.issues.append("无法提取 versionCode")
        
        # 提取 versionName
        match = re.search(r'versionName\s*=\s*"([^"]+)"', content)
        if match:
            version_name = match.group(1)
            print_success(f"versionName: {version_name}")
            self.current_state["version_name"] = version_name
    
    def check_database(self):
        """检查数据库配置（最重要的检查）"""
        db_file = self._find_database_file()
        if not db_file or not db_file.exists():
            print_error(f"找不到数据库文件: {db_file}")
            self.issues.append("找不到 MemoryDatabase.kt")
            return

        print_success(f"数据库文件: {db_file.relative_to(self.project_root)}")
        self.current_state["database_file"] = str(db_file.relative_to(self.project_root))
        content = self._read_text(db_file)
        
        # 提取数据库版本
        match = re.search(r'version\s*=\s*(\d+)', content)
        if match:
            db_version = int(match.group(1))
            print_success(f"数据库版本: {db_version}")
            self.current_state["db_version"] = db_version
        else:
            print_error("无法提取数据库版本")
            self.issues.append("无法提取数据库版本")
            return
        
        # 检查是否有 fallbackToDestructiveMigration（排除注释）
        # 使用正则匹配未被注释的调用
        has_dangerous_fallback = False
        for line in content.split('\n'):
            line_stripped = line.strip()
            # 跳过注释行
            if line_stripped.startswith('//') or line_stripped.startswith('*'):
                continue
            # 检查是否有未注释的 fallbackToDestructiveMigration
            if '.fallbackToDestructiveMigration()' in line and '//' not in line.split('.fallbackToDestructiveMigration')[0]:
                has_dangerous_fallback = True
                break
        
        if has_dangerous_fallback:
            print_critical("检测到 fallbackToDestructiveMigration() - 这会导致用户数据丢失!")
            self.issues.append("⛔ 危险：存在 fallbackToDestructiveMigration()，迁移失败时会清空所有数据")
        else:
            print_success("未使用 fallbackToDestructiveMigration (安全)")
        
        # 检查迁移链完整性
        migrations = sorted(set(re.findall(r'MIGRATION_(\d+)_(\d+)', content)))
        if migrations:
            print_info(f"找到 {len(migrations)} 个迁移定义")
            self.current_state["migrations"] = migrations
            
            # 验证迁移链
            migration_dict = {}
            for from_v, to_v in migrations:
                migration_dict[int(from_v)] = int(to_v)
            
            # 检查是否所有版本都有迁移路径
            defined_migrations = set()
            for from_v, to_v in migrations:
                defined_migrations.add((int(from_v), int(to_v)))
            
            print_info(f"迁移链: {', '.join([f'{f}→{t}' for f, t in sorted(defined_migrations)])}")
            
            # 检查 addMigrations 中是否包含所有定义的迁移
            add_migrations_match = re.search(r'\.addMigrations\(([\s\S]*?)\)', content)
            if add_migrations_match:
                added_migrations = add_migrations_match.group(1)
                missing = []
                for from_v, to_v in migrations:
                    migration_name = f"MIGRATION_{from_v}_{to_v}"
                    if migration_name not in added_migrations:
                        missing.append(migration_name)
                
                if missing:
                    print_warning(f"以下迁移已定义但未添加到 addMigrations(): {', '.join(missing)}")
                    self.warnings.append(f"迁移未注册: {', '.join(missing)}")
                else:
                    print_success("所有迁移都已正确注册")
        elif db_version > 1:
            print_warning("未找到任何数据库迁移定义")
            self.warnings.append("未定义数据库迁移")
        else:
            print_info("当前是初始数据库版本，无需迁移")
        
        db_name_match = re.search(r'databaseBuilder\([\s\S]*?"([^"]+)"\s*\)', content)
        if db_name_match:
            db_name = db_name_match.group(1)
            print_success(f"数据库名称: {db_name}")
            self.current_state["database_name"] = db_name

        # 提取所有实体类
        entities_match = re.search(r'entities\s*=\s*\[([\s\S]*?)\]', content)
        if entities_match:
            entities_str = entities_match.group(1)
            entities = re.findall(r'(\w+)::class', entities_str)
            print_info(f"数据库实体 ({len(entities)}个): {', '.join(entities[:5])}{'...' if len(entities) > 5 else ''}")
            self.current_state["entities"] = entities
    
    def check_shared_preferences(self):
        """检查 SharedPreferences 使用情况"""
        java_dir = self.src_dir / "java"
        
        prefs_names = set()
        for kt_file in java_dir.rglob("*.kt"):
            try:
                content = kt_file.read_text()
                # 查找 getSharedPreferences 调用
                matches = re.findall(r'getSharedPreferences\(\s*"([^"]+)"', content)
                prefs_names.update(matches)
            except Exception:
                pass
        
        if prefs_names:
            print_success(f"SharedPreferences 文件 ({len(prefs_names)}个):")
            for name in sorted(prefs_names):
                print(f"    - {name}")
            self.current_state["shared_preferences"] = list(prefs_names)
        else:
            print_info("未检测到 SharedPreferences 使用")
    
    def check_file_storage(self):
        """检查文件存储路径"""
        java_dir = self.src_dir / "java"
        
        storage_patterns = [
            (r'getExternalFilesDir\([^)]*\)', "外部应用私有目录"),
            (r'getFilesDir\(\)', "内部应用目录"),
            (r'Environment\.getExternalStoragePublicDirectory', "外部公共目录"),
            (r'"超级记忆"', "超级记忆文件夹"),
        ]
        
        found_patterns = {}
        for kt_file in java_dir.rglob("*.kt"):
            try:
                content = kt_file.read_text()
                for pattern, desc in storage_patterns:
                    if re.search(pattern, content):
                        if desc not in found_patterns:
                            found_patterns[desc] = []
                        found_patterns[desc].append(kt_file.name)
            except Exception:
                pass
        
        if found_patterns:
            print_success("文件存储位置:")
            for desc, files in found_patterns.items():
                unique_files = list(set(files))[:3]
                print(f"    - {desc}: {', '.join(unique_files)}")
            # 转换为可序列化格式
            self.current_state["file_storage"] = {k: list(set(v)) for k, v in found_patterns.items()}
        else:
            print_info("未检测到特殊文件存储配置")
    
    def compare_with_baseline(self, baseline_path):
        """与基准版本比较"""
        if not os.path.exists(baseline_path):
            print_warning(f"基准文件不存在: {baseline_path}")
            return
        
        with open(baseline_path, 'r', encoding='utf-8') as f:
            baseline = json.load(f)
        
        print_header("📊 与上一版本比较")
        
        # 比较包名
        if baseline.get("package_name") != self.current_state.get("package_name"):
            print_critical(f"包名已变更! {baseline.get('package_name')} → {self.current_state.get('package_name')}")
            self.issues.append("⛔ 包名已变更，用户升级后将丢失所有数据！")
        else:
            print_success("包名未变更")

        old_namespace = baseline.get("namespace")
        new_namespace = self.current_state.get("namespace")
        if old_namespace and new_namespace and old_namespace != new_namespace:
            print_warning(f"namespace 已变更: {old_namespace} → {new_namespace}")
            self.warnings.append(f"namespace 变更: {old_namespace} → {new_namespace}")
        
        # 比较 versionCode
        old_vc = baseline.get("version_code", 0)
        new_vc = self.current_state.get("version_code", 0)
        if new_vc < old_vc:
            print_error(f"versionCode 回退! {old_vc} → {new_vc}")
            self.issues.append(f"versionCode 不能回退: {old_vc} → {new_vc}")
        elif new_vc == old_vc:
            print_info(f"versionCode 与基准一致: {new_vc}")
        else:
            print_success(f"versionCode 正确递增: {old_vc} → {new_vc}")
        
        # 比较数据库版本
        old_db = baseline.get("db_version", 0)
        new_db = self.current_state.get("db_version", 0)
        if new_db != old_db:
            print_warning(f"数据库版本变更: {old_db} → {new_db}")
            
            # 检查是否有对应的迁移
            expected_migration = f"MIGRATION_{old_db}_{new_db}"
            migrations = self.current_state.get("migrations", [])
            has_migration = any(f == str(old_db) and t == str(new_db) for f, t in migrations)
            
            if not has_migration:
                print_critical(f"数据库版本从 {old_db} 升级到 {new_db}，但缺少迁移脚本!")
                self.issues.append(f"⛔ 缺少数据库迁移: {expected_migration}")
            else:
                print_success(f"找到对应迁移: {expected_migration}")
        else:
            print_success("数据库版本未变更")

        old_db_name = baseline.get("database_name")
        new_db_name = self.current_state.get("database_name")
        if old_db_name and new_db_name and old_db_name != new_db_name:
            print_warning(f"数据库名称变更: {old_db_name} → {new_db_name}")
            self.warnings.append(f"数据库名称变更: {old_db_name} → {new_db_name}")
        
        # 比较实体类
        old_entities = set(baseline.get("entities", []))
        new_entities = set(self.current_state.get("entities", []))
        
        added = new_entities - old_entities
        removed = old_entities - new_entities
        
        if added:
            print_warning(f"新增实体: {', '.join(added)}")
            if new_db == old_db:
                print_critical("新增了实体但数据库版本未递增！需要添加迁移！")
                self.issues.append(f"⛔ 新增实体 {added} 但未升级数据库版本")
        if removed:
            print_warning(f"移除实体: {', '.join(removed)}")
        
        # 比较 SharedPreferences
        old_prefs = set(baseline.get("shared_preferences", []))
        new_prefs = set(self.current_state.get("shared_preferences", []))
        
        renamed_prefs = old_prefs - new_prefs
        if renamed_prefs:
            print_warning(f"SharedPreferences 可能被重命名/删除: {renamed_prefs}")
            self.warnings.append(f"SharedPreferences 变更: {renamed_prefs}")
    
    def save_baseline(self, path):
        """保存当前状态为基准"""
        self.current_state["baseline_format_version"] = 2
        self.current_state["timestamp"] = datetime.now().isoformat()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.current_state, f, indent=2, ensure_ascii=False)
        print_success(f"基准已保存到: {path}")
    
    def generate_report(self):
        """生成检查报告"""
        print_header("📋 检查报告")
        
        if self.issues:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ 发现 {len(self.issues)} 个问题:{Colors.END}")
            for issue in self.issues:
                print(f"   • {issue}")
        else:
            print_success("没有发现严重问题")
        
        if self.warnings:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠️  {len(self.warnings)} 个警告:{Colors.END}")
            for warning in self.warnings:
                print(f"   • {warning}")
        
        # 总结
        critical_issues = [i for i in self.issues if "⛔" in i]
        if critical_issues:
            print(f"\n{Colors.RED}{Colors.BOLD}{'=' * 60}{Colors.END}")
            print(f"{Colors.RED}{Colors.BOLD}  ⛔ 检测到 {len(critical_issues)} 个严重问题！{Colors.END}")
            print(f"{Colors.RED}{Colors.BOLD}  发布此 APK 可能导致用户数据丢失！{Colors.END}")
            print(f"{Colors.RED}{Colors.BOLD}{'=' * 60}{Colors.END}")
            return False
        elif self.issues:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}检测完成，请修复上述问题后再发布{Colors.END}")
            return False
        else:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ 数据保留检查通过！可以安全发布{Colors.END}")
            return True


def main():
    parser = argparse.ArgumentParser(description='APK 打包前数据保留检查')
    parser.add_argument('--baseline', type=str, help='基准文件路径', 
                        default='scripts/baseline.json')
    parser.add_argument('--save-baseline', action='store_true', 
                        help='保存当前状态为新基准')
    parser.add_argument('--project', type=str, help='项目根目录',
                        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    args = parser.parse_args()
    
    checker = DataPreservationChecker(args.project)
    checker.check_all()
    
    baseline_path = os.path.join(args.project, args.baseline)
    
    # 与基准比较
    if os.path.exists(baseline_path) and not args.save_baseline:
        checker.compare_with_baseline(baseline_path)
    
    # 保存基准
    if args.save_baseline:
        success = checker.generate_report()
        if success:
            checker.save_baseline(baseline_path)
        else:
            print_error("发现问题，未保存新的基准文件")
        sys.exit(0 if success else 1)

    success = checker.generate_report()
    
    # 返回退出码
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
