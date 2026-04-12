"""
Production-grade document parser for PDFs and images.

Strategy (3-tier):
  1. pdfplumber explicit table extraction (fastest, most accurate for native PDFs)
  2. Layout-preserving text → LLM structuring (handles non-grid bank statements)
  3. OCR → LLM structuring (handles scanned documents)

The LLM layer is the key differentiator: instead of blindly splitting text by
whitespace (which creates garbage columns), we send raw text to the LLM and
ask it to return clean, structured CSV with proper headers.
"""
import io
import os
import json
import re
import pandas as pd
import pdfplumber
from PIL import Image
import pytesseract

# Configure tesseract path (brew installs to /usr/local/Cellar)
import shutil
_tesseract_path = shutil.which("tesseract")
if not _tesseract_path:
    # Check common brew locations
    for p in ["/usr/local/bin/tesseract", "/usr/local/Cellar/tesseract/5.5.2/bin/tesseract", "/opt/homebrew/bin/tesseract"]:
        if os.path.exists(p):
            _tesseract_path = p
            break
if _tesseract_path:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_path
    print(f"[DocumentParser] Tesseract found at: {_tesseract_path}")
else:
    print("[DocumentParser] WARNING: Tesseract not found. OCR will be unavailable.")


# ──────────────────────────────────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────────────────────────────────

def _list_to_df(all_rows: list) -> pd.DataFrame:
    """Convert a list of lists into a DataFrame with safe headers."""
    if not all_rows:
        return pd.DataFrame()

    max_cols = max(len(row) for row in all_rows)
    if max_cols == 0:
        return pd.DataFrame()

    # Pad rows to uniform width
    padded = [row + [""] * (max_cols - len(row)) for row in all_rows]

    # Headers
    headers = padded[0]
    headers = [str(h).strip() if h else f"Column_{i+1}" for i, h in enumerate(headers)]

    # Deduplicate headers
    seen: dict[str, int] = {}
    final: list[str] = []
    for h in headers:
        if h in seen:
            seen[h] += 1
            final.append(f"{h}_{seen[h]}")
        else:
            seen[h] = 0
            final.append(h)

    return pd.DataFrame(padded[1:], columns=final)


