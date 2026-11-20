# LuaCraft RPG Studio

基于 **React + TypeScript + Lua 5.4 (`wasmoon` WASM) + AI Function Calling** 的轻量 RPG Maker 风格原型编辑器。

## 核心特性

- **像素地图编辑器**：16×16 像素渲染、4-bit Auto-tile 自动边缘拼接、多格预制件（自动带碰撞盒、木桥覆水通行、屋顶/树冠遮挡层）。
- **真 Lua 5.4 协程沙盒运行时**：通过 `wasmoon` 在浏览器中运行 Lua 5.4，支持同步风格的异步事件 API（`say` / `ask` / `move` / `wait` / `flags` / `vars` / `give_item` / `teleport` / `set_terrain` / `play_sfx`）。
- **AI 副驾驶（Cursor 模式）**：
  - 兼容任意 OpenAI 协议接口（DeepSeek / OpenAI / 硅基流动 / 本地 Ollama）与免 Key 本地演示模式。
  - 支持在画布上框选区域（`@选区`）或选中事件（`@事件`）作为上下文，通过 15 个高层语义工具修改地图和 Lua 脚本。
  - 写入前自动走 `wasmoon` Lua 语法校验，报错自动回传修复；支持事务级一键回滚与 `Ctrl+Z` / `Ctrl+Shift+Z`。

## 本地运行

```bash
npm install
npm run dev
```

构建生产静态包：

```bash
npm run build
```
