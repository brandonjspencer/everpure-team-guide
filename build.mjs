import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { marked } from 'marked'

const SOURCE = 'team-guide.md'
const OUT_DIR = 'public'

const raw = readFileSync(SOURCE, 'utf8')

// The page renders its own styled header, so drop the leading `# Title` line
// from the source before handing the rest to marked.
const body = raw.replace(/^#\s+.*\n+/, '')

let updated
try {
  updated = execSync(`git log -1 --format=%ad --date=format:"%B %-d, %Y" -- ${SOURCE}`, {
    encoding: 'utf8',
  }).trim()
} catch {
  updated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
if (!updated) {
  updated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

marked.setOptions({ gfm: true })
const html = marked.parse(body)

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Everpure Artifact Intelligence — Team Guide</title>
<meta name="description" content="Using the Everpure Artifact Intelligence API &amp; MCP server — reference, setup, and practical use cases.">
<style>
:root {
  --bg: #eeeee6;
  --panel: #f6f6f0;
  --ink: #1c1c1a;
  --body: #2b2b28;
  --muted: #6b6b5f;
  --accent: #4b6a52;
  --rule: #4b6a52;
  --code-bg: #e4e4da;
  --link: #35543d;
}
* { box-sizing: border-box; }
html { background: var(--bg); }
body {
  margin: 0;
  padding: 4rem 1.5rem 6rem;
  background: var(--bg);
  color: var(--body);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 17px;
  line-height: 1.65;
}
main {
  max-width: 760px;
  margin: 0 auto;
}
.eyebrow {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 1rem;
}
h1 {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 2.6rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 0.6rem;
}
.subtitle {
  font-style: italic;
  color: var(--muted);
  font-size: 1.15rem;
  margin: 0 0 1.4rem;
}
.rule {
  border: none;
  border-top: 2px solid var(--rule);
  margin: 0 0 1.1rem;
}
.meta {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 2.5rem;
}
.meta .sep { color: var(--accent); margin: 0 0.6em; }
article h2 {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--ink);
  font-size: 1.4rem;
  margin: 2.6rem 0 1rem;
  padding-top: 1.6rem;
  border-top: 1px solid #d8d8cc;
}
article h3 {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--ink);
  font-size: 1.08rem;
  margin: 1.9rem 0 0.7rem;
}
article p { margin: 0 0 1rem; }
article a { color: var(--link); }
article ul, article ol { padding-left: 1.3rem; margin: 0 0 1rem; }
article li { margin: 0 0 0.4rem; }
article strong { color: var(--ink); }
article code {
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--code-bg);
  padding: 0.12em 0.35em;
  border-radius: 3px;
  font-size: 0.88em;
}
article pre {
  background: var(--panel);
  border: 1px solid #d8d8cc;
  border-radius: 6px;
  padding: 1rem 1.2rem;
  overflow-x: auto;
}
article pre code { background: none; padding: 0; }
article blockquote {
  margin: 0 0 1rem;
  padding: 0.2rem 1rem;
  border-left: 3px solid var(--accent);
  color: var(--muted);
}
article table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 1.4rem;
  font-size: 0.92rem;
}
article th, article td {
  border: 1px solid #d8d8cc;
  padding: 0.5rem 0.7rem;
  text-align: left;
  vertical-align: top;
}
article th {
  background: var(--panel);
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}
article hr {
  border: none;
  border-top: 1px solid #d8d8cc;
  margin: 2.6rem 0;
}
footer {
  max-width: 760px;
  margin: 3rem auto 0;
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--muted);
}
footer a { color: var(--link); }
</style>
</head>
<body>
<main>
  <p class="eyebrow">Content Intelligence &middot; Team Guide</p>
  <h1>Everpure Artifact Intelligence</h1>
  <p class="subtitle">Using the API &amp; MCP server — reference, setup, and practical use cases.</p>
  <hr class="rule">
  <p class="meta">REST API + MCP<span class="sep">&bull;</span>Updated ${updated}</p>
  <article>
${html}
  </article>
  <footer>
    Source: <a href="https://github.com/brandonjspencer/everpure-team-guide/blob/main/team-guide.md">team-guide.md</a>
    &nbsp;&middot;&nbsp; Rebuilt automatically on every update.
  </footer>
</main>
</body>
</html>
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/index.html`, page)
console.log(`Wrote ${OUT_DIR}/index.html (updated: ${updated})`)
