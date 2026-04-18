/**
 * Annotation Manager
 *
 * Creates Zotero annotations from AI-extracted quotes.
 * Two strategies:
 *   1. Highlight annotations (requires PDF coordinates - best effort via Reader PDF.js)
 *   2. Note annotations (fallback - always works, no coordinates needed)
 *
 * All AI-generated annotations are tagged with "AI-Generated" and the skill name.
 */

import { config } from "../../package.json";
import { ExtractedQuote } from "./skills/types";

const AI_TAG = "AI-Generated";

/** Result of creating an annotation */
export interface AnnotationResult {
  success: boolean;
  annotationId?: number;
  type: "highlight" | "note";
  error?: string;
}

/**
 * Parse all [[QUOTE: "..."]] markers from text.
 */
export function parseQuotes(text: string): string[] {
  const quotes: string[] = [];
  const regex = /\[\[QUOTE:\s*"([^"]+)"\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    quotes.push(match[1]);
  }
  return quotes;
}

/**
 * Create annotations for all quotes extracted from an AI response.
 *
 * @param attachmentId - The PDF attachment's Zotero item ID
 * @param quotes - Array of extracted quotes
 * @param color - Annotation color (hex, e.g. "#ffd400")
 * @param skillName - Skill name for tagging
 * @param comment - Optional comment to add to annotations
 */
export async function createAnnotationsFromQuotes(
  attachmentId: number,
  quotes: ExtractedQuote[],
  color: string,
  skillName: string,
  comment?: string,
): Promise<AnnotationResult[]> {
  const results: AnnotationResult[] = [];

  for (const quote of quotes) {
    try {
      const result = await createAnnotationForQuote(
        attachmentId,
        quote.text,
        color,
        skillName,
        quote.comment || comment,
      );
      results.push(result);
    } catch (e) {
      results.push({
        success: false,
        type: "note",
        error: String(e),
      });
    }
  }

  Zotero.debug(`AI Reader: created ${results.filter((r) => r.success).length}/${results.length} annotations`);
  return results;
}

/**
 * Create a single annotation for a quoted text.
 * Tries highlight first, falls back to note.
 */
async function createAnnotationForQuote(
  attachmentId: number,
  quoteText: string,
  color: string,
  skillName: string,
  comment?: string,
): Promise<AnnotationResult> {
  // Try to find the text position in the PDF for a highlight annotation
  const position = await tryFindTextPosition(attachmentId, quoteText);

  if (position) {
    return await createHighlightAnnotation(attachmentId, quoteText, position, color, skillName, comment);
  }

  // Fallback: create a note annotation
  return await createNoteAnnotation(attachmentId, quoteText, color, skillName, comment);
}

// ─── Highlight Annotation (with coordinates) ────────────────

interface TextPosition {
  pageIndex: number;
  rects: number[][];
}

/**
 * Try to find the position of text in the PDF using the active reader's PDF.js instance.
 * Returns null if coordinates cannot be determined.
 */
async function tryFindTextPosition(attachmentId: number, searchText: string): Promise<TextPosition | null> {
  try {
    // Find the reader instance for this attachment
    const reader = findReaderForAttachment(attachmentId);
    if (!reader) {
      Zotero.debug("AI Reader: no active reader found for attachment " + attachmentId);
      return null;
    }

    // Try to access the internal PDF.js viewer
    const iframeWindow = (reader as any)._iframeWindow;
    if (!iframeWindow) {
      Zotero.debug("AI Reader: reader iframe not accessible");
      return null;
    }

    // Access PDF.js through the iframe
    const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
    const pdfApp = wrappedWindow.PDFViewerApplication;
    if (!pdfApp || !pdfApp.pdfDocument) {
      Zotero.debug("AI Reader: PDFViewerApplication not available");
      return null;
    }

    // Search for the text across pages
    const numPages = pdfApp.pdfDocument.numPages;
    const normalizedSearch = normalizeText(searchText);

    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      const page = await pdfApp.pdfDocument.getPage(pageIdx + 1); // PDF.js pages are 1-indexed
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      const normalizedPage = normalizeText(pageText);

      const matchIdx = normalizedPage.indexOf(normalizedSearch);
      if (matchIdx === -1) continue;

      // Found the text on this page - try to get bounding rectangles
      const rects = extractRectsFromTextContent(textContent, searchText, matchIdx);
      if (rects && rects.length > 0) {
        Zotero.debug(`AI Reader: found text position on page ${pageIdx}`);
        return { pageIndex: pageIdx, rects };
      }

      // If we found the text but can't get exact rects, return page-level position
      // with a dummy rect that covers the page width
      Zotero.debug(`AI Reader: found text on page ${pageIdx} but couldn't extract rects`);
      return null; // Fall back to note annotation
    }

    Zotero.debug("AI Reader: text not found in any PDF page");
    return null;
  } catch (e) {
    Zotero.debug("AI Reader: text position search failed: " + e);
    return null;
  }
}

/**
 * Extract bounding rectangles for matched text from PDF.js textContent.
 * This is a best-effort approach - PDF text layout can be complex.
 */
