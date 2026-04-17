# Zotero 插件本地调试指南

## 一、为什么可以本地调试

**关键误解澄清：**

- `zotero-cli` 确实是 Zotero API 命令行客户端，不能调试插件
- **但 Zotero 本身支持本地调试**，只是需要正确配置

**Zotero 官方支持：**

1. Zotero Beta 版本包含完整的 Firefox Developer Tools
2. 通过 `-jsdebugger` 参数启动 Browser Toolbox
3. 支持 `Zotero.debug()` 输出调试日志
4. 可使用独立的开发 profile（避免污染生产数据）

---

## 二、本地调试配置步骤

### 1. 安装 Zotero Beta

| 平台      | 下载地址                                      |
| ------- | ----------------------------------------- |
| Windows | https://www.zotero.org/download/beta      |
| macOS   | 下载 beta channel 版本                        |
| Linux   | `sudo apt install zotero-beta` 或下载官方 beta |

**重要：使用独立的开发 profile**

```bash
# Windows: 创建独立的数据目录
# 启动时添加 -profile 参数指定目录
"Zotero Beta.exe" -profile "D:\ZoteroDevProfile"
```

### 2. 启用调试模式

**方法A：命令行参数**

```bash
# Windows
"C:\Program Files\Zotero Beta\zotero.exe" -jsdebugger -ZoteroDebugText -profile "D:\ZoteroDevProfile"

# macOS
/Applications/Zotero\ Beta.app/Contents/MacOS/zotero -jsdebugger -ZoteroDebugText

# Linux
zotero -jsdebugger -ZoteroDebugText
```

**方法B：修改 profile 配置文件**

```
Windows: %APPDATA%\Zotero\ZoteroDevProfile\prefs.js
macOS:   ~/Library/Application Support/Zotero/Profiles/devprofile/prefs.js
Linux:   ~/.zotero/devprofile/prefs.js
```

添加：

```javascript
user_pref("browser.dom.window.dump.enabled", true);
user_pref("javascript.enabled", true);
user_pref("zotero.debug.log", true);
user_pref("zotero.debug.showInConsole", true);
```

### 3. 调试工具

**Browser Toolbox（类似 Firefox DevTools）**

1. 启动 Zotero Beta 加 `-jsdebugger` 参数
2. 打开 `Tools → Developer → Browser Toolbox`
3. 可设置断点、检查 DOM、查看网络请求

**JavaScript Console**

1. `Tools → Developer → Developer Tools`
2. 打开 Scratchpad 或 Console
3. 可执行任意 Zotero API 代码片段

### 4. 查看调试输出

**Debug Output Logging**

```
Help → Debug Output Logging → View Output
```

会显示所有 `Zotero.debug()` 输出

---

## 三、使用 zotero-plugin 的开发模式

### 1. 配置插件模板

```bash
# 克隆模板
git clone https://github.com/windingwind/zotero-plugin-template.git
cd zotero-plugin-template

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env
```

### 2. 配置 .env 文件

```bash
# Windows 示例
ZOTERO_PATH="C:\Program Files\Zotero Beta\Zotero.exe"
ZOTERO_PROFILE="D:\ZoteroDevProfile"
```

### 3. 启动开发模式

```bash
npm start
```

这会自动：

- 编译 TypeScript 源码
- 监听文件变化热重载
- 安装插件到 Zotero

---

## 四、快速验证插件是否正常

### 1. 构建测试

```bash
# 在项目目录执行
npm run build

# 或手动 esbuild
./node_modules/.bin/esbuild src/index.ts \
  --bundle \
  --target=firefox115 \
  --outfile=.scaffold/build/addon/content/scripts/你的插件名.js
```

### 2. 本地安装 .xpi

1. 在 Zotero: `Tools → Developer → Load Addon`
2. 选择 `build/*.xpi` 文件
3. 插件会被安装并启用

### 3. 查看错误日志

如果插件加载失败，检查：

```
Help → Debug Output Logging → View Output
```

常见错误：

- `__env__ is not defined` → 需要 esbuild define 配置
- `ztoolkit is not defined` → 依赖未正确 external
- 菜单项不显示 → 检查 `registerMenu()` 是否被调用

---

## 五、推荐的工作流程

```
┌─────────────────────────────────────────────────────────────┐
│  开发循环                                                  │
│                                                             │
│  1. 修改代码 → 2. npm run build → 3. Load Addon → 4. 测试   │
│                            ↑                                │
│                            │                               │
│                     如果报错，看日志                         │
│                     回到步骤1                              │
└─────────────────────────────────────────────────────────────┘
```

**开发技巧：**

1. 使用 `Zotero.debug("message")` 输出调试信息
2. 先用 `npm run build` 确保能编译成功
3. 用 Load Addon 测试，避免每次重装
4. 查看 Help → Debug Output Logging 排查问题

---

## 六、关键技术点

### 1. esbuild 配置（关键！）

如果看到 `__env__ is not defined`，需要在 esbuild 命令中定义：

```bash
esbuild src/index.ts \
  --bundle \
  --define:__env='"production"' \
  --outfile=output.js
```

或通过 `zotero-plugin.config.ts` 配置：

```typescript
esbuildOptions: [{
  entryPoints: ['src/index.ts'],
  define: {
    __env__: `"${process.env.NODE_ENV}"`,
  },
}]
```

### 2. 外部依赖处理

所有第三方依赖必须标记为 `--external`：

```bash
esbuild src/index.ts \
  --bundle \
  --external:zotero-plugin-toolkit \
  --external:zotero-types \
  --outfile=output.js
```

### 3. 确保无 toolkit 残留

构建后检查 bundle 内容：

```bash
# 检查是否还有 toolkit 引用
grep -i "zotero-plugin-toolkit" output.js
grep -i "createZToolkit" output.js
grep -i "__env__" output.js
```

---

## 七、常见问题排查

| 问题                        | 原因               | 解决方案                                  |
| ------------------------- | ---------------- | ------------------------------------- |
| 插件无反应                     | startup 未调用      | 添加 `Zotero.debug()` 检查                |
| 菜单不显示                     | registerMenu 未调用 | 在 onMainWindowLoad 中调用                |
| `__env__ is not defined`  | esbuild 未定义      | 添加 `--define:__env='\"production\"'`  |
| `ztoolkit is not defined` | 依赖未 external     | 添加 `--external:zotero-plugin-toolkit` |
| 热重载不工作                    | watch 模式问题       | 使用 `npm start` 或手动 rebuild            |

---

## 八、参考资源

| 资源                 | 链接                                                                         |
| ------------------ | -------------------------------------------------------------------------- |
| Zotero 开发者文档       | https://www.zotero.org/support/dev/zotero_7_for_developers                 |
| 官方示例插件 Make It Red | https://github.com/zotero/make-it-red                                      |
| 插件模板               | https://github.com/windingwind/zotero-plugin-template                      |
| Zotero Beta 下载     | https://www.zotero.org/download/beta                                       |
| Browser Toolbox 调试 | https://firefox-source-docs.mozilla.org/devtools-backend/browserscope.html |
