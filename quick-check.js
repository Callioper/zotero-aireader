// 快速检查插件状态
Zotero.debug("=== Quick Plugin Check ===");
Zotero.debug("Zotero.ZoteroAIRreader exists: " + (Zotero.ZoteroAIRreader ? "YES" : "NO"));
if (Zotero.ZoteroAIRreader) {
  Zotero.debug("Plugin alive: " + Zotero.ZoteroAIRreader.data.alive);
  Zotero.debug("Plugin initialized: " + Zotero.ZoteroAIRreader.data.initialized);
  Zotero.debug("hooks.onStartup exists: " + (typeof Zotero.ZoteroAIRreader.hooks.onStartup === 'function'));
  Zotero.debug("hooks.onMainWindowLoad exists: " + (typeof Zotero.ZoteroAIRreader.hooks.onMainWindowLoad === 'function'));
}

// 检查 zotero-itemmenu 是否存在
var win = Zotero.getMainWindows()[0];
if (win && win.document) {
  var itemMenu = win.document.getElementById("zotero-itemmenu");
  Zotero.debug("zotero-itemmenu exists: " + (itemMenu ? "YES" : "NO"));
}

// 手动测试：右键点击 Zotero 中的文献条目
// 如果插件工作正常，应该能看到 "AI Reader" 菜单及其子菜单项
Zotero.debug("=== End Quick Check ===");
Zotero.debug("NOTE: Manually right-click on an item in Zotero to test if AI Reader menu appears.");