function extractRectsFromTextContent(
  textContent: any,
  searchText: string,
  _matchIdx: number,
): number[][] | null {
  try {
    const items = textContent.items;
    const normalizedSearch = normalizeText(searchText);
    let accumulated = "";
    const rects: number[][] = [];
    let collecting = false;
    let collectedLength = 0;

    for (const item of items) {
      if (!item.str) continue;

      const normalizedItem = normalizeText(item.str);
      accumulated += normalizedItem + " ";

      // Check if we've reached the start of the match
      if (!collecting && accumulated.includes(normalizedSearch.substring(0, 10))) {
        collecting = true;
      }

      if (collecting) {
        // Extract the transform to get position
        // PDF.js textContent item has: str, dir, width, height, transform[6]
        // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const tx = item.transform;
        if (tx && tx.length >= 6) {
          const x = tx[4];
          const y = tx[5];
          const w = item.width || 0;
          const h = item.height || (tx[3] || 12);
          rects.push([x, y, x + w, y + h]);
        }

        collectedLength += normalizedItem.length;
        if (collectedLength >= normalizedSearch.length) {
          break;
        }
      }
    }

    return rects.length > 0 ? rects : null;
  } catch (e) {
    Zotero.debug("AI Reader: rect extraction failed: " + e);
    return null;
  }
}

async function createHighlightAnnotation(
  attachmentId: number,
  text: string,
  position: TextPosition,
  color: string,
  skillName: string,
  comment?: string,
): Promise<AnnotationResult> {
  try {
    const annotation = new Zotero.Item("annotation");
    annotation.parentID = attachmentId;
    annotation.annotationType = "highlight";
    annotation.annotationText = text;
    annotation.annotationComment = comment || `[${skillName}] AI 分析提取`;
    annotation.annotationColor = color;
    annotation.annotationPosition = JSON.stringify({
      pageIndex: position.pageIndex,
      rects: position.rects,
    });

    // Add tags
    annotation.addTag(AI_TAG);
    annotation.addTag(skillName);

    await annotation.saveTx();

    Zotero.debug(`AI Reader: created highlight annotation ${annotation.id} on page ${position.pageIndex}`);
    return {
      success: true,
      annotationId: annotation.id,
      type: "highlight",
    };
  } catch (e) {
    Zotero.debug("AI Reader: highlight annotation creation failed: " + e);
    // Fall back to note
    return createNoteAnnotation(attachmentId, text, color, skillName, comment);
  }
}

// ─── Note Annotation (fallback, no coordinates needed) ──────

async function createNoteAnnotation(
  attachmentId: number,
  text: string,
  color: string,
  skillName: string,
  comment?: string,
): Promise<AnnotationResult> {
  try {
    const annotation = new Zotero.Item("annotation");
    annotation.parentID = attachmentId;
    annotation.annotationType = "note";
    annotation.annotationComment = `[${skillName}] ${comment || "AI 提取引用"}\n\n> ${text}`;
    annotation.annotationColor = color;
    // Note annotations need a minimal position (just pageIndex)
    annotation.annotationPosition = JSON.stringify({
      pageIndex: 0,
      rects: [[0, 0, 0, 0]],
    });

    annotation.addTag(AI_TAG);
    annotation.addTag(skillName);

    await annotation.saveTx();

    Zotero.debug(`AI Reader: created note annotation ${annotation.id}`);
    return {
      success: true,
      annotationId: annotation.id,
      type: "note",
    };
  } catch (e) {
    Zotero.debug("AI Reader: note annotation creation failed: " + e);
    return {
      success: false,
      type: "note",
      error: String(e),
    };
  }
}

// ─── Utilities ──────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ") // non-breaking space
    .trim()
    .toLowerCase();
}

/**
 * Find the Zotero.Reader instance that has a specific attachment open.
 */
function findReaderForAttachment(attachmentId: number): any | null {
  try {
    // Zotero.Reader._readers is an internal array of active reader instances
    const readers = (Zotero.Reader as any)._readers;
    if (!readers || !Array.isArray(readers)) return null;

    for (const reader of readers) {
      if (reader.itemID === attachmentId) {
        return reader;
      }
    }
    return null;
  } catch (e) {
    Zotero.debug("AI Reader: failed to find reader instance: " + e);
    return null;
  }
}

/**
 * Navigate the active reader to a specific page.
 * Useful for the "locate" button in the AI panel.
 */
export async function navigateToPage(attachmentId: number, pageIndex: number): Promise<boolean> {
  try {
    const reader = findReaderForAttachment(attachmentId);
    if (!reader) return false;

    const iframeWindow = (reader as any)._iframeWindow;
    if (!iframeWindow) return false;

    const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
    const pdfApp = wrappedWindow.PDFViewerApplication;
    if (pdfApp) {
      pdfApp.page = pageIndex + 1; // PDF.js uses 1-indexed pages
      return true;
    }
    return false;
  } catch (e) {
    Zotero.debug("AI Reader: navigation failed: " + e);
    return false;
  }
}

/**
 * Search for text in the active reader and navigate to it.
 * Uses PDF.js findController for in-document search.
 */
export async function findAndNavigateToText(attachmentId: number, searchText: string): Promise<boolean> {
  try {
    const reader = findReaderForAttachment(attachmentId);
    if (!reader) return false;

    const iframeWindow = (reader as any)._iframeWindow;
    if (!iframeWindow) return false;

    const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
    const pdfApp = wrappedWindow.PDFViewerApplication;
    if (!pdfApp || !pdfApp.findController) return false;

    // Use PDF.js find controller to search and navigate
    pdfApp.findController.executeCommand("find", {
      query: searchText.substring(0, 100), // Limit search text length
      phraseSearch: true,
      caseSensitive: false,
      highlightAll: true,
      findPrevious: false,
    });

    Zotero.debug(`AI Reader: initiated text search for "${searchText.substring(0, 30)}..."`);
    return true;
  } catch (e) {
    Zotero.debug("AI Reader: find and navigate failed: " + e);
    return false;
  }
}
