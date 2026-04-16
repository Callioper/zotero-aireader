import { apiClient } from "./modules/api-client";

export default {
  onStartUp() {
    // 插件启动
  },

  onShutDown() {
    // 插件关闭
  },

  async onMainWindowLoad(window: Window) {
    // 注册菜单
    this.registerMenus();
  },

  registerMenus() {
    const menuString = `
      <menupopup id="zotero-item-menu">
        <menuitem id="zotero-ai-reader-chat"
                  label="AI 问答"
                  oncommand="addon.hooks.onAIChat()"/>
        <menuitem id="zotero-ai-reader-summarize"
                  label="总结文献"
                  oncommand="addon.hooks.onSummarize()"/>
        <menuitem id="zotero-ai-reader-search"
                  label="语义搜索"
                  oncommand="addon.hooks.onSearch()"/>
      </menupopup>
    `;
    // 实际注册逻辑使用 zotero-toolkit
  },

  async onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    const item = items[0];
    const attachment = item.getAttachment?.();
    if (!attachment) return;

    const pdfPath = await attachment.getFilePath?.();
    if (!pdfPath) return;

    // 索引
    await apiClient.indexItem(item.id, pdfPath);

    // 打开问答面板
    const question = await this.showPrompt("AI 问答", "请输入您的问题:");
    if (!question) return;

    const response = await apiClient.chat({
      item_id: item.id,
      question,
      use_rag: true,
    });

    this.showAnswer(response);
  },

  async onSummarize() {
    // 实现总结功能
  },

  async onSearch() {
    // 实现语义搜索
  },

  async showPrompt(title: string, message: string): Promise<string | null> {
    // 显示输入对话框
    return new Promise((resolve) => {
      const result = window.prompt(message, "");
      resolve(result);
    });
  },

  showAnswer(response: any) {
    // 显示回答
    const msg = response.answer + "\n\n参考来源:\n" +
      response.citations.map((c: any) => `[${c.index}] ${c.chapter_title}: ${c.quoted_text}`).join("\n");
    window.alert(msg);
  },
};