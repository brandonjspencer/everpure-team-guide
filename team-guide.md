# Everpure Artifact Intelligence — Team Guide

This is the guide for **using** the API and MCP server — for testing, integrating, or just
exploring what the content intelligence layer knows. (For building/running the pipeline itself,
see the [main repo's README](https://github.com/brandonjspencer/everpure-artifact-intelligence#readme).)

**What this system knows:** every marketing and technical artifact on everpuredata.com, plus
blog.everpuredata.com — **5,199 classified** (100% JTBD-enriched), of which **3,767 are
currently retrievable** (avg. classification confidence **0.826**) through search, recommend,
similar, random, and journeys. The other ~1,432 are marked `gone` or `redirected` — pages the
CMS has since unpublished or bounced elsewhere — and stay fully classified and inspectable via
`GET /artifacts` (browse) and `GET /coverage/jtbd`, just excluded from anything that would
actually point someone at a link. See gotcha #8. (Confidence across *all* classified content,
retrievable or not, averages lower — **0.714** — content that got retired skewed
lower-confidence to begin with.)

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

> **Free-tier note:** this deployment spins down after ~15 minutes of inactivity. The first request after a lull can take 30–60 seconds to respond — that's normal, not an outage. Retry once before reporting a problem.

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
| `job` | JTBD catalog slugs, e.g. `survive-a-ransomware-attack` — full 18-job list: [jtbd-catalog.md](./jtbd-catalog.md) (or the `get_jtbd_catalog` MCP tool) | The buyer progress the content serves |
| `force` | `push`, `pull`, `anxiety`, `habit` | Demand-side force the content acts on |
| `committeePersona` | `economic_buyer`, `infrastructure_owner`, `technical_evaluator`, `security_compliance`, `end_user`, `executive_sponsor`, `champion`, `procurement`, `ai_platform_owner` | Buying-committee role targeted |
| `product` / `solution` / `industry` / `topic` | Taxonomy slugs (`GET /taxonomy` for the canonical lists), or a common synonym — see §2.6 | Subject matter |
| `audience` | `c-suite`, `vp-director`, `manager`, `individual-contributor`, `technical-architect`, `developer`, `end-user` | Reader level |
| `persona` | `economic-buyer`, `technical-buyer`, `user-buyer`, `champion`, `influencer` | Classic buyer persona |
| `technicalDepth` | `executive`, `practitioner`, `technical`, `developer` | How deep it goes |
| `accessTier` | `public`, `gated` | Lead-gate status |
| `sourceStatus` | `live`, `redirected`, `gone`, `newly-ungated`, `newly-gated` | Crawl-time reachability — see gotcha #8 before assuming this defaults to `live`-only |
| `ageBucket` / `stalenessRisk` | `current`…`archived` / `low`…`critical` | Freshness |
| `publishedAfter` / `publishedBefore` | ISO dates | Publish window |
| `fields` | comma-separated field names | Sparse responses (id always included) |
| `limit` / `offset` / `sort` / `order` | limit ≤ 100; sort: `publishedAt`, `createdAt`, `updatedAt`, `title`, `confidence` | Paging |

```bash
# Healthcare case studies (77 in the corpus today)
curl -s -H "x-api-key: $EVERPURE_API_KEY" \
  "$EVERPURE_API/artifacts?industry=healthcare&type=case-study&limit=10"

# Anxiety-reducing proof content aimed at the security owner, serving the validation phase (460 today)
curl -s -H "x-api-key: $EVERPURE_API_KEY" \
  "$EVERPURE_API/artifacts?committeePersona=security_compliance&force=anxiety&phase=validation"
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

### 2.5 Coverage & gaps — `GET /coverage/jtbd`

The Content Map engine: how well the corpus covers every job, phase, force, persona, and
dimension — zero-filled (a value with no coverage still appears), with an 18×7 job-by-phase
grid and a severity-flagged gap list (`missing` = zero assets, `critical` < 2%, `low` < 5%).

Today's headline findings, straight from the endpoint: purchase-phase content (**1.58%**, 82
assets) and the `end_user` persona (**1.08%**, 56 assets) are both **critical** gaps, and
`procurement` (3.42%, 178 assets) + the `escape-hypervisor-lock-in` job (4.19%, 218 assets) are
thin. The two critical gaps haven't moved at all across the last content cycle — zero new
purchase-phase or `end_user` assets shipped — while the corpus grew elsewhere, which is itself
the finding: these gaps won't close on their own.

Coverage counts everything **classified**, including any artifact currently `gone` or
`redirected` (see gotcha #8) — this endpoint answers "what has the content team produced,
ever," not "what's live right now."

### 2.6 Taxonomy & vocabularies

- `GET /taxonomy` — the 188 canonical product/solution/industry/topic/job-function slugs
- `GET /taxonomy/coverage` — artifact counts per taxonomy value
- `GET /taxonomy/stage-crosswalk` — the canonical translation between the three stage
  vocabularies (buying-process phases ↔ JTBD timeline ↔ funnel stages), each phase with its
  dominant forces. Use it whenever an ask arrives in one dialect and your filter needs another.
- The 18-job JTBD catalog: [jtbd-catalog.md](./jtbd-catalog.md)

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

**claude.ai (browser):** check **Settings → Connectors** for a custom-connector option that
takes a server URL directly — no local install at all if it supports a bearer token there.
Steps vary by account/version, so this is worth checking live rather than following a fixed
click-path here.

> Free-tier note: the first tool call after a lull can take up to a minute while the service
> wakes back up — same as the REST API.

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

### 3.2 The 13 tools

| Tool | Ask it like… |
|---|---|
| `find_artifacts` | "What content do we have about data tiering for a healthcare CIO?" |
| `get_artifact_detail` | "Tell me everything about this piece" (by URL, slug, or id) |
| `find_similar` | "Are there other pieces like this one, but for a less technical audience?" |
| `recommend_for_prospect` | "What should I send a VP of IT at a bank who's skeptical after a bad vendor experience?" |
| `build_journey` | "Build a 5-touch sequence from awareness to decision for a data-engineering audience" — or pass `phases` for a buying-committee path |
| `get_taxonomy` | "What industries do we have content for?" |
| `get_jtbd_catalog` | "Which job matches a buyer struggling with GPU utilization?" |
| `get_stage_crosswalk` | "Which buying-process phases does 'awareness content' correspond to?" |
| `analyze_content_coverage` | "Where are our content gaps?" / "Which jobs have no purchase-phase coverage?" |
| `generate_content_brief` | "What content should we create next?" / "Turn our coverage gaps into recommendations" |
| `analyze_corpus_gaps` | "What topics keep coming up that we haven't formally tagged?" |
| `analyze_sitemap_structure` | "What's new on the site that we haven't classified yet?" / "Show me everything under /resources/" |
| `check_brand_compliance` | "Is this artifact safe to share, brand-wise?" |

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

The committee lens is fully filterable. Real examples:

- Security owner, risk-reduction proof, validation phase → **460 assets** to pick from
  (`committeePersona=security_compliance&force=anxiety&phase=validation`)
- Procurement + habit-breaking content → **26 assets** (`force=habit&committeePersona=procurement`) —
  thin, and that thinness is itself useful intel for the content team.

### 4.4 Content strategy — the quarterly gap review

**Use:** `GET /coverage/jtbd` or the `analyze_content_coverage` MCP tool.

One call answers "what should we create next?": which of the 18 jobs are under-covered, which
buying phases have holes (purchase: 1.58%), which committee personas we barely speak to
(`end_user`: 56 assets), and the per-job × per-phase grid showing exactly which combinations
have **zero** coverage. `generate_content_brief` turns those same gaps directly into suggested
formats and rationales — no separate analysis step needed. `analyze_corpus_gaps` complements
both with emergent topics that keep appearing in content but aren't formally tagged yet.

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
6. **Free-tier hosting may cold-start** — the first request after idle can take ~30–60s.
   Retry once before reporting an outage.
7. **Everything read-only unless your key says otherwise** — 403s on PATCH/POST-to-save are
   scope, not bugs.
8. **`gone`/`redirected` content is visible in different places than you'd expect.**
   `GET /artifacts` (browse) and `GET /coverage/jtbd` show it by default — browse is the
   deliberate escape hatch for inspecting retired content, and coverage is reporting on
   everything ever classified. `POST /artifacts/search`, `find_similar`, `random`, and every
   `recommend`/`build_journey` call exclude it — those are "what can I actually point someone
   at" paths. Retired rows keep their classification and embedding (nothing is deleted), so
   this is about visibility, not data loss. Filter `sourceStatus=live` on a browse call if you
   want parity with what search/recommend would return.

## 6. Reporting issues

Log: the exact request (URL + body), what you expected, what you got, and your key *name*
(never the key itself). Confidence scores and rationales are part of the product — "this
ranked #1 but shouldn't" is exactly the feedback we want.
