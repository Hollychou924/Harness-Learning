pluginManagement {
    repositories {
        // maven {
        //     url = uri("http://maven.aliyun.com/repository/public")
        //     isAllowInsecureProtocol = true
        // }
        // maven {
        //     url = uri("http://maven.aliyun.com/repository/google")
        //     isAllowInsecureProtocol = true
        // }
        // maven { url = uri("https://mirrors.cloud.tencent.com/nexus/repository/maven-public/") }
        maven { url = uri("https://maven.cnb.cool/tencent-tds/shiply-public/-/packages/") }
        maven { url = uri("https://maven.objectbox.io/") }
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        // maven {
        //     url = uri("http://maven.aliyun.com/repository/public")
        //     isAllowInsecureProtocol = true
        // }
        // maven {
        //     url = uri("http://maven.aliyun.com/repository/google")
        //     isAllowInsecureProtocol = true
        // }
        // maven { url = uri("https://mirrors.cloud.tencent.com/nexus/repository/maven-public/") }
        maven {
            url = uri("https://maven.cnb.cool/tencent-tds/shiply-public/-/packages/")
            content {
                excludeGroup("com.github.jeziellago")
            }
        }
        maven { url = uri("https://jitpack.io") }
        maven { url = uri("https://maven.objectbox.io/") }
        google()
        mavenCentral()
    }
}

rootProject.name = "小虾米"
include(":app")
