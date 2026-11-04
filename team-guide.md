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
- **What it's about** — products, solutions, industries, topics (220 canonical taxonomy slugs)
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

> **Anonymous agent discovery (not enabled yet).** A separate, keyless, read-only surface for
> outside AI agents — an agent card plus five `/v1/public/*` routes — is built but switched off
> in production. Everything else in this guide still needs a key. See §2.10; until it is turned
> on, those paths answer `401` like any other unknown path.

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
| `channel` | `email`, `sales-rep`, `webinar`, `event`, `website`, `paid-media`, `organic-search`, `social`, `partner`, `community`, `other` | Delivery channel this content fits — normalized from the classifier's free-text `idealChannel`/`surfacingSignals[].channel` (see [contentChannels.ts](https://github.com/brandonjspencer/everpure-artifact-intelligence/blob/main/src/config/contentChannels.ts)) |
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
Journey Map Builder uses; it scores candidates across semantic similarity, taxonomy overlap, measured engagement (a 5 % tie-breaker from Contentsquare: how long visitors stay and scroll on that kind of page, neutral for untracked PDFs),
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
- `targetChannel` — the delivery channel the recommended content should fit (`email`,
  `sales-rep`, `webinar`, `event`, `website`, `paid-media`, `organic-search`, `social`,
  `partner`, `community`, `other`). A soft ranking preference, not a filter — an artifact with
  no channel tags at all is never excluded or penalized, just not boosted. Same field, same
  effect, on `POST /journeys/build`'s `prospectProfile` and the MCP `recommend_for_prospect`/
  `build_journey` tools.
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

Build a **realistic click path** — a journey that tours the site's actual structure (real
solution/product/demo/service/event/trust-center hub pages and their real sub-pages), falling
back to content-scoring only where no real hub tree exists. A requested stage can produce
*more than one* step (e.g. four real sibling sub-pages all classified `education`), so
`maxLength` caps the **total number of steps emitted**, not the number of distinct requested
stages.

```bash
# Funnel-keyed: awareness → decision
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/journeys/build" -d '{
    "prospectProfile": { "industry": "healthcare", "jobsToBeDone": ["survive-a-ransomware-attack"] },
    "targetStages": ["awareness", "education", "consideration", "decision"]
  }'

# Phase-keyed: the buying committee's path (one step per buying-process phase, absent a real hub)
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/journeys/build" -d '{
    "prospectProfile": { "industry": "healthcare", "jobsToBeDone": ["survive-a-ransomware-attack"] },
    "targetPhases": ["problem_identification", "solution_exploration", "validation", "consensus_creation", "purchase"]
  }'

# entryPointUrl: pin the prospect's REAL first destination as step one (e.g. "lands on the
# home page from organic search, interested in virtualization") — the journey walks the real
# hub tree from there if it resolves to one.
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/journeys/build" -d '{
    "prospectProfile": { "jobTitle": "VP Infrastructure", "currentTopics": ["virtualization"] },
    "targetStages": ["awareness", "education", "consideration", "decision", "expansion", "advocacy"],
    "entryPointUrl": "https://www.everpuredata.com/solutions/virtualization.html",
    "maxLength": 9
  }'
```

