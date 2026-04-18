/**
 * PDF Text Extraction Module
 *
 * Handles:
 * - Getting full text from PDF attachments via Zotero API
 * - Finding PDF attachments from regular items
 * - Text utilities for prompt context building
 */

import { config } from "../../package.json";

/**
 * Get the full text content of a PDF attachment.
 * Uses Zotero's built-in text extraction (attachment.attachmentText).
 */
export async function getFullText(item: any): Promise<string | null> {
  try {
    const attachment = await findPDFAttachment(item);
    if (!attachment) {
      Zotero.debug("AI Reader: no PDF attachment found for text extraction");
      return null;
    }

    const text = await attachment.attachmentText;
    if (text) {
      Zotero.debug(`AI Reader: extracted full text (${text.length} chars)`);
    }
    return text || null;
  } catch (e) {
    Zotero.debug("AI Reader: text extraction failed: " + e);
    return null;
  }
}

/**
 * Get the file system path of the PDF attachment.
 */
export async function getPDFPath(item: any): Promise<string | null> {
  try {
    const attachment = await findPDFAttachment(item);
    if (!attachment) return null;
    return await attachment.getFilePath();
  } catch (e) {
    Zotero.debug("AI Reader: failed to get PDF path: " + e);
    return null;
  }
}

/**
 * Find the first PDF attachment from a Zotero item.
 * Handles both regular items (finds child PDF) and PDF attachment items directly.
 */
export async function findPDFAttachment(item: any): Promise<any | null> {
  // If the item itself is a PDF attachment
  if (item.isAttachment?.() && item.isPDFAttachment?.()) {
    return item;
  }

  // If it's a regular item, find child PDF attachments
  if (item.isRegularItem?.()) {
    const attachmentIDs = item.getAttachments();
    for (const id of attachmentIDs) {
      const att = Zotero.Items.get(id);
      if (att && att.isPDFAttachment()) {
        return att;
      }
    }
  }

  return null;
}

/**
 * Extract bibliographic metadata from a Zotero item.
 */
export function extractItemMetadata(item: any): {
  title: string;
  creators: string[];
  date?: string;
  abstractNote?: string;
  itemType?: string;
} {
  // Navigate to parent regular item if this is an attachment
  let regularItem = item;
  if (item.isAttachment?.()) {
    const parentId = item.parentID;
    if (parentId) {
      regularItem = Zotero.Items.get(parentId);
    }
  }

  try {
    const creators = regularItem.getCreators?.() || [];
    const creatorNames = creators.map((c: any) => {
      if (c.firstName && c.lastName) return `${c.firstName} ${c.lastName}`;
      return c.lastName || c.firstName || c.name || "";
    });

    return {
      title: regularItem.getField?.("title") || "",
      creators: creatorNames,
      date: regularItem.getField?.("date") || undefined,
      abstractNote: regularItem.getField?.("abstractNote") || undefined,
      itemType: regularItem.itemType || undefined,
    };
  } catch (e) {
    Zotero.debug("AI Reader: metadata extraction failed: " + e);
    return { title: "", creators: [] };
  }
}

/**
 * Truncate text to a maximum character count, trying to break at sentence boundaries.
 * Useful for keeping prompts within token limits.
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Try to break at the last sentence boundary before the limit
  const truncated = text.substring(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf("。"),
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf(".\n"),
  );

  if (lastPeriod > maxChars * 0.8) {
    return truncated.substring(0, lastPeriod + 1) + "\n\n[文本已截断]";
  }

  return truncated + "...\n\n[文本已截断]";
}
