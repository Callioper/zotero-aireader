/**
 * Preferences pane script
 * Handles test connection buttons for Chat and Embedding models
 */

// Wait for window to load
window.addEventListener("load", function () {
  const testChatBtn = document.getElementById("zotero-prefpane-zoteroAIRreader-test-chat");
  const testEmbeddingBtn = document.getElementById("zotero-prefpane-zoteroAIRreader-test-embedding");
  const testChatResult = document.getElementById("zotero-prefpane-zoteroAIRreader-test-chat-result");
  const testEmbeddingResult = document.getElementById("zotero-prefpane-zoteroAIRreader-test-embedding-result");

  if (testChatBtn) {
    testChatBtn.addEventListener("click", async () => {
      testChatResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-chat-testing");
      testChatResult.style.color = "#666";
      testChatBtn.disabled = true;

      try {
        const { llmChatHealthCheck } = Zotero.ZoteroAIRreader.api;
        const result = await llmChatHealthCheck();

        if (result.ok) {
          testChatResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-chat-success");
          testChatResult.style.color = "#28a745";
        } else {
          testChatResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-chat-failed") + (result.error ? `: ${result.error}` : "");
          testChatResult.style.color = "#dc3545";
        }
      } catch (e) {
        testChatResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-chat-failed") + `: ${e.message}`;
        testChatResult.style.color = "#dc3545";
      } finally {
        testChatBtn.disabled = false;
      }
    });
  }

  if (testEmbeddingBtn) {
    testEmbeddingBtn.addEventListener("click", async () => {
      testEmbeddingResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-embedding-testing");
      testEmbeddingResult.style.color = "#666";
      testEmbeddingBtn.disabled = true;

      try {
        const { llmEmbedHealthCheck } = Zotero.ZoteroAIRreader.api;
        const result = await llmEmbedHealthCheck();

        if (result.ok) {
          testEmbeddingResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-embedding-success");
          testEmbeddingResult.style.color = "#28a745";
        } else {
          testEmbeddingResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-embedding-failed") + (result.error ? `: ${result.error}` : "");
          testEmbeddingResult.style.color = "#dc3545";
        }
      } catch (e) {
        testEmbeddingResult.textContent = document.l10n.formatValueSync("zoteroAIRreader-pref-test-embedding-failed") + `: ${e.message}`;
        testEmbeddingResult.style.color = "#dc3545";
      } finally {
        testEmbeddingBtn.disabled = false;
      }
    });
  }
});
