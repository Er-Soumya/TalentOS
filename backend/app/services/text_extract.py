"""Resume / JD file -> plain text. Supports .pdf, .docx and .txt (scanned PDFs need OCR - not included)."""
import io
import re


def clean_text(t):
    t = (t or "").replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _pdf(data):
    try:
        try:
            import pymupdf as fitz
        except ImportError:
            import fitz
        doc = fitz.open(stream=data, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except ImportError:
        try:
            import pdfplumber
        except ImportError as e:
            raise RuntimeError("PDF support missing: pip install pymupdf") from e
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)


def _docx(data):
    from docx import Document
    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells if c.text.strip()))
    return "\n".join(parts)


def extract_text(data, ext):
    ext = (ext or "").lower()
    if ext == ".pdf":
        raw = _pdf(data)
    elif ext == ".docx":
        raw = _docx(data)
    elif ext == ".txt":
        raw = data.decode("utf-8", errors="ignore")
    else:
        raise ValueError("Unsupported file type. Please upload a PDF, DOCX or TXT file.")
    return clean_text(raw)
