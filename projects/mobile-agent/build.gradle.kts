buildscript {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://maven.objectbox.io/") }
    }
    dependencies {
        classpath("io.objectbox:objectbox-gradle-plugin:4.1.0")
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.google.services) apply false

}