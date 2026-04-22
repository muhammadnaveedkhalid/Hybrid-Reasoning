# WHO guidelines and PDFs

This project does **not** redistribute WHO copyrighted PDFs. Use the links returned by `GET /api/guidelines` (`who_pdf_links`) or the [WHO publications](https://www.who.int/publications) site to download official PDFs.

## Suggested workflow

1. Download the official PDFs you are licensed to use (institutional access or public WHO pages).
2. Store copies locally for your deployment only, for example:

   `backend/data/pdfs/` (gitignored — add your files there; do not commit WHO PDFs unless your license allows it).

3. Keep `backend/data/guidelines.json` as the **structured rule layer** that cites WHO themes; update `structured_rules` when your clinical governance team aligns them with the PDFs you adopt.

The React app shows the same links in the **Guidelines** screen so clinicians can open WHO sources in the browser.
