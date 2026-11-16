# Report Builder

A free, open-source web tool that helps you build a monthly **SEO, AEO and GEO report**.
You bring the exports from Google Search Console, GA4 and Screaming Frog. The tool checks them,
tells you what is missing, fills an Excel workbook, and creates a one-page PDF report.

Everything runs **in your browser**. Your files are never uploaded to a server.

## What it does

You bring the exports. The tool checks them, tells you what is missing, and builds the workbook and the PDF.
**No Google login and no paid service is needed.** Data comes from files you upload or numbers you type.

| Step | You give | The tool does |
|---|---|---|
| Project | Company, website, month, package (SEO / AEO / GEO) | Shows only the steps your package needs |
| Search Console | The ZIP from Performance > Export | Reads clicks, impressions, CTR, position, queries, pages and the daily trend. Warns if the dates do not cover the month |
| GA4 | The CSV from User acquisition | Reads the Organic Search row. A file with only headers is reported as "no data", **not** as zero visitors |
| Site crawl | Screaming Frog exports (Internal HTML, 4xx, Missing Alt Text) | Finds missing meta descriptions, H1 problems, long titles, broken files, external images, and builds the Findings Log and Page Review |
| Speed and security | PageSpeed numbers you type, SSL and header grades | Uses the **median** of runs and the playbook priority rules |
| Keywords, competitors, questions, AI check | Typed or pasted | Fills the matching sheets. AI score = questions where the business was named |
| Work done | Plain text | Goes into the report. Work outside the month is shown separately |
| **Report design** | Clicks | Pick one of 3 templates, tick and reorder sections, add custom blocks (text, KPI cards, table), set colours, logo and title |
| Review | | Data checklist, then download the **.xlsx** and the **PDF** |

### Use your own design (Word, Excel or PowerPoint)

Do not like the built-in templates? On the last step upload your own `.docx`, `.xlsx` or `.pptx` file.
Type placeholders such as `{{company}}`, `{{clicks}}` or `{{summary}}` where a value should go. The tool fills them in and keeps your fonts, colours and layout.

- **Single values:** `{{company}}`, `{{month_label}}`, `{{clicks}}`, `{{impressions}}`, `{{position}}`, `{{organic_users}}`, `{{mobile_score}}`, `{{ai_score}}`, `{{findings_total}}`, `{{summary}}` and more (the full list is shown in the tool).
- **Repeating table rows:** put `{{#findings}}` in the first cell of a table row and use `{{findings.priority}}`, `{{findings.issue}}` and so on in the same row. The row repeats once per item. Add a limit with `{{#findings:5}}`. Lists available: `kpis`, `findings`, `keywords`, `competitors`, `questions`, `compare`, `pages`, `ai`.
- **Multi-line values** such as `{{next_actions}}` become one paragraph per line in Word and PowerPoint.
- Missing data is filled with **Pending**, **Not tracked** or **Not available**.
- A **starter template** (.docx) can be downloaded from the tool.
- Excel files are re-saved by the tool, so charts and pictures inside them may be lost.
- The output is the same file type. To get a PDF, use Save as PDF in Word, Excel or PowerPoint.

Designs that are only a PDF or a picture cannot be read automatically. Recreate the layout in Word or PowerPoint and add the placeholders.

### Templates

| Template | Look | Pages |
|---|---|---|
| One-page summary | KPI cards on top, two columns below, shrinks to fit | 1 |
| Detailed report | One column, full tables, page numbers | 2 to 4 |
| Visual dashboard | Big KPI tiles and charts first | 1 to 2 |

### Every month

1. **Save report file** (a small .json file with your whole project).
2. Next month press **Start next month** and open that file. Your project, design, keywords, competitors, questions and the 20 AI questions stay. This month's data is cleared, and last month's numbers become the "compared with last month" section.
3. Upload the new exports and download the new report.

### Honesty rules built in

- Missing data is written as **Pending**, **Not tracked** or **Not available**. It is never turned into zero or an estimate.
- Direct traffic is never counted as organic. Search Console clicks and GA4 users are never mixed.
- Checks run outside the reporting month are labelled as such in the PDF and the tracker notes.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # smoke test with made-up data (no real data is stored in this repo)
npm run build      # production build in dist/
```

Requires Node 18 or newer.

## Put it online for free (GitHub Pages)

1. Push this folder to a GitHub repository (branch `main`).
2. In the repo go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push again (or run the workflow from the **Actions** tab). The included workflow tests, builds and publishes the site.

Vercel and Netlify also work: build command `npm run build`, output folder `dist`.

## Tech

React 18, TypeScript, Vite, Tailwind CSS. ExcelJS fills the workbook, jsPDF draws the PDF, PapaParse and JSZip read the exports, and xmldom edits Word and PowerPoint files.
Nothing needs a backend.

## The workbook template

`public/template.xlsx` is the empty workbook design that gets filled (no data in it). The tool keeps its sheets, headers, dropdowns, formulas
and colours. To use your own template, replace that file and keep the sheet names:
`Findings Log`, `Page Review`, `Keywords`, `Competitors`, `Questions`, `AI Check`, `Monthly Tracker`.

## Known limits

- **No automatic data fetching, on purpose.** Search Console, GA4 and PageSpeed numbers come from files or typing. Automatic fetching would need Google sign-in and app verification, and may need a custom domain, which can cost money. The tool is built to stay free.
- **PDF text** supports Latin characters only (no Hindi or other scripts) because the PDF uses built-in fonts.
- AI visibility checks are manual. There is no reliable free API for them.
- The look of the interface was checked by build and render tests only, not by a screenshot in a real browser.
- The workbook still needs a person to add evidence links and an owner for each finding.
- Browser data (autosave) is stored in localStorage on your own computer. Use **Start a new report** to clear it.

## Roadmap

1. This version: upload, checks, templates, custom blocks, comparison, charts, workbook and PDF.
2. Next: Google Ads, Meta Ads and social media modules (each needs a real sample export to build and test against).
3. Done: upload your own Excel, Word or PowerPoint template with `{{placeholders}}`.
4. Later, optional: Google sign-in for Search Console and GA4, only if it can stay free.

## License

MIT
