# PG360 — Windows desktop app (Electron)

A thin Electron window around the live web app at `https://pg360.software`. Same
model as the Android wrapper: the desktop app loads the hosted site, so
**website deploys update the desktop app automatically** — you only rebuild the
installer for native/version changes. External links open in the system browser;
an offline page shows if the site is unreachable.

Lives in its own folder with its own dependencies so Electron's ~200 MB toolchain
stays out of the web app:

- App + builder config: [`desktop/package.json`](../desktop/package.json)
- Main process: [`desktop/main.js`](../desktop/main.js)
- Offline page: [`desktop/offline.html`](../desktop/offline.html)
- Icon: `desktop/build/icon.ico`

## Develop / run locally

```powershell
cd desktop
npm install          # one-time
npm start            # launches the desktop window against the live site
```

## Build the installers

```powershell
cd desktop
npm run dist         # both: PG360-Setup-<v>.exe (NSIS) + .msi
npm run dist:exe     # just the NSIS .exe installer
npm run dist:msi     # just the .msi (enterprise / Group Policy deploys)
```

Output in `desktop/dist/`:

- `PG360-Setup-<version>.exe` — standard installer (lets the user choose the
  install dir, creates Desktop + Start Menu shortcuts).
- `PG360-Setup-<version>.msi` — for managed/enterprise rollout.

Bump `version` in `desktop/package.json` before each release.

## ⚠️ One-time Windows gotcha: winCodeSign symlink error

electron-builder downloads a signing toolchain whose archive contains **macOS
symlinks**. Extracting symlinks on Windows needs **Developer Mode** or an
**elevated terminal**, so the first build can fail with:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
... winCodeSign ... libcrypto.dylib / libssl.dylib
```

Pick one fix:

1. **Enable Developer Mode** — Settings → Privacy & security → For developers →
   Developer Mode → On (needs admin once). Then `npm run dist` works.
2. **Run the build from an Administrator terminal.**
3. **Manual extract (no admin needed)** — the Mac libs aren't used for Windows
   builds, so extract the toolchain without symlinks into the cache:

   ```powershell
   $c = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
   $z = "$PWD\node_modules\7zip-bin\win\x64\7za.exe"
   # any of the downloaded .7z files in $c works:
   & $z x "$c\<one>.7z" "-o$c\winCodeSign-2.6.0" -y -snl-
   ```

   This repo was built with option 3; the extracted cache persists, so repeat
   builds on this machine just work.

## Code signing (recommended before wide distribution)

The installers above are **unsigned**, so Windows SmartScreen shows a
"unrecognized app" warning on first run. To remove it, buy an OV/EV code-signing
certificate and point electron-builder at it:

```powershell
$env:CSC_LINK = "C:\secure\pg360-cert.pfx"
$env:CSC_KEY_PASSWORD = "********"
npm run dist
```

(Or set `win.certificateFile` / `certificatePassword` in `package.json` →
`build`.) An EV cert clears SmartScreen immediately; an OV cert clears it after
reputation builds.

## Auto-update (optional, later)

electron-builder pairs with `electron-updater` + a release feed (GitHub Releases,
S3, or a generic URL). Not wired yet — add when you want installed apps to update
the native shell automatically. Note: web content already updates on every deploy
without this.
