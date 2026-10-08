plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val webRoot = rootProject.projectDir.parentFile
val syncWebAssets by tasks.registering(Exec::class) {
    workingDir(webRoot)
    commandLine("node", "scripts/sync-android-assets.mjs")
    dependsOn("buildWebAssets")
}
val buildWebAssets by tasks.registering(Exec::class) {
    workingDir(webRoot)
    commandLine(if (System.getProperty("os.name").startsWith("Windows")) "npm.cmd" else "npm", "run", "build")
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }

android {
    namespace = "app.couple"
    compileSdk = 36

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "app.couple"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures { buildConfig = true }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    testImplementation("junit:junit:4.13.2")
}