Pass **exactly one** of `targetStages` (funnel) or `targetPhases` (buying-process) — the API
400s if you send both or neither. Options: `maxLength` (2–20, default 5, total steps not
stages), `publicOnly`, `artifactTypeMix` (e.g. `{ "video": 2, "case-study": 1 }`),
`entryPointUrl` (the prospect's actual, named first destination — pinned as step one
regardless of score; silently ignored if it doesn't resolve to a real, live artifact).

Journeys can also be **saved** (`POST /journeys` with a `name`, needs a write-scoped key) and
then monitored: `GET /journeys/:id/health` flags steps whose artifact has gone away, changed,
been reclassified out of its slot, become gated, or picked up brand issues.

Each step (from the second onward) carries the same **verified** click-path signal as
`/artifacts/recommend` above (`navigation: { linkVerified, verifiedTargetUrl, suggestedCta }`),
computed server-side between consecutive steps — no request field needed, unlike the recommend
endpoint. Absent on the first step (nothing precedes it to check). Every step also carries a
**`sitemapAttached`** flag — a separate, node-level honesty signal from `navigation`: `true`
when the step is the pinned entry point, a real hub-tree child, or a content-scored pick the
preceding step's page really links to; `false` for a pure content-scoring fallback pick (or an
unpinned first step) with no real structural or link basis. The MCP text rendering marks a
`false` step with "⚠ Detached from sitemap" — the same idea MapStack's own UI flags.

Every step also carries multi-pick **Next Best Experience(s)** (`nextBestExperiences`), **Next
Best Offer(s)** (`nextBestOffers`), and **Next Best Action(s)** (`nextBestActions`) — concrete
artifacts, each with a real match `score` and the artifact's real `url`, plus a **Think/Feel/Do**
scenario (`thinkFeelDo`) for the prospect at that stage. `nextBestExperiences`/`nextBestOffers`
are sourced from **one pool matching the prospect's own stated interest** (computed once,
re-ranked per step) — not "whatever the next requested stage happens to contain." A topically
important piece of content (say, a virtualization webinar) surfaces as a recommendation on
*any* step it's relevant to, even a step classified for a different stage — importance is
expressed as a strong recommendation on the page the prospect is already on, not as a
competing future step. `nextBestActions[0]` is always the real "advance to the next step" pick
(or the terminal CTA ladder — pathfinder/demo/meeting, routing toward a real
demand-generation touchpoint once the journey reaches decision/validation: a confirmed
`/thank-you` page, Contact/Contact Sales, a test-drive/trial, an event registration, or a
gated-download offer); index 1+ are the same `nextBestOffers` pool, action-framed as "Compare
with X" / "Review Y". Each NBX pick carries `verified: true` when the page already really
links there, or `verified: false` (a recommendation to add that link) when it doesn't — never
blurred. Selection is grounded and progressive: a candidate the preceding step's real page
already links to is preferred over a merely higher-scoring unlinked one, technical depth is
rewarded for holding or deepening rather than regressing, and the terminal step's action ladder
is capped if the journey itself never reached decision/validation content — and demoted to an
honest "chat only" rationale if the terminal step isn't on the main site (Pathfinder/Demo/
Meeting aren't reachable from the blog or the other first-party properties). When
`prospectProfile.committeePersona` names more than one buying-committee role, `nextBestOffers`
splits one offer per persona instead of one generic pick. Each step also carries its own
`contentGaps` (that stage's slice of the response-level `gapDetails`, richer detail behind
`gaps`), explaining any missing experience/offer content type with suggested formats.

Ranking also factors the prospect's **Web Audience tier** — `prospectProfile.webAudienceTier`
(`platform` / `traditional` / `extended`, from `Core Web Audiences.pdf`), explicit or derived
from `committeePersona` — toward the content types that tier is documented to prefer (analyst
reports/video/thought-leadership for Platform; demos/case studies/datasheets for Traditional).
Call `get_web_audience_tiers` for the full reference. Extended is a real, recognized tier
value, but its own non-funnel journey shape (partner-specific stages, etc.) isn't built yet —
and its sub-audiences beyond Partner (investor/press/careers) have no classified content today,
since that content is deliberately excluded from ingestion.

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

