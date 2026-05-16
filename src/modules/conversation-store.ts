import { config } from "../../package.json";

interface StoredConversation {
  itemId: number;
  messages: Array<{ role: string; content: string }>;
  metadata: any;
  updatedAt: number;
}

export class ConversationStore {
  private initialized = false;

  private getPath(itemId: number): string {
    return `${Zotero.DataDirectory}/ai-reader-conversations/${itemId}.json`;
  }

  private ensureDir(): void {
    if (this.initialized) return;
    try {
      Zotero.File.createDirectoryIfMissing(
        `${Zotero.DataDirectory}/ai-reader-conversations`,
      );
      this.initialized = true;
    } catch (e) {
      Zotero.debug("AI Reader: failed to create conversations dir: " + e);
    }
  }

  save(itemId: number, messages: any[], metadata: any): void {
    this.ensureDir();
    if (!this.initialized) return;

    const data: StoredConversation = {
      itemId,
      messages,
      metadata,
      updatedAt: Date.now(),
    };
    try {
      Zotero.File.putContents(this.getPath(itemId), JSON.stringify(data));
    } catch (e) {
      Zotero.debug("AI Reader: failed to save conversation: " + e);
    }
  }

  load(itemId: number): StoredConversation | null {
    try {
      const raw = Zotero.File.getContents(this.getPath(itemId));
      const parsed = JSON.parse(raw);
      Zotero.debug(
        `AI Reader: loaded conversation for item ${itemId} (${parsed.messages.length} messages)`,
      );
      return parsed;
    } catch {
      return null;
    }
  }

  async delete(itemId: number): Promise<void> {
    try {
      await Zotero.File.removeIfExists(this.getPath(itemId));
    } catch { /* ignore */ }
  }
}

export const conversationStore = new ConversationStore();
