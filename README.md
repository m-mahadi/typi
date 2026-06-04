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

The installer writes Typi's vault path to `%APPDATA%\typi\config.json` (for example `vaultPath` pointing at your Documents folder). On a first install, the vault is created under your **Documents** folder as `Typi Vault`. Reinstalling keeps that same path if the vault folder still exists, or if you chose a different folder with **Link Vault**. Typi always opens **Show Notes** and **Open Obsidian** using that saved path—not a fixed drive letter.

On first launch, Typi checks whether Obsidian is installed before opening the writing desk. If Obsidian is missing, Typi asks first. You can let Typi download and open the official Obsidian Windows installer, open the Obsidian download page, or skip for now. After the installer opens, press **Continue** so Typi can detect Obsidian and register your vault. Typi still works without Obsidian because it saves plain Markdown files, but Obsidian is recommended for browsing and organizing those notes.

`npm run install:win` installs Typi only and launches Typi. It does not install Obsidian or open Obsidian download pages.

Use **Open Obsidian** to register the vault from `config.json` in Obsidian, launch Obsidian with that folder, and open the active note (or `Welcome to Typi.md`). Use **Show Notes** to open that vault's `Typi Notes/` folder in File Explorer, even if Obsidian is not installed.

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