- `GET /taxonomy` — the 220 canonical product/solution/industry/topic/job-function slugs. Since 2026-09-04
  this includes FlashArray/FlashBlade/Purity model slugs (`flasharray-x`, `flashblade-s`, `purity-fa`…) and
  partner/platform solutions (`azure`, `nutanix`, `nvidia`, `red-hat-openshift`, `sap-hana`, `sql-server`,
  `oracle-database`, `openstack`, `ai-factory`, `threat-detection`…). `storage-as-a-service` is now a
  **product** slug only (it was a solution slug before 2026-09-04; the rows were migrated). Terms carry a `parentSlug` where they
  are a model child or an umbrella (e.g. `flasharray-x` → `flasharray`, `hybrid-cloud` → `cloud`). The
  corpus-wide reclassify to pick up these slugs finished 2026-09-08 — 4,371 of 4,403 live artifacts
  (99.3%) now carry them. The remaining 32 are pages that became gated mid-drain (`newly-gated`),
  which the reclassify batch deliberately skips; they'll pick up the new taxonomy on their next
  refresh once gating is confirmed.
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

### 2.8 Closed-loop feedback — `POST /v1/feedback` and friends

Every `recommend`/`journey build`/`journey save` call is now passively logged
(`recommendation_log` — endpoint, prospect profile, the artifact IDs actually returned), so
"what did we recommend to fintech CISOs last month" is answerable without instrumenting a
caller. This happens automatically, fire-and-forget — nothing to call for it, and a logging
hiccup never affects the real response. **REST-only, deliberately not an MCP tool**: every MCP
tool in this server is read-only by design (a dedicated security review confirmed it), and
recording engagement is a write, however narrow.

The other half — reporting what actually happened once a caller observes it — is a real
endpoint:

```bash
curl -s -X POST -H "x-api-key: $EVERPURE_API_KEY" -H "content-type: application/json" \
  "$EVERPURE_API/feedback" -d '{
    "prospectKey": "crm-contact-48213",
    "artifactId": "6e1e6b8e-....-....-....-............",
    "action": "clicked",
    "channel": "email",
    "occurredAt": "2026-09-02T18:30:00Z"
  }'
```

- `prospectKey` is opaque — a CRM contact ID or CDP profile ID the caller already tracks, never
  a real identity this system resolves or stores PII against.
- `action` is one of `served`, `clicked`, `converted`, `ignored`. Everything but `served` implies
  the caller independently observed real engagement (an email open/click, a CRM stage change,
  a self-report) — this system never infers it.
- `journeyId`/`sequencePosition` are optional context if the event came from a saved journey.
- `GET /feedback?prospectKey=...&artifactId=...&journeyId=...&action=...` lists recorded events,
  paginated, newest first.
- Requires the `engagement:write` scope to record, `engagement:read` to list — neither is
  bundled into the scopes existing keys carry by default; a key needs one explicitly added.

---

### 2.9 Performance context — Contentsquare traffic on every artifact

Since 2026-10-08 the corpus carries **page-level performance from Contentsquare** alongside
classification, so "what do we have?" can be answered next to "how does it perform?".

How it works, and the one caveat to keep in mind:

- Contentsquare reports metrics per **page group** (sets of URLs defined in the Contentsquare
  UI), not per URL. Every artifact is linked to the most specific page group whose URL rule
  matches its canonical URL — a themed group (e.g. "Knowledge - AI", "PDFs - Solution briefs",
  "Demos - Managing at scale") when one exists, else the broader group from the main mapping.
  The `performance` block on an artifact shows the **group's
  totals** (shared by every page in the group); the `views28d` on cards, sorts and coverage
  is an **estimated share** — the group's views split evenly across the artifacts in it — so
  a group's traffic is counted once across the corpus instead of once per member. Exit,
  bounce and scroll rates are group-level by nature.
- PDFs are measured through the on-site document viewer, grouped by type (solution briefs,
  case studies, …) with the most-viewed PDFs in groups of their own. Time on page is not
  available for PDFs. **Pages no group covers (most blog posts, gated assets) show `null`** —
  `null` means "not measured", never "zero traffic".
- Numbers refresh nightly (trailing 7-day and 28-day windows, rates are percentages).

Where it shows up:

