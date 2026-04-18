// Debug script for AI Reader menu
Zotero.debug("=== AI Reader Menu Debug ===");

// 1. Check if ZoteroAIRreader exists
Zotero.debug("1. Zotero.ZoteroAIRreader exists: " + (Zotero.ZoteroAIRreader ? "YES" : "NO"));

// 2. Check Zotero locale
Zotero.debug("2. Zotero locale: " + Zotero.locale);

// 3. Check if FTL file exists
var testWin = Zotero.getMainWindows()[0];
if (testWin) {
  Zotero.debug("3. Test window exists: YES");

  // Try to get the FTL file content
  try {
    var response = Services.io.newURI("chrome://zoteroAIRreader/content/locale/en-US/addon.ftl");
    Zotero.debug("3. FTL URI created: " + response.spec);
  } catch (e) {
    Zotero.debug("3. FTL URI error: " + e.message);
  }

  // 4. Check if l10n is available
  Zotero.debug("4. win.document.l10n exists: " + (testWin.document.l10n ? "YES" : "NO"));

  // 5. Try to format a string manually
  if (testWin.document.l10n) {
    Zotero.debug("5. Trying to format string...");
    testWin.document.l10n.formatValue("zotero-air-reader-menu-ai-chat").then((result) => {
      Zotero.debug("5. Formatted value: " + result);
    }).catch((e) => {
      Zotero.debug("5. Format error: " + e.message);
    });
  }
}

// 6. Check MenuManager
Zotero.debug("6. Zotero.MenuManager exists: " + (Zotero.MenuManager ? "YES" : "NO"));

// 7. Try to manually add a simple menu item to test
Zotero.debug("7. Trying to manually add test menu item...");
try {
  var itemMenu = testWin.document.getElementById("zotero-itemmenu");
  if (itemMenu) {
    var testItem = testWin.document.createXULElement("menuitem");
    testItem.setAttribute("label", "TEST LABEL");
    testItem.setAttribute("id", "test-manual-item");
    testItem.addEventListener("command", () => {
      Zotero.debug("7. Test item clicked!");
    });
    itemMenu.appendChild(testItem);
    Zotero.debug("7. Manually added test item to zotero-itemmenu");
  }
} catch (e) {
  Zotero.debug("7. Error adding test item: " + e.message);
}

Zotero.debug("=== End Debug ===");
Zotero.debug("");
Zotero.debug("NOTE: Check if 'TEST LABEL' appears in the right-click menu now.");
