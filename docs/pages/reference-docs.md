# Add manuals and notes

There are two different kinds of files in SIGNAL: **datalogs**, which represent real ECU measurements, and **reference documents**, which provide written context.

## Add a reference file

1. Import a compatible datalog in RAWEST SIGNAL.
2. Open **SIGNAL Guide**.
3. Expand **My reference documents · Add manuals and notes**.
4. Select a local **.txt, .md, .markdown, .csv or .json** file.
5. Ask a question. Matching passages appear labeled with the reference filename.

They are **text search results**, not something a cloud AI has learned, and they do not become verified telemetry.

## Current limits

- Maximum **10 files**.
- Maximum **200 KB per text document**.
- Maximum **500 KB** stored total.
- Stored only in your current browser, not in GitHub or a remote account.

## PDF manuals

Raw PDF parsing and OCR are not supported in this release. Export readable text to .txt or .md first. A scanned PDF needs OCR in another application.

## Publish a public help article

Create a Markdown file in the repository's **docs/pages/** folder, then add its slug and metadata to **docs/catalog.js**. Once deployed, it becomes a public wiki article. Only publish material you own or are allowed to redistribute.

Related: [Privacy and limitations](#/privacy).