| Surface | What you get |
|---|---|
| `GET /artifacts` / `POST /artifacts/search` summary cards | `views28d` (estimated share), `exitRate28d` (group rate) |
| `GET /artifacts?sort=views28d` (or `exitRate28d`) | most-visited / highest-exit first; untracked artifacts sort last |
| `GET /artifacts?tracked=true&minViews28d=500` | only artifacts with traffic numbers / above a floor |
| `GET /artifacts/:id` | a `performance` block: page group name, 7-day and 28-day views, visits, unique visitors, bounce, exit, scroll, time on page, goal conversion, as-of timestamps |
| `GET /coverage/jtbd` | `traffic` summary plus `views28d` / `viewsShare` on every job, phase, force, persona and dimension cell (sums of the per-artifact estimated shares); gaps of equal severity rank by traffic |
| `GET /coverage/jtbd/brief` | an `evidence` line per gap: how much demand the thin content already draws |
| `GET /journeys/:id/health` | a new `underperforming` step issue when a step's page gets ≥100 views in 28 days and ≥70 % of visitors exit the site there |

MCP equivalents: `find_artifacts` and `list_artifacts` accept `tracked` and `minViews28d`
filters, `list_artifacts` accepts `sort: "views28d" | "exitRate28d"`, result blocks show a
`Traffic (28d, page group)` line, and `get_artifact_detail` prints the full performance block.

Reading the coverage numbers: a **thin cell with a large `viewsShare`** is under-served
demand — few assets carrying a lot of traffic — and is the gap to fill first. A thin cell
with ~0 views is thin *and* unseen; check discoverability before producing more.

### 2.10 Anonymous agent discovery — `/.well-known/agent-card.json` and `/v1/public/*`

> **Status: built, not enabled in production.** It ships behind `PUBLIC_DISCOVERY_ENABLED`
> (default `false`). While that is off none of the paths below exist: they return the same `401`
> as any other unauthenticated unknown path. Testers integrating the product use the keyed API
> in §2.1–2.9; this section is for understanding — and later verifying — what an *outside* agent
> (an AI assistant or crawler landing on everpuredata.com) is able to see.

**What it is.** A small, anonymous, read-only door onto the same corpus, modelled on the A2A
"agent card" convention: an agent fetches `/.well-known/agent-card.json`, reads which skills exist
and how to call them, and then calls plain REST endpoints. No key, no login, **no LLM anywhere in
the path** — every response is a database or reference-document lookup, so it adds no model cost.

| Skill (agent-card id) | Call | Notes |
|---|---|---|
| Agent card | `GET /.well-known/agent-card.json` (also `GET /v1/public/.well-known/agent-card.json`) | Lists the five skills with a JSON Schema of each request (`x-everpure-input`), the limits, and how to read `confidence`. `authentication.schemes` is `["none"]`. |
| `get_taxonomy` | `GET /v1/public/taxonomy` | Slugs and labels for products, solutions, industries, topics, job functions — use them as search filters. |
| `get_jtbd_catalog` | `GET /v1/public/jtbd-catalog` | The 18 jobs as `id`, `slug`, `label`, `statement` only. |
| `get_stage_crosswalk` | `GET /v1/public/stage-crosswalk` | Buying-process phase ↔ JTBD stage ↔ funnel stage mapping. |
| `find_artifacts` | `POST /v1/public/artifacts/search` | Semantic + filtered search. See below. |
| `find_similar` | `GET /v1/public/artifacts/:id/similar?limit=` | Public content closest to a given artifact id. May return fewer than `limit` when many of the nearest neighbours are gated. |

The reference documents are deliberately **trimmed views**: no changelog notes, no internal
file paths, no buyer-psychology fields (forces, personas, emotional/social dimensions), and
taxonomy descriptions have the classifier-instruction sentences removed. They are cacheable for 5
minutes (`Cache-Control: public, max-age=300`).

