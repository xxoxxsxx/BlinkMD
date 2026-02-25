# BlinkMD

English | [中文](./README.zh-CN.md)

A local-first, lightweight Markdown editor built with **Tauri 2.x** + **React 18** + **TypeScript** + **Vite**.

Fast startup, low memory footprint, keyboard-driven workflow.

## Features

- **Split / Edit / Preview modes** — side-by-side live preview with synchronized scrolling, or full-screen edit / preview toggle
- **CodeMirror 6 editor** — Markdown syntax highlighting, line numbers, line wrapping
- **Markdown rendering** — CommonMark + GFM (tables, task lists, fenced code blocks) via `marked`, with built-in XSS sanitization
- **Native file I/O** — Open / Save / Save As through Tauri Rust commands and native file dialogs
- **Drag-and-drop open (Tauri)** — drop `.md` / `.markdown` / `.txt` files onto the workspace to open, with unsaved-change confirmation
- **Keyboard shortcuts** — `Cmd/Ctrl+O` open, `Cmd/Ctrl+S` save, `Cmd/Ctrl+Shift+S` save as, `Cmd/Ctrl+E` edit mode, `Cmd/Ctrl+R` preview mode, `Cmd/Ctrl+\` split mode
- **Status bar** — word count (CJK + Latin), cursor position (Ln/Col), file name, dirty state indicator
- **Close guard** — unsaved changes dialog (Save / Don't Save / Cancel) before closing
- **Large file mode** — reduced preview debounce for documents > 1MB

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Tauri 2.x (Rust) |
| Frontend | React 18 + TypeScript |
| Build tool | Vite 5 |
| Editor | CodeMirror 6 |
| Markdown parser | marked 15 |
| Testing | Vitest + jsdom (frontend), `cargo test` (Rust) |

## Getting Started

### Prerequisites

- Node.js >= 18
- Rust toolchain (stable)
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Install & Run

```bash
npm install
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

Output: platform-specific bundles in `src-tauri/target/release/bundle/`.

### Building on Windows

Prerequisites:

- Node.js >= 18
- Rust toolchain (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "C++ build tools" workload
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)

```bash
npm install
npm run tauri build
```

This produces `.msi` and `.exe` installers in `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.

### macOS: "App Is Damaged" Fix

The release builds are not Apple-signed. macOS Gatekeeper may block the app with:

> "BlinkMD.app" is damaged and can't be opened.

Run the following command to remove the quarantine attribute:

```bash
xattr -cr /Applications/BlinkMD.app
```

Then open the app normally.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 1420, frontend only) |
| `npm run tauri dev` | Full desktop app in dev mode |
| `npm run build` | TypeScript check + Vite build (frontend) |
| `npm run tauri build` | Production desktop bundles |
| `npm run test` | Run frontend unit tests |
| `npm run test:watch` | Run tests in watch mode |

Rust tests:

```bash
cd src-tauri && cargo test
```

## Project Structure

```
src/
  app/          App.tsx, App.css (orchestrator, layout, state)
  editor/       EditorPane.tsx, editorTheme.ts (CodeMirror 6)
  preview/      PreviewPane.tsx (Markdown preview)
  services/     fileService.ts, renderService.ts
  state/        documentStore.ts (types + initial state)
src-tauri/
  src/
    commands/   file.rs (open/save/save_as/exit_app), health.rs
    main.rs     Tauri app setup, global shortcuts
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Shift + S` | Save As |
| `Cmd/Ctrl + E` | Switch to Edit mode |
| `Cmd/Ctrl + R` | Switch to Preview mode |
| `Cmd/Ctrl + \` | Switch to Split mode |

## License

MIT
