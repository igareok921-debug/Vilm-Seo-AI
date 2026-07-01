import "server-only";

import type { ReportSnapshot } from "@/lib/supabase/reports";

export const runtime = "nodejs";

async function launchBrowser() {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    return puppeteerCore.launch({
      args: [...chromium.args, "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "Data unavailable")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function unavailable(value: unknown) {
  if (value === null || value === undefined || value === "") return "Data unavailable";
  return String(value);
}

function row(label: string, value: unknown) {
  return `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(unavailable(value))}</strong>
    </div>
  `;
}

function list(items: string[]) {
  if (!items.length) return `<p class="muted">Data unavailable</p>`;
  return `
    <ul class="clean-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function table(headers: string[], rows: Array<Array<unknown>>) {
  if (!rows.length) return `<p class="muted">Data unavailable</p>`;
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(unavailable(cell))}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function buildReportHtml(snapshot: ReportSnapshot) {
  const metrics = snapshot.metrics;
  const latestCrawl = asRecord(snapshot.crawl.latest);
  const latestAudit = asRecord(snapshot.audit.latest);
  const scMetrics = asRecord(snapshot.searchConsole?.metrics);
  const topQueries = Array.isArray(snapshot.searchConsole?.topQueries)
    ? snapshot.searchConsole.topQueries as Record<string, unknown>[]
    : [];
  const topPages = Array.isArray(snapshot.searchConsole?.topPages)
    ? snapshot.searchConsole.topPages as Record<string, unknown>[]
    : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEO Report - ${escapeHtml(snapshot.website.name)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #10121a;
      font-family: Inter, "Noto Sans", Arial, Helvetica, sans-serif;
      font-size: 13px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      min-height: 100vh;
      page-break-after: always;
      position: relative;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .cover {
      display: flex;
      min-height: 100vh;
      flex-direction: column;
      justify-content: space-between;
      padding: 28mm 10mm 18mm;
      background:
        radial-gradient(circle at 20% 15%, rgba(113, 83, 245, 0.16), transparent 28%),
        linear-gradient(135deg, #ffffff 0%, #f6f4ff 100%);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #6d5dfc;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .logo-mark {
      display: inline-flex;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #6d5dfc;
      color: #ffffff;
      font-weight: 900;
    }

    h1 {
      margin: 38mm 0 0;
      max-width: 620px;
      font-size: 44px;
      line-height: 1.05;
      letter-spacing: -0.04em;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 25px;
      letter-spacing: -0.03em;
    }

    h3 {
      margin: 18px 0 10px;
      font-size: 15px;
    }

    .subtitle {
      margin-top: 18px;
      max-width: 560px;
      color: #5b6070;
      font-size: 16px;
    }

    .cover-grid,
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .cover-card,
    .metric-card,
    .section {
      border: 1px solid #e5e7ef;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 16px 40px rgba(16, 18, 26, 0.06);
    }

    .cover-card {
      padding: 18px;
    }

    .cover-card span,
    .metric-card span {
      display: block;
      color: #777d8f;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .cover-card strong,
    .metric-card strong {
      display: block;
      margin-top: 7px;
      font-size: 17px;
    }

    .section {
      margin-bottom: 18px;
      padding: 22px;
      break-inside: avoid;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #eceef5;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .eyebrow {
      color: #6d5dfc;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .muted {
      color: #74798a;
    }

    .accent {
      color: #6d5dfc;
      font-weight: 800;
    }

    .metrics-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 16px 0;
    }

    .metric-card {
      padding: 14px;
      box-shadow: none;
    }

    .metric-card strong {
      font-size: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 14px;
      font-size: 11px;
    }

    th {
      background: #f4f2ff;
      color: #4d43c7;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    th,
    td {
      border-bottom: 1px solid #eceef5;
      padding: 9px 10px;
      vertical-align: top;
    }

    .clean-list {
      margin: 0;
      padding-left: 18px;
    }

    .clean-list li {
      margin: 6px 0;
    }

    .footer-note {
      margin-top: 22px;
      color: #8a90a2;
      font-size: 11px;
      text-align: center;
    }

  </style>
</head>
<body>
  <section class="page cover">
    <div>
      <div class="brand"><span class="logo-mark">V</span> VILM SEO AI</div>
      <h1>Complete SEO report for ${escapeHtml(snapshot.website.name)}</h1>
      <p class="subtitle">Premium analysis based on real crawl, audit, keyword research, Search Console, content, and AI recommendation data.</p>
    </div>
    <div class="cover-grid">
      <div class="cover-card"><span>Website</span><strong>${escapeHtml(snapshot.website.name)}</strong></div>
      <div class="cover-card"><span>Domain</span><strong>${escapeHtml(snapshot.website.url)}</strong></div>
      <div class="cover-card"><span>Period</span><strong>${escapeHtml(formatDate(snapshot.period.start))} - ${escapeHtml(formatDate(snapshot.period.end))}</strong></div>
      <div class="cover-card"><span>Generated at</span><strong>${escapeHtml(formatDateTime(snapshot.generatedAt))}</strong></div>
    </div>
  </section>

  <section class="page">
    <div class="section">
      <div class="section-title">
        <div>
          <div class="eyebrow">Page 2</div>
          <h2>Executive Summary</h2>
        </div>
        <div class="accent">VILM SEO AI</div>
      </div>
      <div class="metrics-grid">
        ${row("SEO Score", metrics.seoScore)}
        ${row("Pages analyzed", metrics.pagesAnalyzed)}
        ${row("Issues detected", metrics.issuesDetected)}
        ${row("Indexed pages", metrics.pagesIndexed)}
      </div>
      <p class="muted">The report summarizes the current SEO health, technical priorities, content opportunities, and recommended actions for the next 30 days.</p>
    </div>

    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 3</div><h2>SEO Crawl</h2></div></div>
      <div class="metrics-grid">
        ${row("Latest crawl", latestCrawl.created_at)}
        ${row("Crawled pages", latestCrawl.pages_crawled ?? metrics.pagesAnalyzed)}
        ${row("Issues", latestCrawl.issues_found ?? metrics.issuesDetected)}
        ${row("Status", latestCrawl.status)}
      </div>
      ${table(["URL", "Status", "Title", "Score"], snapshot.crawl.pages.slice(0, 10).map((page) => [page.url, page.status_code, page.title, page.seo_score]))}
    </div>
  </section>

  <section class="page">
    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 4</div><h2>SEO Audit</h2></div></div>
      <div class="metrics-grid">
        ${row("Audit score", latestAudit.score ?? metrics.seoScore)}
        ${row("Critical", metrics.criticalIssues)}
        ${row("Medium", metrics.mediumIssues)}
        ${row("Low", metrics.lowIssues)}
      </div>
    </div>

    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 5</div><h2>Priority Issues</h2></div></div>
      ${table(["Issue", "Severity", "Recommendation"], snapshot.audit.issues.slice(0, 12).map((issue) => [issue.title, issue.severity, issue.recommendation]))}
    </div>
  </section>

  <section class="page">
    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 6</div><h2>Keyword Research</h2></div></div>
      ${table(["Keyword", "Intent", "Priority", "Content type"], snapshot.keywords.research.slice(0, 12).map((keyword) => [keyword.keyword, keyword.search_intent, keyword.priority, keyword.content_type]))}
    </div>

    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 7</div><h2>Search Console</h2></div></div>
      ${snapshot.searchConsole ? `
        <div class="metrics-grid">
          ${row("Clicks", scMetrics.clicks ?? metrics.clicks)}
          ${row("Impressions", scMetrics.impressions ?? metrics.impressions)}
          ${row("CTR", scMetrics.ctr ?? metrics.ctr)}
          ${row("Average position", scMetrics.position ?? metrics.averagePosition)}
        </div>
        ${table(["Query", "Clicks", "Impressions", "Position"], topQueries.slice(0, 8).map((query) => [query.key, query.clicks, query.impressions, query.position]))}
        ${table(["Page", "Clicks", "Impressions", "Position"], topPages.slice(0, 6).map((page) => [page.key, page.clicks, page.impressions, page.position]))}
      ` : `<p class="muted">The integration is not connected.</p>`}
    </div>
  </section>

  <section class="page">
    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 8</div><h2>Generated Content</h2></div></div>
      ${table(["Title", "Keyword", "Status"], snapshot.content.generatedPages.slice(0, 10).map((page) => [page.title, page.keyword, page.status]))}
    </div>

    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 9</div><h2>AI Recommendations</h2></div></div>
      ${table(["Page", "Model", "Estimated cost"], snapshot.recommendations.slice(0, 10).map((item) => [item.page_id, item.model, item.estimated_cost_usd]))}
    </div>

    <div class="section">
      <div class="section-title"><div><div class="eyebrow">Page 10</div><h2>30-Day Action Plan</h2></div></div>
      ${list(snapshot.actionPlan)}
    </div>
  </section>
</body>
</html>`;
}

export async function generateReportPdfBuffer(snapshot: ReportSnapshot) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(buildReportHtml(snapshot), {
      waitUntil: "load",
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%;font-family:Arial,sans-serif;font-size:9px;color:#8a90a2;padding:0 16mm;display:flex;justify-content:space-between;">
          <span>Generated by VILM SEO AI</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "18mm",
        left: "12mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