**Search request** — `query` (1–500 characters) and/or `filter`; an empty body is a `400`.

```bash
curl -s -X POST "$BASE/v1/public/artifacts/search" \
  -H 'content-type: application/json' \
  -d '{ "query": "ransomware recovery for a hospital", "limit": 5,
        "filter": { "industry": ["healthcare"] } }'
```

| Field | Rules |
|---|---|
| `limit` | 1–10, default 5. Anything higher is a `400`, not clamped. You can get fewer than `limit` back: results under the relevance floor are withheld, and so are the excluded pages described below. |
| `minScore` | 0–1. Can **raise** the relevance floor for this request, never lower it. |
| `filter` | `product`, `solution`, `industry`, `topic`, `job` are slug lists (≤10 each); taxonomy synonyms resolve as in §2.6 (`fintech` → `financial-services`) and an unknown slug quietly matches nothing. `type`, `stage` and `phase` are fixed vocabularies: an unknown value is a `400`; `type` takes ≤5 values, and `stage`/`phase` have 7 values each. Every list you send must be non-empty (`[]` is a `400`, not "no filter" — leave the key out instead), and no value or `query` may contain a NUL character. |
| anything else | Ignored — including any `accessTier` the caller sends. |

**What comes back** — each result carries only: `id`, `url`, `title`, `description`,
`artifactType`, `publishedAt`, `ageBucket`, `buyingStages`, `targetAudience`, `technicalDepth`,
`products`, `solutions`, `industries`, `topics`, `jobsToBeDone`. It does **not** carry traffic
numbers, sales-trigger copy, brand status, buyer personas, channels, cloaked tags, page text or
embeddings. Only **public-tier** content is ever returned; that is forced on the server.

```json
{
  "data": [{ "artifact": { "id": "…", "url": "https://www.everpuredata.com/…", "title": "…" }, "score": 0.655 }],
  "meta": { "mode": "semantic", "count": 5, "topScore": 0.655, "minScore": 0.4,
            "confidence": "high", "lowConfidence": false, "degraded": false }
}
```

