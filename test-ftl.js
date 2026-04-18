// Test FTL loading
Zotero.debug("=== FTL Test ===");

var testWin = Zotero.getMainWindows()[0];
if (!testWin) {
  Zotero.debug("No main window!");
} else {
  Zotero.debug("Main window found");

  // Try to load FTL using addResourceIds
  Zotero.debug("Trying addResourceIds...");
  testWin.document.l10n?.addResourceIds(["zoteroAIRreader-addon.ftl"]);

  // Wait a bit and try to format
  testWin.setTimeout(() => {
    Zotero.debug("Trying formatValue after delay...");
    testWin.document.l10n?.formatValue("zotero-air-reader-menu-test").then((result) => {
      Zotero.debug("formatValue result: " + result);
    }).catch((e) => {
      Zotero.debug("formatValue error: " + e.message);
    });
  }, 1000);

  // Also try getting the raw FTL content
  try {
    var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Components.interfaces.nsIXMLHttpRequest);
    request.open("GET", "chrome://zoteroAIRreader/content/locale/en-US/addon.ftl", false);
    request.send(null);
    Zotero.debug("FTL request status: " + request.status);
    if (request.status === 200) {
      Zotero.debug("FTL content length: " + request.responseText.length);
      Zotero.debug("FTL content preview: " + request.responseText.substring(0, 200));
    } else {
      Zotero.debug("FTL content: " + request.responseText);
    }
  } catch (e) {
    Zotero.debug("FTL request error: " + e.message);
  }
}

Zotero.debug("=== End FTL Test ===");
