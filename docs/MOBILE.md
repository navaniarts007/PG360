# PG360 — Android app (Capacitor)

The Android app is a **thin native wrapper** around the live web app at
`https://pg360.software`. Because PG360 is server-rendered (Next.js Server
Actions + Supabase RLS run on the server), it cannot be statically bundled — the
WebView loads the hosted HTTPS site, so **content updates ship automatically when
you deploy the website.** You only rebuild the APK for native changes (icon,
splash, app version, new plugins).

- App ID: `software.pg360.app`
- Config: [`capacitor.config.ts`](../capacitor.config.ts)
- Offline fallback shell: [`mobile/www/index.html`](../mobile/www/index.html)
- Native project: [`android/`](../android)

## Prerequisites (one-time)

- **Android Studio** (already installed) — bundles the Android SDK and a
  compatible JDK 21 (JBR).
- The repo already has `android/local.properties` pointing at the SDK. If you
  move machines, set `sdk.dir` to your SDK path.
- Building from the command line needs `JAVA_HOME` set to a JDK 17 or 21. Do
  **not** use JDK 22 — Capacitor's Gradle rejects it. The simplest path is
  Android Studio's bundled runtime:

  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ```

  (Or just open the project in Android Studio, which uses its own JDK.)

## Everyday workflow

```powershell
# After changing capacitor.config.ts, the offline shell, or adding plugins:
npm run cap:sync        # copies config + web assets into the android project

# Open in Android Studio (recommended for building / running on a device):
npm run cap:open
```

In Android Studio: **Run ▶** on a connected device/emulator, or
**Build → Build Bundle(s) / APK(s)**.

## Build a debug APK (for testing / sideloading)

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk` (~4 MB). Install with
`adb install -r app-debug.apk` or copy to a phone.

## Release build (signed) — for the Play Store

### 1. Create a signing keystore (one-time — keep it safe & backed up!)

```powershell
keytool -genkey -v -keystore pg360-release.jks -keyalg RSA -keysize 2048 `
  -validity 10000 -alias pg360
```

Store `pg360-release.jks` **outside** the repo (it's git-ignored anyway). If you
lose it you can never update the Play Store listing.

### 2. Tell Gradle about it

Create `android/keystore.properties` (git-ignored — add it to `android/.gitignore`):

```properties
storeFile=C:/secure/pg360-release.jks
storePassword=********
keyAlias=pg360
keyPassword=********
```

…and wire it into `android/app/build.gradle` (`signingConfigs` + `buildTypes.release`).
See the Capacitor signing guide: https://capacitorjs.com/docs/android/configuration

### 3. Build

```powershell
npm run android:bundle   # -> .aab for the Play Store (preferred)
npm run android:apk      # -> .apk for direct distribution
```

- `.aab` output: `android/app/build/outputs/bundle/release/app-release.aab`
- `.apk` output: `android/app/build/outputs/apk/release/app-release.apk`

## Versioning

Bump `versionCode` (integer, must increase every Play upload) and `versionName`
(human string) in `android/app/build.gradle` before each release.

## App icon & splash (later)

Generate from a single source image with:

```powershell
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```

Drop a 1024×1024 `assets/icon.png` and `assets/splash.png` first.

## Play Store notes

- A Play Console account is a one-time **$25** fee.
- Apps that are *only* a WebView can be flagged. PG360 is acceptable as a
  business tool, but adding at least one native capability (push or camera)
  strengthens the listing — see the "Just the wrapper" decision; revisit if
  Google pushes back.
