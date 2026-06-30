plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("com.google.devtools.ksp") version "2.0.21-1.0.25"
    alias(libs.plugins.google.services)
    id("io.objectbox")
}
apply(plugin = "com.google.devtools.ksp")

android {
    namespace = "com.xiaoxiami.app"
    compileSdk = 36

    // ===== 团队统一签名配置 =====
    // 使用项目内置的 shared-debug.keystore，无需额外配置 local.properties
    // 所有开发者打包时会自动使用相同签名，确保用户升级时数据不丢失
    // SHA256: A4:28:65:B5:1D:4F:77:E0:DB:0E:38:A2:07:3C:59:D9:39:B4:DA:EF:58:D6:3E:29:D0:EC:A7:2A:6E:DC:32:28
    signingConfigs {
        create("release") {
            // 签名文件在项目中：app/shared-debug.keystore
            storeFile = file("shared-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    defaultConfig {
        applicationId = "com.xiaoxiami.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 10
        versionName = "1.3.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // 从 local.properties 读取 API Key
        val properties = org.jetbrains.kotlin.konan.properties.Properties()
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localPropertiesFile.inputStream().use { properties.load(it) }
        }
        buildConfigField("String", "GEMINI_API_KEY", "\"${properties.getProperty("GEMINI_API_KEY", "")}\"")
        buildConfigField("String", "DASHSCOPE_API_KEY", "\"${properties.getProperty("DASHSCOPE_API_KEY", "")}\"")
        buildConfigField("String", "BAIDU_BCE_API_KEY", "\"${properties.getProperty("BAIDU_BCE_API_KEY", "")}\"")
        buildConfigField("String", "DR_PROXY_URL", "\"${properties.getProperty("DR_PROXY_URL", "")}\"")
        
        // Proxy Service Config
        buildConfigField("String", "PROXY_API_KEY", "\"${properties.getProperty("PROXY_API_KEY", "")}\"")
        buildConfigField("String", "PROXY_API_SECRET", "\"${properties.getProperty("PROXY_API_SECRET", "")}\"")
        
        // TOS Storage Config
        buildConfigField("String", "TOS_ENDPOINT", "\"${properties.getProperty("TOS_ENDPOINT", "")}\"")
        buildConfigField("String", "TOS_REGION", "\"${properties.getProperty("TOS_REGION", "")}\"")
        buildConfigField("String", "TOS_BUCKET", "\"${properties.getProperty("TOS_BUCKET", "")}\"")
        buildConfigField("String", "TOS_ACCESS_KEY", "\"${properties.getProperty("TOS_ACCESS_KEY", "")}\"")
        buildConfigField("String", "TOS_SECRET_KEY", "\"${properties.getProperty("TOS_SECRET_KEY", "")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // Debug 也使用统一签名，确保升级时数据保留
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    
    // 强制使用 Ktor 2.3.x 版本以兼容 Google Generative AI SDK
    configurations.all {
        resolutionStrategy {
            force("io.ktor:ktor-client-core:2.3.12")
            force("io.ktor:ktor-client-okhttp:2.3.12")
            force("io.ktor:ktor-client-content-negotiation:2.3.12")
            force("io.ktor:ktor-serialization-kotlinx-json:2.3.12")
            force("io.ktor:ktor-client-logging:2.3.12")
            force("io.ktor:ktor-client-websockets:2.3.12")
            force("io.ktor:ktor-http:2.3.12")
            force("io.ktor:ktor-utils:2.3.12")
            force("io.ktor:ktor-io:2.3.12")
            force("io.ktor:ktor-events:2.3.12")
            force("io.ktor:ktor-websocket-serialization:2.3.12")
            force("io.ktor:ktor-serialization:2.3.12")
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.compose.material:material-icons-extended:1.7.0")
    
    // ViewModel & LiveData
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    
    // Gemini AI SDK
    implementation("com.google.ai.client.generativeai:generativeai:0.9.0")
    
    // Ktor dependencies for Gemini AI SDK (fix NoClassDefFoundError: HttpTimeout)
    // Google Generative AI SDK 内部使用 Ktor，需要显式引入以下插件依赖
    implementation("io.ktor:ktor-client-core:2.3.12")
    implementation("io.ktor:ktor-client-okhttp:2.3.12")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.12")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.12")
    
    // Import the BoM for the Firebase platform
    implementation(platform("com.google.firebase:firebase-bom:34.8.0"))
    // Add the dependency for the Firebase AI Logic library
    implementation("com.google.firebase:firebase-ai")
    // Add the dependency for the Firebase Cloud Storage library
    implementation("com.google.firebase:firebase-storage") // 迁移到主模块，因为 KTX 模块已停止发布
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    
    // Room Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Gson
    implementation("com.google.code.gson:gson:2.10.1")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // OkHttp for Custom API Calls
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // DashScope Java SDK (Qwen)
    implementation("com.alibaba:dashscope-sdk-java:2.21.9") {
        exclude(group = "org.slf4j", module = "slf4j-simple")
    }

    // Coil for Image Loading (with GIF support for InsightPage)
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation("io.coil-kt:coil-gif:2.6.0")
    
    // TOS Android SDK for file upload to Volcengine Object Storage
    implementation("com.volcengine:ve-tos-android-sdk:2.6.0")
    
    // Markwon for Markdown Rendering
    implementation("io.noties.markwon:core:4.6.2")
    implementation("io.noties.markwon:image:4.6.2")
    implementation("io.noties.markwon:linkify:4.6.2")
    implementation("io.noties.markwon:ext-strikethrough:4.6.2")
    implementation("io.noties.markwon:ext-tables:4.6.2")
    implementation("io.noties.markwon:ext-tasklist:4.6.2")
    implementation("io.noties.markwon:html:4.6.2")
    
    // Compose Markdown for Jetpack Compose
    implementation("com.github.jeziellago:compose-markdown:0.5.4")
    
    // iText PDF for PDF export
    implementation("com.itextpdf:itext7-core:7.2.5")
    implementation("com.itextpdf:font-asian:7.2.5")
    
    // ExoPlayer for better streaming support
    // 如果网络有问题无法下载，可以暂时注释掉下面三行，只使用 MediaPlayer
    implementation("androidx.media3:media3-exoplayer:1.1.1")
    implementation("androidx.media3:media3-ui:1.1.1")
    implementation("androidx.media3:media3-common:1.1.1")
    implementation("androidx.media3:media3-session:1.1.1")
    implementation("androidx.browser:browser:1.9.0")
    implementation("com.google.zxing:core:3.5.3")

    // Security Crypto for EncryptedSharedPreferences (IoT credentials)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Bugly SDK
    implementation(files("libs/crashreport-4.1.9.3.aar"))

    // Shiply Upgrade SDK
    implementation("com.tencent.shiply:upgrade:2.2.0")
    implementation("com.tencent.shiply:upgrade-ui:2.2.0")
    // 差量更新依赖（可选，但推荐）
    implementation("com.tencent.shiply:upgrade-diff-pkg-patch:2.2.0")
    
    // ObjectBox Vector Database
    implementation(libs.objectbox.kotlin)
    
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

// ===== APK 打包数据保留检查任务 =====
// 在打包 APK 完成后自动执行检查脚本
tasks.register("checkDataPreservation") {
    group = "verification"
    description = "检查 APK 数据保留完整性（签名、包名、数据库迁移等）"
    
    doLast {
        val scriptFile = rootProject.file("scripts/check_data_preservation.py")
        val baselineFile = rootProject.file("scripts/baseline.json")
        
        if (!scriptFile.exists()) {
            println("⚠️ 检查脚本不存在: ${scriptFile.absolutePath}")
            println("   请确保 scripts/check_data_preservation.py 存在")
            return@doLast
        }
        
        println("\n" + "=".repeat(60))
        println("🔍 执行 APK 数据保留完整性检查...")
        println("=".repeat(60) + "\n")
        
        val command = if (baselineFile.exists()) {
            listOf("python3", scriptFile.absolutePath, "--baseline", baselineFile.absolutePath)
        } else {
            listOf("python3", scriptFile.absolutePath)
        }
        
        val process = ProcessBuilder(command)
            .directory(rootProject.projectDir)
            .redirectErrorStream(true)
            .start()
        
        process.inputStream.bufferedReader().forEachLine { println(it) }
        
        val exitCode = process.waitFor()
        if (exitCode != 0) {
            throw GradleException("""
                
                ⛔⛔⛔ 数据保留检查失败！⛔⛔⛔
                
                发布此 APK 可能导致用户数据丢失！
                请先修复上述问题，或使用以下命令忽略检查（不推荐）：
                
                ./gradlew assembleRelease -x checkDataPreservation
                
            """.trimIndent())
        }
    }
}

// 保存当前状态为基准
tasks.register("saveDataBaseline") {
    group = "verification"
    description = "保存当前数据库/配置状态为基准版本"
    
    doLast {
        val scriptFile = rootProject.file("scripts/check_data_preservation.py")
        val baselineFile = rootProject.file("scripts/baseline.json")
        
        if (!scriptFile.exists()) {
            println("⚠️ 检查脚本不存在")
            return@doLast
        }
        
        val process = ProcessBuilder(
            listOf("python3", scriptFile.absolutePath, "--save-baseline")
        )
            .directory(rootProject.projectDir)
            .redirectErrorStream(true)
            .start()
        
        process.inputStream.bufferedReader().forEachLine { println(it) }
        process.waitFor()
        
        println("\n✅ 基准已保存到: ${baselineFile.absolutePath}")
        println("   后续打包时会自动与此基准对比")
    }
}

// 自动在打包 Release APK 前执行检查
afterEvaluate {
    tasks.findByName("assembleRelease")?.dependsOn("checkDataPreservation")
    tasks.findByName("bundleRelease")?.dependsOn("checkDataPreservation")
    // 也检查 debug 版本（因为 debug 也会发给测试人员）
    tasks.findByName("assembleDebug")?.dependsOn("checkDataPreservation")
}

// 打包完成后显示 APK 位置
tasks.matching { it.name.startsWith("assemble") && it.name.endsWith("Release") }.configureEach {
    doLast {
        println("\n" + "=".repeat(60))
        println("✅ APK 打包完成！")
        println("=".repeat(60))
        println("📦 APK 位置: ${project.buildDir}/outputs/apk/release/")
        println("\n⚠️  发布前提醒：")
        println("   1. 确保签名与之前版本一致")
        println("   2. versionCode 必须递增")
        println("   3. 如有数据库变更，确保迁移脚本完整")
        println("=".repeat(60) + "\n")
    }
}
