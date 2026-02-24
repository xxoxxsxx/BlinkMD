# BlinkMD

[English](./README.md) | 中文

一个本地优先、轻量级的 Markdown 编辑器，基于 **Tauri 2.x** + **React 18** + **TypeScript** + **Vite** 构建。

启动快、内存占用低、键盘驱动的工作流。

## 功能特性

- **分屏 / 编辑 / 预览模式** — 左右分屏实时预览并同步滚动，也可切换为纯编辑或纯预览
- **CodeMirror 6 编辑器** — Markdown 语法高亮、行号、自动换行
- **Markdown 渲染** — 通过 `marked` 支持 CommonMark + GFM（表格、任务列表、围栏代码块），内置 XSS 净化
- **原生文件读写** — 通过 Tauri Rust 命令和原生文件对话框实现打开 / 保存 / 另存为
- **快捷键** — `Cmd/Ctrl+O` 打开、`Cmd/Ctrl+S` 保存、`Cmd/Ctrl+Shift+S` 另存为、`Cmd/Ctrl+E` 编辑模式、`Cmd/Ctrl+R` 预览模式
- **状态栏** — 字数统计（CJK + Latin）、光标位置（行/列）、文件名、脏状态指示
- **关闭守护** — 关闭窗口时弹出未保存提示（保存 / 不保存 / 取消）
- **大文件模式** — 文档超过 1MB 时自动降低预览刷新频率

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面运行时 | Tauri 2.x (Rust) |
| 前端 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 编辑器 | CodeMirror 6 |
| Markdown 解析 | marked 15 |
| 测试 | Vitest + jsdom（前端）、`cargo test`（Rust） |

## 快速开始

### 前置条件

- Node.js >= 18
- Rust 工具链（stable）
- Tauri CLI：`npm install -g @tauri-apps/cli`

### 安装与运行

```bash
npm install
npm run tauri dev
```

### 生产构建

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`，包含对应平台的安装包。

### 在 Windows 上构建

前置条件：

- Node.js >= 18
- Rust 工具链（stable）
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选"C++ 生成工具"工作负载
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)（Windows 10/11 通常已预装）

```bash
npm install
npm run tauri build
```

构建完成后，`.msi` 和 `.exe` 安装包位于 `src-tauri/target/release/bundle/nsis/` 和 `src-tauri/target/release/bundle/msi/`。

### macOS：提示"应用已损坏"的解决方法

由于发布版本未经 Apple 签名，macOS Gatekeeper 可能会拦截应用并提示：

> "BlinkMD.app"已损坏，无法打开。

在终端中执行以下命令移除隔离属性即可：

```bash
xattr -cr /Applications/BlinkMD.app
```

之后即可正常打开。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（端口 1420，仅前端） |
| `npm run tauri dev` | 启动完整桌面应用（开发模式） |
| `npm run build` | TypeScript 类型检查 + Vite 构建（仅前端） |
| `npm run tauri build` | 生产环境桌面应用打包 |
| `npm run test` | 运行前端单元测试 |
| `npm run test:watch` | 以 watch 模式运行测试 |

Rust 测试：

```bash
cd src-tauri && cargo test
```

## 项目结构

```
src/
  app/          App.tsx, App.css（主编排器、布局、状态管理）
  editor/       EditorPane.tsx, editorTheme.ts（CodeMirror 6 编辑器）
  preview/      PreviewPane.tsx（Markdown 预览）
  services/     fileService.ts, renderService.ts（文件服务、渲染服务）
  state/        documentStore.ts（类型定义与初始状态）
src-tauri/
  src/
    commands/   file.rs（open/save/save_as/exit_app）, health.rs
    main.rs     Tauri 应用启动、全局快捷键注册
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + O` | 打开文件 |
| `Cmd/Ctrl + S` | 保存 |
| `Cmd/Ctrl + Shift + S` | 另存为 |
| `Cmd/Ctrl + E` | 切换到编辑模式 |
| `Cmd/Ctrl + R` | 切换到预览模式 |

## 许可证

MIT
