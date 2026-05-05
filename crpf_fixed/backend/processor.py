# backend/processor.py
# Works fully without any API key — pure Python text extraction

import io

class DocumentProcessor:
    def process(self, file_bytes: bytes, filename: str) -> dict:
        ext = filename.lower().split('.')[-1]

        if ext == 'pdf':
            return self._process_pdf(file_bytes, filename)
        elif ext == 'docx':
            return self._process_docx(file_bytes)
        elif ext in ['jpg', 'jpeg', 'png', 'tiff', 'bmp']:
            return self._process_image(filename)
        elif ext == 'txt':
            text = file_bytes.decode('utf-8', errors='ignore')
            return {'text': text, 'doc_type': 'text', 'confidence': 1.0}
        else:
            return {'text': f'[File: {filename}]', 'doc_type': 'unknown', 'confidence': 0.5}

    def _process_pdf(self, file_bytes: bytes, filename: str) -> dict:
        try:
            import pdfplumber
            text = ''
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ''
                    text += page_text + '\n'

            if len(text.strip()) > 50:
                return {'text': text, 'doc_type': 'typed_pdf', 'confidence': 0.95}
            else:
                # Scanned PDF — return filename hint for mock
                return {
                    'text': f'[Scanned PDF: {filename}]',
                    'doc_type': 'scanned_pdf',
                    'confidence': 0.65
                }
        except Exception:
            return {'text': f'[PDF: {filename}]', 'doc_type': 'pdf', 'confidence': 0.70}

    def _process_docx(self, file_bytes: bytes) -> dict:
        try:
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            text = '\n'.join([p.text for p in doc.paragraphs])
            return {'text': text, 'doc_type': 'docx', 'confidence': 0.95}
        except Exception:
            return {'text': '[DOCX file]', 'doc_type': 'docx', 'confidence': 0.70}

    def _process_image(self, filename: str) -> dict:
        # In demo mode, return image hint
        # In production: call AWS Textract or GPT-4 Vision here
        return {
            'text': f'[Image file: {filename}]',
            'doc_type': 'image',
            'confidence': 0.55
        }