Some pages are public and live but answer no question an agent asks — thank-you and "Registration
Confirmed" pages, `/forms/…`, the meeting-scheduler page, the 404 page, a stray test page, a
partner practical-exam outline, and pages an editor has titled "RETIRED –" or "DO NOT USE –" but
left published. Search and `/similar` leave them out, **and only the pages on an explicit reviewed
list are left out**: [`src/config/publicExclusions.json`](https://github.com/brandonjspencer/everpure-artifact-intelligence/blob/main/src/config/publicExclusions.json)
(16 of roughly 3,900 public pages today), each entry a URL and a reason. Matching ignores scheme,
host case, a trailing slash and any query string or fragment. Nothing is hidden by pattern, so a
real article can never vanish because its title or URL happens to look like a form step. Real
content filed as `artifactType=other` is not on the list: the Evergreen program description,
impact/ESG/SOC reports, training course descriptions, reseller profiles and the "Test Drive" demo
pages all come back.

**Keeping the list current.** `npm run ops:public-exclusions` (read-only) lists entries that are no
longer public and retrievable, which can be pruned, and public pages that *look* transactional but
aren't on the list, as candidates. Add a candidate by PR, with a reason, only if it answers no
question an agent would ask. If the file is malformed the API still starts, but the discovery
surface stays off — exactly as if the flag were unset — and an error naming the file is logged at
boot; the keyed API is unaffected. `npm test` also loads the real file, so the pre-merge gate catches a bad edit — when it is run: there is
no CI, so an edit made in the GitHub web UI skips it. Run `npm test` locally before merging a list change.

**Reading `meta` — how far to trust the answer.** This is the part an agent must not skip.

| `meta` | Meaning |
|---|---|
| `mode` | `semantic` (vector ranked) · `text` (unranked substring match — never a confident answer) · `filter` (no query) |
| `confidence` | `high` — semantic with a top score ≥ **0.62** (a strong sign the closest result is on-topic, not a guarantee it answers the question) · `weak` — results returned, but the top score is lower or the results aren't vector ranked · `none` — nothing cleared the floor · `null` — filter-only search |
| `lowConfidence` | `true` exactly when `confidence` is `weak` or `none`: treat the results as a hint, not an answer |
| floor | Semantic matches scoring under **0.4** are withheld entirely, so a clearly off-topic query returns `data: []` with `confidence: "none"` instead of confident-looking junk |
| `degraded` | `true` when the embedding backend was unreachable, or rejected the query text (e.g. malformed Unicode), and text matching was used instead |
| `score` | Present only on vector-ranked results. Filter-only and text results have none, and filter-only results are in recency order, not relevance order |

In practice: one-word queries ("backup", "FlashBlade", "AI", "pricing") score about 0.45–0.53 and
are graded `weak`; two-word topics ranged from 0.55 to 0.74 in testing and can land on either side
of the boundary ("data protection" scored 0.59 and is graded `weak`, correctly — its top hits were
generic, while "disaster recovery" scored 0.60 and was `weak` despite excellent results); specific
multi-word questions score about 0.65 or more and are usually `high`. The boundary is a hint, not a
verdict: a `high` result can still be a poor match ("ransomware protection" was `high` at 0.69 but
led with an April Fools post), and a `weak` one can be excellent. Treat `weak` as "worth a second
look", and read `topScore` and the titles rather than the label alone when the decision matters.

Two things the floor does that surprise people. A natural buying question ("how do I buy",
`topScore` ≈ 0.26) usually falls *under* the floor and returns `none` — rephrase it around the
topic ("pricing Evergreen//One"). Off-topic or purely conversational words ("hello", "thank you")
usually fall under the floor too and return `none`. A single broad product word ("storage",
"pricing") scores just above it and returns loosely related pages, always graded `weak` — never
act on a `weak` result as if it were an answer.

**Limits** — all per minute, per client address (IPv6 clients count as their whole `/64`).

| Bucket | Per client | All anonymous callers combined |
|---|---|---|
| Reference documents | 60 | 600 |
| Search + similar (these cost an embedding call) | 30 | 200 |
| Agent card (its own counters, so it stays reachable) | 60 | 600 |

Over a limit you get `429` with `error.code: "rate_limited"` and `retry-after`. On a success, and
on a per-client `429` ("Rate limit exceeded"), the `x-ratelimit-*` headers describe *your own*
allowance. A message ending "Public API is at capacity" means the combined ceiling was hit, not
your own limit: the headers then describe that shared ceiling (`remaining: 0`). Either way,
`retry-after` is the number of seconds to back off. These limits are independent of the keyed
API's, so exhausting them never affects a keyed caller.

**What it will never do.** No LLM calls, no writes, no gated content, no `recommend` / journeys /
coverage / brand tools (those stay behind a key), and no performance data. `/similar` returns
public neighbours only and has no confidence signal — it is a similarity score, nothing more.

**Trying it locally** (run from the repo; needs the same `.env` as the normal API):

```bash
PUBLIC_DISCOVERY_ENABLED=true API_HOST=127.0.0.1 API_PORT=3199 npm run dev:api
curl -s localhost:3199/.well-known/agent-card.json
```

**Turning it on (Brandon / ops).** Environment variables on the API service:

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_DISCOVERY_ENABLED` | `false` | The master switch. Off = the surface doesn't exist. |
| `PUBLIC_CLIENT_IP_HEADER` | *(empty)* | **Set to `cf-connecting-ip` on Render.** Behind Render every socket address is the proxy, so without this all anonymous callers share one rate-limit bucket (the server logs a warning at boot in production if it's unset). Leave empty locally — trusting a header a caller can set would let them pick their own bucket. Verify it from two networks after the first deploy. |
| `PUBLIC_RATE_LIMIT_MAX` / `PUBLIC_SEARCH_RATE_LIMIT_MAX` | `60` / `30` | Per-client, per window |
| `PUBLIC_TOTAL_RATE_LIMIT_MAX` / `PUBLIC_TOTAL_SEARCH_RATE_LIMIT_MAX` | `600` / `200` | All callers combined |
| `PUBLIC_RATE_LIMIT_WINDOW_MS` | `60000` | Window length |
| `PUBLIC_MIN_SCORE` / `PUBLIC_WEAK_SCORE` | `0.4` / `0.62` | Relevance floor / the `high`↔`weak` boundary |
| `PUBLIC_BASE_URL` | the Render API URL | Origin advertised inside the agent card |

**After turning it on, confirm it is actually serving** — a malformed exclusion list keeps the surface
off without failing the deploy:

```bash
curl -s https://everpure-artifact-api.onrender.com/v1/health          # checks.publicDiscovery must be "on"
curl -s -o /dev/null -w '%{http_code}\n' https://everpure-artifact-api.onrender.com/.well-known/agent-card.json   # must be 200
```

`checks.publicDiscovery` is `on`, `off` (flag unset) or `invalid-exclusions` (flag set, list failed to
load — the boot log names the problem). It is informational and never turns health red. `/v1/metrics`
carries the same as `everpure_public_discovery_enabled` and `everpure_public_discovery_exclusions_invalid`
gauges, for an alert.

The agent card is served from the API's own `onrender.com` origin. For agents landing on
everpuredata.com to find it, the website needs a redirect/proxy for
`/.well-known/agent-card.json` or a link to it — that is a website-side change, not something
the main repo can do.

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

**Claude Desktop — easiest: download the extension.**
[everpure-artifacts.mcpb](./installers/everpure-artifacts.mcpb) —
drag it onto Claude Desktop (or double-click it), then paste your API key into Desktop's own
config screen when it asks. No Node.js check, no Gatekeeper warning, no manual JSON editing —
one file, works on Mac/Windows/Linux. It's a thin stdio↔HTTP bridge (no dependencies, just
Node's built-in `http`/`https`), not a real local server; see `desktop-installer/mcpb/` in the main
repo to see how it works or rebuild it after a tool-list change:

```bash
cd desktop-installer/mcpb
npx @anthropic-ai/mcpb validate manifest.json
npx @anthropic-ai/mcpb pack . ../everpure-artifacts.mcpb
```

**Or by hand:** Desktop's config file can't attach a bearer header directly, so bridge
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

> **Admin-managed machine, UI disabled?** The extension install above is a different Desktop
> feature from the custom-MCP-server UI, so it's worth trying even if your org has disabled
> that — see [Connecting Claude Desktop to Everpure Intelligence](./mcp-desktop-setup.html) for
> the plain get-a-key-and-double-click version.

**claude.ai (browser):** check **Settings → Connectors** for a custom-connector option that
takes a server URL directly — no local install at all if it supports a bearer token there.
Steps vary by account/version, so this is worth checking live rather than following a fixed
click-path here.

> Free-tier note: a scheduled GitHub Actions ping keeps the MCP server warm on weekdays, roughly
> 6am–6pm Pacific (same window as the REST API), on top of the incidental warmth from MapStack's
> own regular traffic. Outside that window, or on the rare gap the scheduled ping doesn't
> perfectly cover, the first tool call can still take up to a minute while it wakes back up.

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

### 3.2 The 18 tools

| Tool | Ask it like… |
|---|---|
| `find_artifacts` | "What content do we have about data tiering for a healthcare CIO?" — a ranked shortlist (capped at 20), not exhaustive |
| `list_artifacts` | "Pull together every piece of content for Infrastructure Owners in healthcare" — no ranking, no cap, real `total`/`offset` pagination so nothing is silently dropped. Use this over `find_artifacts` whenever the deliverable needs to be complete (a booth kit, a content audit, a campaign list) |
| `get_artifact_detail` | "Tell me everything about this piece" (by URL, slug, or id) |
| `find_similar` | "Are there other pieces like this one, but for a less technical audience?" |
| `recommend_for_prospect` | "What should I send a VP of IT at a bank who's skeptical after a bad vendor experience?" |
| `build_journey` | "Build a 5-touch sequence from awareness to decision for a data-engineering audience" — or pass `phases` for a buying-committee path |
| `journey_health` | "Is this journey still safe to send? Any gone/brand-flagged steps?" |
| `get_taxonomy` | "What industries do we have content for?" |
| `get_jtbd_catalog` | "Which job matches a buyer struggling with GPU utilization?" |
| `get_stage_crosswalk` | "Which buying-process phases does 'awareness content' correspond to?" |
| `get_persona_reference` | "What does a Security Owner care about?" / "How do I pitch a Data Leader?" |
| `get_web_audience_tiers` | "How does a Platform-tier visitor behave differently than Traditional?" |
| `analyze_content_coverage` | "Where are our content gaps?" / "Which jobs have no purchase-phase coverage?" |
| `generate_content_brief` | "What content should we create next?" / "Turn our coverage gaps into recommendations" |
| `analyze_corpus_gaps` | "What topics keep coming up that we haven't formally tagged?" |
| `analyze_sitemap_structure` | "What's new on the site that we haven't classified yet?" / "Show me everything under /resources/" |
| `check_brand_compliance` | "Is this artifact safe to share, brand-wise?" |
| `brand_compliance_summary` | "How much of the corpus still needs a brand-name update?" |

**Scopes decide which tools you see.** On the remote server each tool needs the same scope as
its REST equivalent (`artifacts:read`, `journeys:read`, `taxonomy:read`, `corpus:read`,
`pipeline:read`, `brand-audit:read`) and a tool your key can't use simply isn't listed. Fixed
2026-10-22: `get_web_audience_tiers` had no scope entry, so any key could call it; it now needs
`taxonomy:read` like the other reference tools. If it vanished from your tool list, your key lacks
that scope.

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
6. **Free-tier hosting may cold-start.** Both the REST API and the MCP server are kept warm on
   weekdays, ~6am–6pm Pacific, by scheduled pings (see §1 and §3.1) — the MCP server's schedule
   also loops every few minutes per run to survive GitHub Actions' own scheduling jitter, since a
   single 10-minute cron trigger wasn't landing reliably enough to beat Render's ~15-minute
   idle spin-down. Outside that window, the first request after idle can take ~30–60s. Retry
   once before reporting an outage.
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
10. **`engagement:read`/`engagement:write` aren't on any existing key by default.** They're new
    scopes for `GET`/`POST /v1/feedback` (§2.8) — a 403 there means the key genuinely needs one
    added, not a bug. The passive logging half (every recommend/journey call recorded to
    `recommendation_log`) needs no scope at all — it isn't a caller-facing endpoint.

11. **A `401` on `/v1/public/…` or `/.well-known/agent-card.json` is expected today.** The
    anonymous discovery surface (§2.10) is switched off in production, so those paths behave like
    any unknown unauthenticated path. It is not a key problem. Locally, set
    `PUBLIC_DISCOVERY_ENABLED=true`.

12. **An empty filter list means something different on each surface.** On the keyed
    `POST /v1/artifacts/search`, `"product": []` matches nothing (0 results, like `type: []` always
    did). MCP `find_artifacts` ignores an empty list, as if the key were absent. The anonymous
    `/v1/public` search rejects it with a `400`. To filter on nothing, leave the key out.

## 6. Reporting issues

Log: the exact request (URL + body), what you expected, what you got, and your key *name*
(never the key itself). Confidence scores and rationales are part of the product — "this
ranked #1 but shouldn't" is exactly the feedback we want.