def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Production-grade data cleaning:
    - Remove fully empty rows / columns
    - Auto-cast numeric columns
    - Remove garbage columns (>90% nulls or all identical)
    - Strip whitespace from string cells
    """
    if df.empty:
        return df

    # 1. Strip whitespace
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "none": pd.NA})

    # 2. Drop fully empty rows and columns
    df = df.dropna(how="all")
    df = df.dropna(axis=1, how="all")

    if df.empty:
        return df

    # 3. Auto-cast numeric columns
    for col in df.columns:
        # Remove currency symbols and commas for numeric detection
        cleaned = df[col].astype(str).str.replace(r'[$€£₹,]', '', regex=True).str.strip()
        try:
            numeric = pd.to_numeric(cleaned, errors="coerce")
            if numeric.notna().sum() > len(df) * 0.5:  # >50% are valid numbers
                df[col] = numeric
        except Exception:
            pass

    # 4. Remove garbage columns (>90% null or all identical values)
    cols_to_drop = []
    for col in df.columns:
        null_ratio = df[col].isna().sum() / len(df)
        if null_ratio > 0.9:
            cols_to_drop.append(col)
        elif df[col].nunique() <= 1:
            cols_to_drop.append(col)
    df = df.drop(columns=cols_to_drop, errors="ignore")

    # 5. Remove duplicate rows
    df = df.drop_duplicates()

    return df.reset_index(drop=True)


# ──────────────────────────────────────────────────────────────────────────────
# LLM-powered structured extraction
# ──────────────────────────────────────────────────────────────────────────────

def _llm_extract_table_from_text(raw_text: str) -> pd.DataFrame:
    """
    Send raw document text to the LLM and ask it to extract structured
    tabular data as CSV. This is the intelligence layer that converts
    messy OCR / layout text into clean, meaningful columns.
    """
    if not raw_text or len(raw_text.strip()) < 20:
        return pd.DataFrame()

    try:
        from src.utils.llm_factory import _get_base_llm

        # Truncate to avoid blowing up context window
        text_sample = raw_text[:6000]

        prompt = (
            "You are a data extraction expert. Below is raw text extracted from a financial document "
            "(likely a bank statement, invoice, or transaction report).\n\n"
            "Your job:\n"
            "1. Identify ALL tabular/transactional data in the text.\n"
            "2. Return it as valid CSV (comma-separated) with a proper header row.\n"
            "3. Use meaningful column names like: Date, Description, Debit, Credit, Balance, "
            "Reference, Amount, Category, etc.\n"
            "4. Clean up any OCR artifacts or formatting noise.\n"
            "5. If there are monetary values, keep them as plain numbers (no currency symbols).\n"
            "6. If dates exist, use YYYY-MM-DD format.\n"
            "7. Output ONLY the CSV data. No explanation, no markdown code blocks, no extra text.\n\n"
            f"--- RAW DOCUMENT TEXT ---\n{text_sample}\n--- END ---\n\n"
            "CSV output:"
        )

        # Use higher token limit — we need the LLM to return full CSV rows
        llm = _get_base_llm(temperature=0.1, max_tokens=4096)
        print(f"[DocumentParser] Sending {len(text_sample)} chars to LLM for structured extraction...")
        response = llm.invoke(prompt)
        content = response.content.strip()

        # Strip markdown fences if present
        if content.startswith("```csv"):
            content = content[6:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        if not content:
            print("[DocumentParser] LLM returned empty content")
            return pd.DataFrame()

        # Parse CSV from LLM response
        df = pd.read_csv(io.StringIO(content), on_bad_lines="skip")
        print(f"[DocumentParser] LLM extracted {len(df)} rows x {len(df.columns)} cols: {list(df.columns)}")
        return df

    except Exception as e:
        print(f"[DocumentParser] LLM extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


# ──────────────────────────────────────────────────────────────────────────────
# PDF Parser (3-tier strategy)
# ──────────────────────────────────────────────────────────────────────────────

def parse_pdf_to_df(file_bytes: bytes) -> pd.DataFrame:
    """
    Production-grade PDF table extraction with 3-tier fallback:
      1. Explicit table grid detection (pdfplumber)
      2. Layout text → LLM structuring
      3. OCR → LLM structuring (for scanned documents)
    """
    all_rows = []
    raw_text_pages = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        # ── Tier 1: Explicit table extraction ──
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    cleaned = [
                        str(cell).replace("\n", " ").strip() if cell is not None else ""
                        for cell in row
                    ]
                    all_rows.append(cleaned)

        if all_rows and len(all_rows) > 2:
            print(f"[DocumentParser] Tier 1: Found {len(all_rows)} rows via explicit table extraction")
            df = _list_to_df(all_rows)
            df = _clean_dataframe(df)
            if not df.empty and len(df.columns) >= 2:
                return df

        # ── Tier 2: Layout text → LLM ──
        print("[DocumentParser] Tier 1 insufficient. Trying layout text → LLM extraction.")
        for page in pdf.pages:
            text = page.extract_text(layout=True)
            if text:
                raw_text_pages.append(text)

        if raw_text_pages:
            combined_text = "\n".join(raw_text_pages)
            df = _llm_extract_table_from_text(combined_text)
            df = _clean_dataframe(df)
            if not df.empty and len(df.columns) >= 2:
                return df

        # ── Tier 3: OCR → LLM ──
        print("[DocumentParser] Tier 2 failed. Trying OCR → LLM extraction.")
        ocr_texts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                try:
                    im = page.to_image(resolution=300).original
                    text = pytesseract.image_to_string(im)
                    if text and text.strip():
                        ocr_texts.append(text)
                except Exception as e:
                    print(f"[DocumentParser] OCR on page failed: {e}")

        if ocr_texts:
            combined_ocr = "\n".join(ocr_texts)
            df = _llm_extract_table_from_text(combined_ocr)
            df = _clean_dataframe(df)
            if not df.empty:
                return df

    return pd.DataFrame()


# ──────────────────────────────────────────────────────────────────────────────
# Image Parser (OCR → LLM)
# ──────────────────────────────────────────────────────────────────────────────

def parse_image_to_df(file_bytes: bytes) -> pd.DataFrame:
    """Extract tabular data from an image using OCR → LLM structuring."""
    image = Image.open(io.BytesIO(file_bytes))

    try:
        text = pytesseract.image_to_string(image)
    except Exception as e:
        print(f"[DocumentParser] Tesseract error: {e}")
        return pd.DataFrame()

    if not text or len(text.strip()) < 20:
        return pd.DataFrame()

    df = _llm_extract_table_from_text(text)
    df = _clean_dataframe(df)
    return df
