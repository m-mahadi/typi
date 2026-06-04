# Typi

Typi is a typewriter-style writing desk for Windows. It gives you a focused place to write and saves notes as Markdown into an Obsidian vault.

## What it does

- Typewriter-inspired writing UI with key sounds
- Local draft autosave while you write
- Saves Markdown notes into `Typi Notes/` inside your vault
- Lets you choose a vault with **Link Vault**
- Creates a default local vault at `C:\Users\<you>\Documents\Typi Vault` if you have not chosen one yet
- Blocks paste/drop into the editor so Typi stays a writing desk, not a dumping ground
- Checks whether Obsidian is installed and can install the official Obsidian app through Windows Package Manager if the user agrees
- Works as an Electron desktop app and as a simple browser version

## Windows app

Download the Windows installer from the [latest GitHub release](https://github.com/m-mahadi/typi/releases/latest):

```text
typi-setup.exe
```

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

The installer writes Typi's vault config to `%APPDATA%\typi\config.json`. If you already picked a vault, reinstalling preserves that location. If not, Typi starts with this local default:

```text
C:\Users\<you>\Documents\Typi Vault
```

On first launch, Typi checks whether Obsidian is installed. If it is missing, Typi asks before doing anything. You can let Typi install the official `Obsidian.Obsidian` Windows package, open the Obsidian download page, or skip for now. Typi still works without Obsidian because it saves plain Markdown files, but Obsidian is recommended for browsing and organizing those notes.

## Web version

```powershell
npm run start:web
```

Open `http://localhost:8080` in Chrome or Edge. The web version uses the File System Access API for vault saves.

## Sounds

Typi uses local sound files in `sounds/`. Attribution is in `sounds/ATTRIBUTION.md`.

## License

Typi's source code is open source under the MIT License. See `LICENSE`.

Bundled typewriter sound effects are from Mixkit and remain under the Mixkit License; see `sounds/ATTRIBUTION.md`.
