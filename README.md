# Typi

Typi is a typewriter-style writing desk for Windows. It gives you a focused place to write and saves notes as Markdown into an Obsidian vault.

## What it does

- Typewriter-inspired writing UI with key sounds
- Local draft autosave while you write
- Saves Markdown notes into `Typi Notes/` inside your vault
- Creates a default `Typi Vault` in your Documents folder on first run
- Works as an Electron desktop app and as a simple browser version

## Windows app

Build the installer:

```powershell
npm install
npm run build:win
```

The build output appears in `dist/`:

- `typi-setup.exe` - Windows installer
- `win-unpacked/Typi.exe` - unpacked app

Install locally:

```powershell
npm run install:win
```

## Web version

```powershell
npm run start:web
```

Open `http://localhost:8080` in Chrome or Edge. The web version uses the File System Access API for vault saves.

## Sounds

Typi uses local sound files in `sounds/`. Attribution is in `sounds/ATTRIBUTION.md`.
