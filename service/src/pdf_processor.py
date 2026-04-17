from pathlib import Path
import pymupdf
from langchain_core.documents import Document


class PDFProcessor:
    def __init__(self, pdf_path: str | Path):
        self.pdf_path = Path(pdf_path)
        self.doc = None

    def extract_metadata(self) -> dict:
        self.doc = pymupdf.open(str(self.pdf_path))
        return {
            "title": self.doc.metadata.get("title", ""),
            "author": self.doc.metadata.get("author", ""),
            "pages": len(self.doc),
            "file_name": self.pdf_path.name,
        }

    def extract_toc(self) -> list[dict]:
        if self.doc is None:
            self.extract_metadata()
        toc = self.doc.get_toc()
        chapters = []
        for i, item in enumerate(toc):
            level = item[0]
            title = item[1].strip() if len(item) > 1 else f"Chapter {i+1}"
            page_num = item[2] - 1 if len(item) > 2 else 0
            chapters.append({"level": level, "title": title, "page": page_num})
        return chapters

    def extract_chapters(self) -> list[dict]:
        if self.doc is None:
            self.extract_metadata()

        toc = self.extract_toc()
        if not toc:
            return [{"title": "Full Text", "start_page": 0, "end_page": len(self.doc) - 1, "text": ""}]

        chapters = []
        for i, item in enumerate(toc):
            start_page = item["page"]
            end_page = toc[i + 1]["page"] - 1 if i + 1 < len(toc) else len(self.doc) - 1

            text_parts = []
            for page_num in range(start_page, end_page + 1):
                if page_num < len(self.doc):
                    text = self.doc[page_num].get_text("text")
                    if text.strip():
                        text_parts.append(text)

            chapters.append({
                "level": item["level"],
                "title": item["title"],
                "start_page": start_page,
                "end_page": end_page,
                "text": "\n".join(text_parts),
            })
        return chapters

    def close(self):
        if self.doc:
            self.doc.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def extract_pdf(pdf_path: str | Path) -> tuple[list[Document], dict]:
    processor = PDFProcessor(pdf_path)
    metadata = processor.extract_metadata()
    chapters = processor.extract_chapters()

    documents = []
    for i, chapter in enumerate(chapters):
        doc = Document(
            page_content=chapter.get("text", ""),
            metadata={
                "chapter_index": i,
                "chapter_title": chapter.get("title", f"Chapter {i+1}"),
                "chapter_level": chapter.get("level", 1),
                "start_page": chapter.get("start_page", 0),
                "end_page": chapter.get("end_page", 0),
                "source": str(pdf_path),
            }
        )
        documents.append(doc)

    processor.close()
    return documents, metadata