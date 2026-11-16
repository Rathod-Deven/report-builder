# Report Builder

A free, browser-based tool that turns **Google Search Console**, **GA4** and **Screaming Frog** exports into an SEO, AEO and GEO **audit, Excel workbook and PDF report**.

No backend. No login. Your files never leave your device.

## Why

Agencies and freelancers copy numbers from several tools into a report every month. This tool checks the exports, finds the problems, and builds the report. When data is missing, it says **Pending** instead of guessing.

## Features

- **Data checks:** reads Search Console (ZIP), GA4 (CSV) and Screaming Frog (CSV) exports and warns about wrong date ranges or empty files.
- **Site audit:** finds missing meta descriptions, H1 problems, long titles, broken files, external images, missing alt text, slow mobile speed and weak security headers, and ranks each issue High, Medium or Low.
- **Three PDF templates:** one-page summary, detailed report, visual dashboard.
- **Your own design:** upload a Word, Excel or PowerPoint file with `{{placeholders}}` and the tool fills it in.
- **Flexible sections:** tick, reorder, and add custom blocks (text, KPI cards, table). Set colours, logo and title.
- **Month-over-month:** save the project as a file, press **Start next month**, and last month's numbers become the comparison.
- **Excel workbook:** fills a ready template (findings, page review, keywords, competitors, questions, AI check, monthly tracker).

## Honesty rules

- Missing data is written as **Pending**, **Not tracked** or **Not available**. It is never turned into zero or an estimate.
- Direct traffic is never counted as organic. Search Console clicks and GA4 users are never mixed.
- Checks run outside the reporting month are labelled as such in the PDF.

## Quick start

Requires Node 18 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # automated tests with made-up data
npm run build    # production build in dist/
```

## How it works

```
Upload or type  ->  parsers  ->  AppState  ->  buildModel  ->  PDF / Excel / Word / PowerPoint
```

All data lives in one `AppState` object. `buildModel` turns it into findings, KPIs and text. Every output reads from that one model, so the numbers match everywhere.

| Path | Purpose |
|---|---|
| `src/App.tsx` | App shell: steps, save/open, autosave |
| `src/types.ts` | Data types and defaults |
| `src/steps/` | The wizard screens |
| `src/lib/parsers.ts` | Reads Search Console, GA4 and Screaming Frog files |
| `src/lib/model.ts` | Audit rules, KPIs, summary, comparison |
| `src/lib/exportPdf.ts` | PDF engine with three templates and charts |
| `src/lib/exportXlsx.ts` | Fills the Excel template |
| `src/lib/fillTemplate.ts` | Fills your own Word, Excel or PowerPoint template |
| `src/lib/saveload.ts` | Save, open and start next month |
| `public/template.xlsx` | Empty workbook design |
| `scripts/smoke-test.ts` | Automated tests |

## Use your own design

Upload a `.docx`, `.xlsx` or `.pptx` on the last step. Type placeholders where a value should go:

- **Single values:** `{{company}}`, `{{month_label}}`, `{{clicks}}`, `{{impressions}}`, `{{position}}`, `{{organic_users}}`, `{{mobile_score}}`, `{{ai_score}}`, `{{findings_total}}`, `{{summary}}` and more. The full list is shown in the tool.
- **Repeating table rows:** put `{{#findings}}` in a table row and use `{{findings.priority}}`, `{{findings.issue}}` in the same row. Add a limit with `{{#findings:5}}`. Lists: `kpis`, `findings`, `keywords`, `competitors`, `questions`, `compare`, `pages`, `ai`.
- **Multi-line values** such as `{{next_actions}}` become one paragraph per line.
- The tool offers a starter `.docx`. To get a PDF, use Save as PDF in Word or PowerPoint.

Excel files are re-saved by the tool, so charts and pictures inside them may be lost. A design that is only a PDF or an image cannot be read automatically.

## Tech

React 18, TypeScript, Vite, Tailwind CSS. ExcelJS fills the workbook, jsPDF draws the PDF, PapaParse and JSZip read the exports, xmldom edits Word and PowerPoint files.

## Known limits

- No automatic data fetching. Numbers come from uploaded files or typing, so the tool stays free.
- PDF text supports Latin characters only.
- The AI visibility check is manual.
- A person still needs to add evidence links and owners for the findings.
- Autosave uses your browser's localStorage. Use **Start a new report** to clear it.

## Roadmap

- Google Ads, Meta Ads and social media modules (each needs a sample export to build and test against)
- Optional Google sign-in, only if it can stay free

## Deploy your own copy

Fork the repo, then go to **Settings > Pages**, set **Source** to **GitHub Actions**, and push. The included workflow tests, builds and publishes the site. Vercel and Netlify also work (build command `npm run build`, output folder `dist`).

## About this project

Built with the help of an AI assistant.

## License

MIT
