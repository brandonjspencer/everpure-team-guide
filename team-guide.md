# Everpure Artifact Intelligence — Team Guide

This is the guide for **using** the API and MCP server — for testing, integrating, or just
exploring what the content intelligence layer knows. (For building/running the pipeline itself,
see the [main repo's README](https://github.com/brandonjspencer/everpure-artifact-intelligence#readme).)

**What this system knows:** every marketing and technical artifact on everpuredata.com, plus
blog.everpuredata.com — **4,419 available artifacts** (100% JTBD-enriched, avg. classification
confidence **0.774**; as of 2026-08-18, this figure covers the whole corpus — permanently-dead
`gone` artifacts are no longer counted at all, not just excluded from "available")

Each artifact is deeply analyzed for:

- **What it is** — type, title, description, freshness, gated vs. public
- **Who it's for** — audience level, buyer personas, technical depth, buying-committee roles
- **Where it fits in a journey** — funnel stages, B2B buying-process phases, JTBD demand timeline
- **What progress it serves** — Jobs-To-Be-Done from a locked 18-job catalog, the demand-side
  forces it acts on (push / pull / anxiety / habit), and the alternative it positions against
- **What it's about** — products, solutions, industries, topics (188 canonical taxonomy slugs)
- **When to use it** — surfacing signals ("send this when the prospect asks about…"), journey
  sequencing hints, brand-compliance status

Everything is served two ways over the same engine: a **REST API** (for scripts, integrations,
Postman) and an **MCP server** (for AI agents — Claude Desktop, Claude Code, custom agents).

---

## 1. Getting access

| Thing | Value |
|---|---|
| Base URL | `https://everpure-artifact-api.onrender.com/v1` (or `http://localhost:3000/v1` if you run it locally) |
| Auth | Every request needs an API key: `X-API-Key: <key>` header, or `Authorization: Bearer <key>` |
| Get a key | Ask Brandon — distributed out-of-band (not in this doc), scoped read-only for most testers |
| Interactive docs | [`/docs`](https://everpure-artifact-api.onrender.com/docs) — full Swagger UI, try any endpoint in the browser (click **Authorize** and paste the key Brandon gave you) |
| OpenAPI spec | [`/openapi.json`](https://everpure-artifact-api.onrender.com/openapi.json) — import into Postman/Insomnia for a ready-made collection |
| Health check | [`GET /v1/health`](https://everpure-artifact-api.onrender.com/v1/health) — no auth required |

> **Free-tier note:** a scheduled health check keeps the REST API warm on weekdays, roughly
> 6am–6pm Pacific, so it responds quickly during business hours. Outside that window it spins
> down after ~15 minutes idle, and the first request after that takes 30–60 seconds to respond
> — that's normal, not an outage. Retry once before reporting a problem.

**60-second smoke test:**

```bash
export EVERPURE_API_KEY="<your key>"
export EVERPURE_API="https://everpure-artifact-api.onrender.com/v1"

curl -s "$EVERPURE_API/health"
curl -s -H "x-api-key: $EVERPURE_API_KEY" "$EVERPURE_API/artifacts?limit=3"
```

---

## 2. The REST API

### 2.1 Browse & filter the catalog — `GET /artifacts`

The workhorse. Every classification dimension is a query param; all list params accept
comma-separated multi-values (`?type=ebook,video`); results are paginated.

| Param | Values | What it filters |
|---|---|---|
| `type` | `whitepaper`, `ebook`, `case-study`, `video`, `webinar`, `datasheet`, `blog-post`, `reference-architecture`, `product-page`, … | Content format |
| `stage` | `awareness`, `education`, `consideration`, `decision`, `validation`, `expansion`, `advocacy` | Funnel buying stage |
| `phase` | `problem_identification`, `solution_exploration`, `requirements_building`, `validation`, `consensus_creation`, `supplier_selection`, `purchase` | B2B buying-process phase (Gartner-style committee work) |
| `job` | JTBD catalog slugs, e.g. `survive-a-ransomware-attack` — full 18-job list: [jtbd-catalog.md](./jtbd-catalog.html) (or the `get_jtbd_catalog` MCP tool) | The buyer progress the content serves |
| `force` | `push`, `pull`, `anxiety`, `habit` | Demand-side force the content acts on |
| `committeePersona` | `technical_leader`, `non_technical_leader`, `infrastructure_owner`, `technical_infra_operator`, `platform_engineering`, `security_owner`, `procurement_finance_sustainability`, `enterprise_ai_leader`, `data_leader` — full behavioral detail on each: [personaReference.ts](https://github.com/brandonjspencer/everpure-artifact-intelligence/blob/main/src/config/personaReference.ts) (or the `get_persona_reference` MCP tool) | Buying-committee role targeted |
| `product` / `solution` / `industry` / `topic` | Taxonomy slugs (`GET /taxonomy` for the canonical lists), or a common synonym — see §2.6 | Subject matter |
| `audience` | `c-suite`, `vp-director`, `manager`, `individual-contributor`, `technical-architect`, `developer`, `end-user` | Reader level |
| `persona` | `economic-buyer`, `technical-buyer`, `user-buyer`, `champion`, `influencer` | Classic buyer persona |
| `technicalDepth` | `executive`, `practitioner`, `technical`, `developer` | How deep it goes |
| `accessTier` | `public`, `gated` | Lead-gate status |
| `ageBucket` / `stalenessRisk` | `current`…`archived` / `low`…`critical` | Freshness |
| `publishedAfter` / `publishedBefore` | ISO dates | Publish window |
| `fields` | comma-separated field names | Sparse responses (id always included) |
| `limit` / `offset` / `sort` / `order` | limit ≤ 100; sort: `publishedAt`, `createdAt`, `updatedAt`, `title`, `confidence` | Paging |

```bash
# Healthcare case studies (77 in the corpus today)
curl -s -H "x-api-key: $EVERPURE_API_KEY" \
  "$EVERPURE_API/artifacts?industry=healthcare&type=case-study&limit=10"

# Anxiety-reducing proof content aimed at the Security Owner, serving the validation phase
# (406 in the corpus today)
curl -s -H "x-api-key: $EVERPURE_API_KEY" \
  "$EVERPURE_API/artifacts?committeePersona=security_owner&force=anxiety&phase=validation"
```

Related single-artifact reads:

- `GET /artifacts/:id` — the full intelligence record (classification, JTBD block, surfacing
  signals, journey hints, brand status)
- `GET /artifacts/:id/summary` — the lightweight card projection
- `GET /artifacts/:id/similar` — semantically nearest neighbours
- `GET /artifacts/random?type=…` — a random live artifact (handy for exploring)

### 2.2 Search — `POST /artifacts/search`

Full-text + semantic + filters in one call.

```bash
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/artifacts/search" -d '{
    "query": "ransomware",
    "filter": { "phase": ["consensus_creation"] },
    "limit": 5
  }'
```

Two things testers should know:

- The body key is **`filter` (singular)** and its sub-keys are singular too (`product`,
  `industry`, `job`, `phase`, …). Unknown keys are silently ignored — if your filter seems to
  do nothing, check the spelling first.
- When you pass a `query`, it is used **both** as a semantic vector **and** as a literal
  title/description text match, combined with AND. Short, keyword-y queries
  (`"ransomware"`, `"kubernetes storage"`) work much better than long sentences. For
  natural-language asks, use `/artifacts/recommend` instead — that's what it's for.

### 2.3 Recommend — `POST /artifacts/recommend`

Describe a **prospect**, get ranked content with a rationale per pick. This is the engine the
Journey Map Builder uses; it scores candidates across semantic similarity, taxonomy overlap,
stage fit, audience fit, and sequence position.

```bash
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/artifacts/recommend" -d '{
    "prospectProfile": {
      "industry": "healthcare",
      "jobTitle": "CIO",
      "buyingStage": "consideration",
      "jobsToBeDone": ["survive-a-ransomware-attack"],
      "engagedArtifactIds": []
    },
    "options": { "limit": 5 }
  }'
```

Profile fields worth knowing:

- **`jobsToBeDone`** — the strongest signal you can pass. Catalog slugs for the progress the
  prospect is trying to make. With the profile above, the top three today are all
  healthcare-ransomware pieces (scores 0.81 / 0.81 / 0.80).
- `currentTopics`, `raisedObjections`, `context` — free-text/topic signals; objection language
  ("worried about migration complexity") activates objection-aware ranking.
- `engagedArtifactIds` — what they've already seen; excluded from results. Also doubles as the
  "have they visited before" signal for `cta` below.
- `hasWatchedDemo` — boolean; feeds `cta` below. Only meaningful once `engagedArtifactIds` is
  non-empty.
- `journeyContext.precedingArtifactId` — the artifact you just showed this prospect. When set,
  each recommendation gets a **verified** click-path signal: `navigation: { linkVerified,
  verifiedTargetUrl, suggestedCta }`. `linkVerified` is `true` only when a real `<a href>` on the
  preceding artifact's page (captured at crawl time) resolves to the recommended artifact's
  canonical URL — never inferred from topic/stage similarity. `suggestedCta` is always present
  and honest either way: a click-through line when verified, or "share this resource directly"
  when not. Omitted entirely if `precedingArtifactId` isn't supplied.

**Every response carries a `cta` block** — the next action to point the prospect at, not just
content: `{ "action": "pathfinder" | "demo" | "meeting", "rationale": "...", "chatAvailable":
true }`. It's a plain visit-state ladder, not a score: no prior engagement → `pathfinder`;
returning visitor who hasn't watched a demo yet → `demo`; demo already watched → `meeting`.
`chatAvailable` is always `true` — Chat is a parallel option, not a rung on the ladder. Same
field, same logic, on the MCP `recommend_for_prospect` tool (rendered there as a "Next best
action" line). Journey building doesn't carry a `cta` — it's specific to the single-prospect
recommend call.

### 2.4 Journeys — `POST /journeys/build` and friends

Build an ordered content sequence across stages, one artifact per slot, with transition notes.

```bash
# Funnel-keyed: awareness → decision
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/journeys/build" -d '{
    "prospectProfile": { "industry": "healthcare", "jobsToBeDone": ["survive-a-ransomware-attack"] },
    "targetStages": ["awareness", "education", "consideration", "decision"]
  }'

# Phase-keyed: the buying committee's path (one step per buying-process phase)
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/journeys/build" -d '{
    "prospectProfile": { "industry": "healthcare", "jobsToBeDone": ["survive-a-ransomware-attack"] },
    "targetPhases": ["problem_identification", "solution_exploration", "validation", "consensus_creation", "purchase"]
  }'
```

Pass **exactly one** of `targetStages` (funnel) or `targetPhases` (buying-process) — the API
400s if you send both or neither. Options: `maxLength`, `publicOnly`,
`artifactTypeMix` (e.g. `{ "video": 2, "case-study": 1 }`).

Journeys can also be **saved** (`POST /journeys` with a `name`, needs a write-scoped key) and
then monitored: `GET /journeys/:id/health` flags steps whose artifact has gone away, changed,
been reclassified out of its slot, become gated, or picked up brand issues.

Each step (from the second onward) carries the same **verified** click-path signal as
`/artifacts/recommend` above (`navigation: { linkVerified, verifiedTargetUrl, suggestedCta }`),
computed server-side between consecutive steps — no request field needed, unlike the recommend
endpoint. Absent on the first step (nothing precedes it to check).

### 2.5 Coverage & gaps — `GET /coverage/jtbd`

The Content Map engine: how well the corpus covers every job, phase, force, persona, and
dimension — zero-filled (a value with no coverage still appears), with an 18×7 job-by-phase
grid and a severity-flagged gap list (`missing` = zero assets, `critical` < 2%, `low` < 5%).

**Numbers below are current as of 2026-08-18**, after the persona-taxonomy reclassification
finished and 1,528 `gone` (dead-link) artifacts were permanently removed from the corpus —
4,419 artifacts remain, 100% enriched, averaging 0.774 classification confidence.

Today's headline findings, straight from the endpoint: the `purchase` phase (90 assets, 2.0%)
and the `build-a-practice-on-the-platform` job (90 assets, 2.0%) are the thinnest coverage
points, and the `habit` demand-force (158 assets, 3.6%) is newly exposed as thin now that dead
content no longer pads the denominator. None of these are flagged **critical** (< 2%) anymore,
but all three sit right at the **low** (< 5%) line and are worth watching, not ignoring.

Committee-persona coverage, current buying-committee taxonomy (§2.1):

| Persona | Assets | Share |
|---|---|---|
| Technical infra operator | 3,249 | 73.5% |
| Infrastructure owner | 3,006 | 68.0% |
| Technical leader | 2,177 | 49.3% |
| Platform engineering | 1,980 | 44.8% |
| Security owner | 797 | 18.0% |
| Procurement / finance / sustainability | 670 | 15.2% |
| Enterprise AI leader | 447 | 10.1% |
| Data leader | 346 | 7.8% |
| Non-technical leader | 291 | 6.6% |

### 2.6 Taxonomy & vocabularies

- `GET /taxonomy` — the 188 canonical product/solution/industry/topic/job-function slugs
- `GET /taxonomy/coverage` — artifact counts per taxonomy value
- `GET /taxonomy/stage-crosswalk` — the canonical translation between the three stage
  vocabularies (buying-process phases ↔ JTBD timeline ↔ funnel stages), each phase with its
  dominant forces. Use it whenever an ask arrives in one dialect and your filter needs another.
- `GET /taxonomy/persona-reference` — full behavioral detail (roles, priorities, decision
  criteria, messaging do/don't) for each of the 9 `committeePersona` values.
- The 18-job JTBD catalog: [jtbd-catalog.md](./jtbd-catalog.html)

**Synonyms resolve automatically.** `product` / `solution` / `industry` / `topic` filters (on
`GET /artifacts`, `POST /artifacts/search`, `find_artifacts`) and the `industry` field on
`recommend`/`build_journey` calls all run through a synonym map before matching. For example,
`industry=fintech`, `banking`, `insurance`, and `capital-markets` all resolve to the canonical
`financial-services` and return the same rows. A term that doesn't resolve is passed through
unchanged rather than dropped (so a typo narrows your results instead of silently returning
everything). `GET /taxonomy` lists canonical slugs only — the synonym map itself isn't a
documented endpoint, so if a filter you expect to work returns nothing, try the canonical slug
directly.

### 2.7 Brand compliance — `GET /brand-audit/*`

`/brand-audit/summary` for corpus-wide counts, `/brand-audit/:id` for a specific artifact's
legacy-brand ("Pure Storage" → "Everpure") status with suggested replacements. Check before
putting an artifact in front of a customer.

---

## 3. The MCP server

The same engine, exposed as tools an AI agent can call. Ask questions in plain English; the
agent picks the right tool.

### 3.1 Connecting

Pick whichever matches what you use — all three point at the same deployed server.

**Claude Code (easiest — one command, no file editing):**

```bash
claude mcp add --transport http everpure-artifacts https://everpure-artifact-mcp.onrender.com/ --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

The CLI writes its own config. Nothing else to do — start a session and ask it something.

**Claude Desktop:** Desktop's config file can't attach a bearer header directly, so bridge
through [`mcp-remote`](https://www.npmjs.com/package/mcp-remote). Paste this into
`claude_desktop_config.json` and restart the app — easiest way to find/open that file is
**Settings → Developer → Edit Config** inside the app itself, which opens it directly (and
creates it if it doesn't exist yet):

```json
{
  "mcpServers": {
    "everpure-artifacts": {
      "command": "npx",
      "args": ["mcp-remote", "https://everpure-artifact-mcp.onrender.com/", "--header", "Authorization: Bearer <MCP_AUTH_TOKEN>"]
    }
  }
}
```

> **Admin-managed machine, UI disabled?** If your org has turned off Desktop's custom-MCP-install
> UI, Settings → Developer → Edit Config isn't available to you. See
> [Connecting Claude Desktop via Claude Code](./mcp-desktop-setup.html) for the workaround —
> Claude Code edits the same config file directly instead.

**claude.ai (browser):** check **Settings → Connectors** for a custom-connector option that
takes a server URL directly — no local install at all if it supports a bearer token there.
Steps vary by account/version, so this is worth checking live rather than following a fixed
click-path here.

> Free-tier note: the MCP server has no dedicated health check of its own, but in practice it's
> usually already warm during work hours — MapStack's own traffic keeps it hot as a side effect.
> Outside work hours, or on a stretch where MapStack itself has been quiet, the first tool call
> can still take up to a minute while it wakes back up.

**Any other MCP client that speaks HTTP + custom headers** can use the same shape Claude Code's
command produces under the hood:

```json
{
  "mcpServers": {
    "everpure-artifacts": {
      "type": "http",
      "url": "https://everpure-artifact-mcp.onrender.com/",
      "headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
    }
  }
}
```

**Running the repo locally instead?** stdio, zero config beyond the repo setup:

```json
{
  "mcpServers": {
    "everpure-artifacts": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "<path-to-repo>"
    }
  }
}
```

### 3.2 The 16 tools

| Tool | Ask it like… |
|---|---|
| `find_artifacts` | "What content do we have about data tiering for a healthcare CIO?" |
| `get_artifact_detail` | "Tell me everything about this piece" (by URL, slug, or id) |
| `find_similar` | "Are there other pieces like this one, but for a less technical audience?" |
| `recommend_for_prospect` | "What should I send a VP of IT at a bank who's skeptical after a bad vendor experience?" |
| `build_journey` | "Build a 5-touch sequence from awareness to decision for a data-engineering audience" — or pass `phases` for a buying-committee path |
| `journey_health` | "Is this journey still safe to send? Any gone/brand-flagged steps?" |
| `get_taxonomy` | "What industries do we have content for?" |
| `get_jtbd_catalog` | "Which job matches a buyer struggling with GPU utilization?" |
| `get_stage_crosswalk` | "Which buying-process phases does 'awareness content' correspond to?" |
| `get_persona_reference` | "What does a Security Owner care about?" / "How do I pitch a Data Leader?" |
| `analyze_content_coverage` | "Where are our content gaps?" / "Which jobs have no purchase-phase coverage?" |
| `generate_content_brief` | "What content should we create next?" / "Turn our coverage gaps into recommendations" |
| `analyze_corpus_gaps` | "What topics keep coming up that we haven't formally tagged?" |
| `analyze_sitemap_structure` | "What's new on the site that we haven't classified yet?" / "Show me everything under /resources/" |
| `check_brand_compliance` | "Is this artifact safe to share, brand-wise?" |
| `brand_compliance_summary` | "How much of the corpus still needs a brand-name update?" |

Plus two ambient **resources** an agent can read as context: `everpure://taxonomy` and
`everpure://library-summary`.

### 3.3 A realistic agent session

> **You:** I'm meeting a CISO at a hospital next week. They got hit by a ransomware scare last
> quarter and their board is asking questions. What should I bring?
>
> **Agent:** *(calls `get_jtbd_catalog` → maps this to `survive-a-ransomware-attack`; calls
> `recommend_for_prospect` with industry=healthcare, jobsToBeDone=[survive-a-ransomware-attack],
> context about the board pressure)* → returns 3–5 ranked pieces with plain-English "why this,
> why now" rationales, flags anything gated, and notes the anxiety-reducing proof pieces to
> lead with.

---

## 4. Practical use cases

Recipes by role. Every number below is live from the corpus, not hypothetical.

### 4.1 Sales — "What do I send this prospect?"

**Use:** `recommend_for_prospect` (MCP) or `POST /artifacts/recommend` (REST).

Feed it whatever you know — industry, title, stage, what they've raised, what you've already
sent. The JTBD slug is the highest-leverage field: it filters out content that is *about* the
right products but serves the wrong progress. Objection language in `context` silently
boosts objection-handling content.

**Follow-up touches:** pass the pieces they've engaged with in `engagedArtifactIds` /
`alreadyShared` and ask again — the engine sequences around what they've seen.

**Don't stop at the content list** — every recommend call also answers "what do I ask them to
do next?" via the `cta` field (§2.3): Pathfinder for a first touch, Demo for a returning
visitor, Book a Meeting once they've watched the demo.

### 4.2 Demand gen — build a nurture track in one call

**Use:** `POST /journeys/build` with `targetStages` + `artifactTypeMix`.

"5-touch healthcare nurture, mostly videos and case studies, public content only" is one
request: stages + `{ "video": 3, "case-study": 2 }` + `"publicOnly": true`. Every step comes
back with a transition note explaining the handoff to the next touch. Save it with a name and
`GET /journeys/:id/health` tells you when a step goes stale — a linked page vanished, got
gated, or was reclassified.

### 4.3 ABM / buying-committee plays

**Use:** `GET /artifacts?committeePersona=…&force=…&phase=…`

The committee lens is fully filterable against the real Pure Storage buying-committee taxonomy
(§2.1; full behavioral detail via `GET /taxonomy/persona-reference` or `get_persona_reference`).
Example query: Security Owner, risk-reduction proof, validation phase →
`committeePersona=security_owner&force=anxiety&phase=validation`.

That example query currently matches **406 assets** (2026-08-18).

### 4.4 Content strategy — the quarterly gap review

**Use:** `GET /coverage/jtbd` or the `analyze_content_coverage` MCP tool.

One call answers "what should we create next?": which of the 18 jobs are under-covered, which
buying phases have holes (purchase: 2.0%, 90 assets), which committee personas we barely speak
to (non-technical leader: 6.6%, data leader: 7.8% — full breakdown in §2.5), and the per-job ×
per-phase grid showing exactly which combinations have **zero** coverage.
`generate_content_brief` turns those same gaps directly into suggested formats and
rationales — no separate analysis step needed. `analyze_corpus_gaps` complements both with
emergent topics that keep appearing in content but aren't formally tagged yet.

### 4.5 Journey strategy — the Content Map

**Use:** phase-keyed `build_journey` + `get_stage_crosswalk` + `analyze_content_coverage`.

This trio is the working core of the Content Map artifact ("one journey model, five derived
artifacts"): the crosswalk translates between the funnel, JTBD-timeline, and buying-process
vocabularies; phase-keyed journeys assemble the committee's path; coverage shows where the
map has holes. An agent with these three tools can draft a defensible journey map with real
content attached to every stage — and honest gaps where nothing exists.

### 4.6 Web & personalization — filtered content rails

**Use:** `GET /artifacts` with taxonomy filters + `fields` for lean payloads.

"Related resources" for a healthcare page: `?industry=healthcare&type=case-study,webinar&sort=publishedAt&fields=title,description,url,artifactType`.
The website-scoped key can read artifacts and taxonomy — nothing else.

### 4.7 Brand & content ops — pre-flight checks

**Use:** `check_brand_compliance` (MCP) / `GET /brand-audit/:id` (REST).

Before an artifact goes into a sequence or email, one call confirms it doesn't still say
"Pure Storage" — and if it does, returns the exact passages with suggested replacements.
Recommendation results also carry a ⚠ flag on brand-stale items.

---

## 5. Gotchas for testers

1. **Param names are singular** — `?product=`, `?industry=`, `?job=` (not `products=`).
   Multi-value = comma-separated, not repeated params.
2. **Search body uses `filter` (singular)** and silently ignores unknown keys.
3. **Short search queries beat long ones** — `query` is text-matched AND vector-matched
   (see §2.2). Long natural-language asks belong in `/artifacts/recommend`.
4. **Semantic ranking can degrade gracefully.** If the embedding backend is unreachable,
   search/recommend fall back to filter + recency/confidence ranking instead of erroring —
   results still come back, just less semantically sharp.
5. **Gated content is included by default** in most reads; filter `accessTier=public` or use
   `publicOnly` in journey builds if you only want ungated assets.
6. **Free-tier hosting may cold-start.** The REST API is kept warm on weekdays, ~6am–6pm
   Pacific (see §1). The MCP server has no health check of its own, but is usually warm across
   that same window too — MapStack's regular traffic keeps it hot incidentally (see §3.1).
   Outside work hours, or whenever that ambient traffic hasn't happened recently, the first
   request after idle can take ~30–60s. Retry once before reporting an outage.
7. **Everything read-only unless your key says otherwise** — 403s on PATCH/POST-to-save are
   scope, not bugs.
8. **`gone` content is fully removed; `redirected`/`newly-gated` are not.** As of 2026-08-18,
   the 1,528 artifacts whose source had gone permanently dead (`sourceStatus=gone`) were
   removed from the corpus entirely — they no longer appear anywhere, including browse and
   coverage. `redirected`/`newly-gated` content is still handled the old way: `GET /artifacts`
   (browse) and `GET /coverage/jtbd` show it by default — browse is the deliberate escape hatch
   for inspecting retired-but-not-dead content, and coverage reports on everything still
   classified. `POST /artifacts/search`, `find_similar`, `random`, and every
   `recommend`/`build_journey` call exclude both categories — those are "what can I actually
   point someone at" paths. Filter `sourceStatus=live` on a browse call if you want parity with
   what search/recommend would return.
9. **Ranking may briefly lag on 48 recently corrected artifacts.** Until 2026-08-13
   ingestion took the first PDF link on a page as that page's own document, so an article
   that cites an outside report could absorb that report's full text — which is what
   search ranking and taxonomy read. The pipeline now only merges documents served from
   our own domains, and the 48 affected rows (of ~5,200) were corrected on 2026-08-13:
   6.7M characters of other companies' documents removed, 87% of the stored text on those
   rows. Nothing was deleted — only the borrowed text. Their classification and embedding
   are being rebuilt from the corrected text, so until that finishes a handful of these can
   still rank on vocabulary that reads like somebody else's paper. Worth reporting with the
   URL if you see it. Same cleanup: 44 artifacts that had archived a cited third party's PDF
   now return `storedAssetPath: null` — we no longer serve another company's document as an
   Everpure asset. The citation itself is still recorded, and no first-party asset was
   affected.

## 6. Reporting issues

Log: the exact request (URL + body), what you expected, what you got, and your key *name*
(never the key itself). Confidence scores and rationales are part of the product — "this
ranked #1 but shouldn't" is exactly the feedback we want.
