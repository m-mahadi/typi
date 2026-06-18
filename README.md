# Typi

Typi is a typewriter writing desk for Windows, Markdown, and Obsidian.

It gives you a blank sheet, real typing feedback, local autosave, and one firm
rule: write it yourself. Paste is blocked so the page does not become a dumping
ground. Every note is saved as Markdown, so your writing stays yours.

Website: <https://m-mahadi.github.io/typi.html>

Download: <https://github.com/m-mahadi/typi/releases/latest>

## Why Typi Is Best For First Drafts

Most writing apps are built for managing text after it exists. Typi is built for
the harder moment before it exists.

That is why it feels different:

- It blocks paste and drag-drop, so the desk stays for writing, not collecting.
- It plays typewriter sounds so each keypress feels physical.
- It autosaves locally while you write.
- It saves Markdown into an Obsidian vault, not a locked app format.
- It can open the current note directly in Obsidian.
- It can show the saved notes folder in File Explorer even if Obsidian is not
  installed.
- It creates a default Typi Vault on first install, then remembers the vault you
  choose.
- It works as a focused desktop app and as a simple browser version.

Typi wins because it is intentionally narrow. It is not trying to be a full
knowledge base, AI editor, or publishing suite. It is the place where the first
draft starts moving.

## What It Does

- Typewriter-inspired writing UI.
- Key, space, backspace, carriage return, and bell sounds.
- Sound toggle.
- Paste and drop blocking.
- Local draft autosave.
- Vault autosave in the Windows app.
- Markdown notes saved into `Typi Notes/`.
- **Link Vault** to choose an Obsidian vault.
- **Open Obsidian** to open the active vault and current note.
- **Show Notes** to open the saved-notes folder in File Explorer.
- First-run Obsidian check with a user-approved installer flow.

## Windows App

Download the installer from the
[latest GitHub release](https://github.com/m-mahadi/typi/releases/latest):

```text
typi-setup.exe
```

On first launch, Typi creates:

```text
Documents\Typi Vault\
  Typi Notes\
  Welcome to Typi.md
```

The saved vault path lives in:

```text
%APPDATA%\typi\config.json
```

If you choose a different vault with **Link Vault**, Typi remembers it. Reinstall
keeps using that saved path when it still exists.

## Obsidian

Typi saves plain Markdown, so Obsidian is optional. The notes are still normal
files without it.

Obsidian makes the vault nicer to browse. If Obsidian is missing, Typi asks
before doing anything. You can:

- let Typi download and open the official Obsidian Windows installer;
- open the Obsidian download page yourself;
- skip and keep writing.

Use **Open Obsidian** to register the vault and open the active note. Use
**Show Notes** when you just want the folder.

## Build The Windows App

```powershell
npm install
npm run build:win
```

The build output appears in `dist/`:

```text
dist\typi-setup.exe
dist\win-unpacked\Typi.exe
```

Install the local build:

```powershell
npm run install:win
```

`npm run install:win` installs Typi only. It does not install Obsidian or open
Obsidian download pages.

## Web Version

```powershell
npm run start:web
```

Open:

```text
http://localhost:8080
```

The web version uses the browser's File System Access API for vault saves, so
Chrome or Edge works best.

## Sounds

Typi uses local typewriter sounds in `sounds/`. Attribution is in
`sounds/ATTRIBUTION.md`.

## License

Typi source code is MIT licensed. See `LICENSE`.

Bundled typewriter sound effects are from Mixkit and remain under the Mixkit
License. See `sounds/ATTRIBUTION.md`.
