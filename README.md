# Typi - typewriter simulator and writing app

Typi is an open source typewriter simulator, typewriter software, and focused writing app for Windows. It gives you a typewriter-style writing desk, blocks paste, plays typewriter sounds, autosaves Markdown notes, and opens them in an Obsidian vault.

Website: https://m-mahadi.github.io/typi.html

Download: https://github.com/m-mahadi/typi/releases/latest

## What it does

- Typewriter-inspired writing UI with key sounds
- Typewriter simulator software for focused writing
- Typewriter writing app for Windows, Markdown, and Obsidian
- Local draft autosave while you write
- Vault autosave in the Windows app, so the current sheet is written to Markdown while you type
- Saves Markdown notes into `Typi Notes/` inside your vault
- Lets you choose a vault with **Link Vault**
- Opens the active vault directly in Obsidian with **Open Obsidian**
- Opens the exact saved-notes folder with **Show Notes**
- Creates a default local vault at `C:\Users\<you>\Documents\Typi Vault` if you have not chosen one yet
- Blocks paste/drop into the editor so Typi stays a writing desk, not a dumping ground
- Checks whether Obsidian is installed and can download/open the official Obsidian Windows installer if the user agrees
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

On first launch, Typi checks whether Obsidian is installed before opening the writing desk. If Obsidian is missing, Typi asks first. You can let Typi download and open the official Obsidian Windows installer, open the Obsidian download page, or skip for now. Typi still works without Obsidian because it saves plain Markdown files, but Obsidian is recommended for browsing and organizing those notes.

Use **Open Obsidian** in the app to open the configured vault directly. Use **Show Notes** if you only want the folder where Typi writes Markdown files.

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
