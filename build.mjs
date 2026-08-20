import { readFileSync, mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { marked } from 'marked'

const OUT_DIR = 'public'

const STYLE = `
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
.code-wrap {
  position: relative;
}
.copy-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #d8d8cc;
  border-radius: 4px;
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  opacity: 0.65;
}
.copy-btn:hover, .copy-btn:focus-visible { opacity: 1; border-color: var(--accent); color: var(--accent); }
.copy-btn.copied { opacity: 1; border-color: var(--accent); color: var(--accent); }
.copy-btn svg { width: 14px; height: 14px; }
.key-inject {
  margin: 0 0 -0.5rem;
  padding: 0.9rem 1rem;
  background: var(--panel);
  border: 1px solid #d8d8cc;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}
.key-inject label {
  display: block;
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
.key-inject input {
  width: 100%;
  box-sizing: border-box;
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid #d8d8cc;
  border-radius: 4px;
  background: #fff;
  color: var(--body);
}
.key-inject input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.key-inject + .code-wrap > pre { border-radius: 0 0 6px 6px; }
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
`

marked.setOptions({ gfm: true })

// marked doesn't add heading ids by default, so in-page anchor links (e.g. a "jump to the
// alternative method" link) silently go nowhere. Slugify headings the same way GitHub does.
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens)
      const slug = slugify(text.replace(/<[^>]*>/g, ''))
      return `<h${depth} id="${slug}">${text}</h${depth}>\n`
    },
  },
})

const KEY_PLACEHOLDER = 'PASTE_MY_KEY_HERE'

const CLIPBOARD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="4" width="10" height="14" rx="1.5"></rect><path d="M5 8v11a1.5 1.5 0 0 0 1.5 1.5H14"></path></svg>'
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"></path></svg>'

// Runs client-side after the page loads. Adds a copy button to every code block, and — for
// the one block containing PASTE_MY_KEY_HERE (the MCP setup command) — an input above it that
// live-substitutes a pasted key into that block's text, so copy grabs a ready-to-run command.
const SCRIPT = `
(function () {
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  // The button lives in a wrapper OUTSIDE the <pre> — not inside it — because <pre> is the
  // horizontally-scrolling element (overflow-x: auto). A button appended inside <pre> shares
  // its containing block, so it scrolls along with the code instead of staying put; wrapping
  // <pre> in a plain, non-scrolling positioned parent keeps the button fixed at the corner
  // regardless of how far the code inside is scrolled.
  document.querySelectorAll('article pre').forEach(function (pre) {
    var code = pre.querySelector('code');
    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '${CLIPBOARD_ICON}';
    btn.addEventListener('click', function () {
      copyText(code ? code.textContent : pre.textContent);
      btn.innerHTML = '${CHECK_ICON}';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.innerHTML = '${CLIPBOARD_ICON}';
        btn.classList.remove('copied');
      }, 1500);
    });
    wrap.appendChild(btn);
  });

  // Insert the key-input box before the .code-wrap (pre's new parent from the loop above),
  // NOT before <pre> itself — otherwise it ends up inside .code-wrap, and the copy button
  // (anchored to .code-wrap's corner) floats up to the top of the input box instead of the
  // top of the code block it actually belongs to.
  document.querySelectorAll('article pre code').forEach(function (code) {
    var original = code.textContent;
    if (original.indexOf('${KEY_PLACEHOLDER}') === -1) return;
    var codeWrap = code.parentElement.parentElement;
    var keyBox = document.createElement('div');
    keyBox.className = 'key-inject';
    keyBox.innerHTML =
      '<label for="mcp-key-input">Your API key (starts with <code>evp_</code>) — fills into the command below automatically, nothing is sent anywhere</label>' +
      '<input type="text" id="mcp-key-input" placeholder="evp_..." autocomplete="off" spellcheck="false">';
    codeWrap.parentNode.insertBefore(keyBox, codeWrap);
    keyBox.querySelector('input').addEventListener('input', function (e) {
      var val = e.target.value.trim();
      code.textContent = val ? original.split('${KEY_PLACEHOLDER}').join(val) : original;
    });
  });
})();
`

/** One rendered page: a source markdown file plus the styled header it gets wrapped in. */
const PAGES = [
  {
    source: 'team-guide.md',
    out: 'index.html',
    title: 'Everpure Artifact Intelligence — Team Guide',
    description: 'Using the Everpure Artifact Intelligence API & MCP server — reference, setup, and practical use cases.',
    eyebrow: 'Content Intelligence &middot; Team Guide',
    h1: 'Everpure Artifact Intelligence',
    subtitle: 'Using the API &amp; MCP server — reference, setup, and practical use cases.',
    metaLabel: 'REST API + MCP',
    sourceLabel: 'team-guide.md',
  },
  {
    source: 'jtbd-catalog.md',
    out: 'jtbd-catalog.html',
    title: 'Everpure JTBD Catalog',
    description: "The 18 jobs-to-be-done Everpure's content library is classified against.",
    eyebrow: 'Content Intelligence &middot; JTBD Catalog',
    h1: 'Everpure JTBD Catalog',
    subtitle: 'The 18 circumstance-anchored jobs the corpus is classified against.',
    metaLabel: 'JTBD Catalog v1.1',
    sourceLabel: 'jtbd-catalog.md',
  },
  {
    source: 'mcp-desktop-setup.md',
    out: 'mcp-desktop-setup.html',
    title: 'Connecting Claude Desktop via Claude Code — Everpure',
    description: 'Installing the Everpure MCP server in Claude Desktop when custom-MCP install is disabled in the UI.',
    eyebrow: 'Content Intelligence &middot; MCP Setup',
    h1: 'Connecting Claude Desktop via Claude Code',
    subtitle: 'For admin-managed machines where the custom-MCP install UI is disabled.',
    metaLabel: 'MCP Setup',
    sourceLabel: 'mcp-desktop-setup.md',
  },
]

function lastUpdated(source) {
  try {
    const date = execSync(`git log -1 --format=%ad --date=format:"%B %-d, %Y" -- ${source}`, {
      encoding: 'utf8',
    }).trim()
    if (date) return date
  } catch {
    // fall through to today's date
  }
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function renderPage(page) {
  const raw = readFileSync(page.source, 'utf8')
  // The page renders its own styled header, so drop the leading `# Title` line
  // from the source before handing the rest to marked.
  const body = raw.replace(/^#\s+.*\n+/, '')
  const html = marked.parse(body)
  const updated = lastUpdated(page.source)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<style>${STYLE}</style>
</head>
<body>
<main>
  <p class="eyebrow">${page.eyebrow}</p>
  <h1>${page.h1}</h1>
  <p class="subtitle">${page.subtitle}</p>
  <hr class="rule">
  <p class="meta">${page.metaLabel}<span class="sep">&bull;</span>Updated ${updated}</p>
  <article>
${html}
  </article>
  <footer>
    Source: <a href="https://github.com/brandonjspencer/everpure-team-guide/blob/main/${page.sourceLabel}">${page.sourceLabel}</a>
    &nbsp;&middot;&nbsp; Rebuilt automatically on every update.
  </footer>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`
}

mkdirSync(OUT_DIR, { recursive: true })
for (const page of PAGES) {
  writeFileSync(`${OUT_DIR}/${page.out}`, renderPage(page))
  console.log(`Wrote ${OUT_DIR}/${page.out}`)
}

// Static, non-markdown assets (the one-click MCP installers) — copied as-is, not rendered.
if (existsSync('installers')) {
  cpSync('installers', `${OUT_DIR}/installers`, { recursive: true })
  console.log(`Copied installers/ to ${OUT_DIR}/installers`)
}
