import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing: CI can inject a private keystore through environment variables.
// Without it, the APK is signed with the committed side-load key (android/sideload.jks),
// so that updates installed from GitHub keep the same signature (no uninstall needed).
val keystoreFile = System.getenv("SIF_KEYSTORE")?.let { file(it) } ?: rootProject.file("sideload.jks")
val keystorePassword = System.getenv("SIF_KEYSTORE_PASSWORD") ?: "sigleinfila"
val keyAliasName = System.getenv("SIF_KEY_ALIAS") ?: "sigleinfila"
val keyPasswordValue = System.getenv("SIF_KEY_PASSWORD") ?: "sigleinfila"

val versionProps = Properties().apply {
    val f = rootProject.file("version.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "io.github.flamingfury00.sigleinfila"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.flamingfury00.sigleinfila"
        minSdk = 24
        targetSdk = 36
        versionCode = (System.getenv("SIF_VERSION_CODE") ?: versionProps.getProperty("versionCode", "1")).toInt()
        versionName = System.getenv("SIF_VERSION_NAME") ?: versionProps.getProperty("versionName", "1.0.0")
    }

    signingConfigs {
        create("sideload") {
            storeFile = keystoreFile
            storePassword = keystorePassword
            keyAlias = keyAliasName
            keyPassword = keyPasswordValue
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("sideload")
        }
        getByName("debug") {
            signingConfig = signingConfigs.getByName("sideload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module", "META-INF/AL2.0", "META-INF/LGPL2.1")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.webkit:webkit:1.17.1")
}

// The web app is built by Vite (npm run build:android) into ../dist-android and bundled
// as assets/www, so the APK works offline (only the music previews need the network).
val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.file("../dist-android"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}
tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
