# Zotero AI Reader - 崩溃问题诊断与修复方案

## 问题描述

**症状**：
- 设置面板文字不显示（l10n 无法解析）
- 右键菜单无法正常唤出

**之前成功修复过的问题**：
- 菜单 l10n 加载时机：FTL 资源需要在 `registerMenu()` 之前加载到主 window
- FTL key 格式：`.label` 属性格式

## 崩溃根因分析

### 1. Localization 类未定义

错误日志：
```
ReferenceError: Localization is not defined
{file: "jar:file:///.../zoteroAIRreader.js" line: 0}
```

**可能原因**：
- 插件代码在 Zotero 的 Localization 类初始化之前执行
- 某些构建产物中 Localization 全局对象不可用

### 2. 重复注册导致冲突

错误日志：
```
MenuAPI: 'menuID' must be unique, got zotero-ai-reader\@callioper-air-reader-menu
ItemPaneSectionAPI: 'paneID' must be unique, got zotero-ai-reader\@callioper-zotero-ai-reader-panel
```

**可能原因**：
- 插件被多次加载（Zotero 启动时加载一次，开发者重新加载一次）
- `onShutdown` 未完全清理注册信息

### 3. L10n Key 不匹配

FTL 文件中的 key 格式：
```
zoteroAIRreader-pref-llm-provider = LLM 提供商
```

XHTML 中的引用：
```html
data-l10n-id="pref-llm-provider"
```

**问题**：scaffold 会自动添加 `zoteroAIRreader-` 前缀，所以实际 key 是 `zoteroAIRreader-pref-llm-provider`，但 XHTML 引用的是 `pref-llm-provider`。

## 防御性修复方案

### 1. 修改 hooks.ts - 添加 Localization 检查

```typescript
// 在 onStartup 中，不要直接使用 new Localization()
// 而是依赖主 window 的 l10n 系统
async function onStartup() {
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;
  await Zotero.uiReadyPromise;

  Zotero.debug("AI Reader: onStartup called");

  // 不要在这里创建 Localization 实例
  // 只依赖主 window 的 l10n 系统来加载 FTL

  const mainWindow = Zotero.getMainWindow();
  if (mainWindow && mainWindow.document.l10n) {
    mainWindow.document.l10n.addResourceIds([`${config.addonRef}-addon.ftl`]);
    Zotero.debug("AI Reader: FTL resources added to main window");
  }

  // ... 继续其他注册
}
```

### 2. 确保 FTL 文件格式正确

每个 l10n key 必须是完整格式：
```
key =
  .label = Text
```

注意：
- key 和 `.label` 之间有空行
- `.label` 缩进两个空格

### 3. 检查 XHTML 中的 l10n-id

所有 `data-l10n-id` 属性必须使用**完整 key**（带前缀）：

```html
<!-- 错误 -->
data-l10n-id="pref-llm-provider"

<!-- 正确 -->
data-l10n-id="zoteroAIRreader-pref-llm-provider"
```

### 4. 防止重复注册

在 `onShutdown` 中确保完全清理：

```typescript
function onShutdown() {
  Zotero.debug("AI Reader: onShutdown called");

  aiPanel.unregister();
  unregisterReaderListeners();

  if (registeredPrefsPaneID) {
    try {
      Zotero.PreferencePanes.unregister(registeredPrefsPaneID);
    } catch (e) {}
    registeredPrefsPaneID = false;
  }

  // 清理菜单注册
  try {
    Zotero.MenuManager.unregisterMenu("air-reader-menu");
  } catch (e) {}

  // @ts-ignore
  delete Zotero[config.addonInstance];
}
```

### 5. 检查清单 - 发布前必须验证

```
✅ 1. FTL 文件包含所有 l10n key（无遗漏）
✅ 2. XHTML 中所有 data-l10n-id 使用完整 key（带前缀）
✅ 3. bootstrap.js 正确注册 chrome locale
✅ 4. hooks.ts 中 FTL 在 registerMenu 之前加载
✅ 5. onShutdown 完全清理所有注册
✅ 6. 构建产物中 FTL 文件存在且格式正确
✅ 7. 在 Zotero 中测试：设置面板文字显示
✅ 8. 在 Zotero 中测试：右键菜单工作
```

## 快速诊断命令

### 检查 FTL 文件是否完整

```powershell
# 在 .scaffold/build/addon/locale/zh-CN/ 中
Get-Content zoteroAIRreader-addon.ftl | Select-String "zoteroAIRreader-"
```

### 验证 XHTML 中的 l10n-id

```powershell
# 检查是否有不完整 key（不带前缀）
Select-String -Path "*.xhtml" -Pattern 'data-l10n-id="(?!zoteroAIRreader-)[^"]+"'
```

### 构建后检查

```powershell
# 检查构建产物中的 FTL 大小
Get-Item .scaffold/build/addon/locale/zh-CN/zoteroAIRreader-addon.ftl | Select-Object Length

# 应该 > 1000 bytes（小于此值说明可能缺失内容）
```

## 常见问题快速修复

### Q: 设置面板文字显示为 key（如 "zoteroAIRreader-pref-llm-provider"）

A: XHTML 中的 `data-l10n-id` 缺少前缀。检查 preferences.xhtml 中的所有 `data-l10n-id` 属性，确保使用完整 key。

### Q: 设置面板一片空白

A: FTL 文件未加载或不存在。检查 bootstrap.js 中 chrome 注册和 locale 配置。

### Q: 右键菜单不显示

A: FTL 加载时机问题。确保 `document.l10n.addResourceIds()` 在 `registerMenu()` 之前调用。

### Q: "Localization is not defined" 错误

A: 不要在 onStartup 中创建 Localization 实例。使用主 window 的 l10n 系统：

```typescript
// 错误 - 会导致 "Localization is not defined"
const l10n = new Localization([...], true);

// 正确 - 使用主 window 的 l10n 系统
const mainWindow = Zotero.getMainWindow();
if (mainWindow && mainWindow.document.l10n) {
  mainWindow.document.l10n.addResourceIds([`${config.addonRef}-addon.ftl`]);
}
```

## 监控与日志

在关键位置添加调试日志：

```typescript
Zotero.debug("AI Reader: FTL resources " + (hasFTL ? "loaded" : "MISSING"));
Zotero.debug("AI Reader: Menu registration " + (success ? "OK" : "FAILED"));
Zotero.debug("AI Reader: Prefs pane registration " + (success ? "OK" : "FAILED"));
```

## 相关文件

- `addon/bootstrap.js` - chrome 注册、locale 注册
- `src/hooks.ts` - FTL 加载、菜单/面板注册
- `addon/locale/zh-CN/addon.ftl` - 中文本地化
- `addon/locale/en-US/addon.ftl` - 英文本地化
- `addon/content/preferences.xhtml` - 设置面板 UI