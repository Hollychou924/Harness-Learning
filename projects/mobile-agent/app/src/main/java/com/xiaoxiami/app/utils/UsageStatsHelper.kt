package com.xiaoxiami.app.utils

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Drawable
import android.os.Process
import android.provider.Settings
import android.util.Log

/**
 * UsageStats权限工具类
 * 用于获取前台应用信息，提升截图时应用识别的准确性
 */
object UsageStatsHelper {
    
    private const val TAG = "UsageStatsHelper"
    
    /**
     * 应用信息数据类
     */
    data class AppInfo(
        val packageName: String,
        val appName: String,
        val icon: Drawable?
    )

    data class ForegroundAppSnapshot(
        val packageName: String,
        val appName: String,
        val lastActiveAt: Long,
        val icon: Drawable? = null
    )
    
    /**
     * 检查是否有 UsageStats 权限
     */
    fun hasUsageStatsPermission(context: Context): Boolean {
        return try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Log.e(TAG, "检查UsageStats权限失败", e)
            false
        }
    }
    
    /**
     * 获取设置页面Intent
     */
    fun getSettingsIntent(): Intent {
        return Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    }
    
    /**
     * 获取当前前台应用的包名
     * 
     * @return 前台应用包名，如果无法获取则返回null
     */
    fun getCurrentForegroundApp(context: Context): String? {
        if (!hasUsageStatsPermission(context)) {
            Log.w(TAG, "没有 UsageStats 权限，无法获取前台应用")
            return null
        }
        
        return try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            
            // 查询最近60秒的使用统计 (增加窗口时间，避免因用户无操作导致获取为空)
            val usageStatsList = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                time - 60 * 1000,
                time
            )
            
            if (usageStatsList.isNullOrEmpty()) {
                Log.d(TAG, "UsageStats查询结果为空")
                return null
            }
            
            // 找到最近使用的应用
            val recentApp = usageStatsList.maxByOrNull { it.lastTimeUsed }
            val packageName = recentApp?.packageName
            
            Log.d(TAG, "当前前台应用: $packageName")
            packageName
        } catch (e: Exception) {
            Log.e(TAG, "获取前台应用失败", e)
            null
        }
    }

    fun getCurrentForegroundAppSnapshot(context: Context): ForegroundAppSnapshot? {
        if (!hasUsageStatsPermission(context)) {
            Log.w(TAG, "没有 UsageStats 权限，无法获取前台应用快照")
            return null
        }

        return try {
            val usageStatsManager =
                context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val usageStatsList = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                now - 60 * 1000,
                now
            )

            val recentApp = usageStatsList
                ?.filter { it.packageName.isNotBlank() && it.lastTimeUsed > 0L }
                ?.maxByOrNull { it.lastTimeUsed }
                ?: return null

            val appInfo = getAppInfo(context, recentApp.packageName)
            ForegroundAppSnapshot(
                packageName = recentApp.packageName,
                appName = appInfo.appName,
                lastActiveAt = recentApp.lastTimeUsed,
                icon = appInfo.icon
            )
        } catch (e: Exception) {
            Log.e(TAG, "获取前台应用快照失败", e)
            null
        }
    }
    
    /**
     * 将包名转换为应用名称
     * 
     * @param packageName 应用包名
     * @return 应用显示名称，如果无法获取则返回包名本身
     */
    fun getAppNameFromPackage(context: Context, packageName: String): String {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            Log.w(TAG, "无法获取应用名称: $packageName", e)
            packageName
        }
    }
    
    /**
     * 获取应用的Icon
     * 
     * @param packageName 应用包名
     * @return 应用图标Drawable，如果无法获取则返回null
     */
    fun getAppIcon(context: Context, packageName: String): Drawable? {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationIcon(appInfo)
        } catch (e: Exception) {
            Log.w(TAG, "无法获取应用图标: $packageName", e)
            null
        }
    }
    
    /**
     * 获取应用的完整信息（名称 + Icon）
     * 
     * @param packageName 应用包名
     * @return AppInfo对象，包含应用名和图标
     */
    fun getAppInfo(context: Context, packageName: String): AppInfo {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            AppInfo(
                packageName = packageName,
                appName = pm.getApplicationLabel(appInfo).toString(),
                icon = pm.getApplicationIcon(appInfo)
            )
        } catch (e: Exception) {
            Log.w(TAG, "无法获取应用信息: $packageName", e)
            AppInfo(
                packageName = packageName,
                appName = packageName,  // 降级为包名
                icon = null
            )
        }
    }
    
    /**
     * 获取当前前台应用的名称（包名转换为应用名）
     * 
     * @return 前台应用名称，如果无法获取则返回null
     */
    fun getCurrentForegroundAppName(context: Context): String? {
        val packageName = getCurrentForegroundApp(context) ?: return null
        return getAppNameFromPackage(context, packageName)
    }
    
    /**
     * 获取当前前台应用的完整信息（名称 + Icon）
     * 
     * @return AppInfo对象，如果无法获取则返回null
     */
    fun getCurrentForegroundAppInfo(context: Context): AppInfo? {
        val packageName = getCurrentForegroundApp(context) ?: return null
        return getAppInfo(context, packageName)
    }
}
