# Everpure Team Guide (docs mirror)

This repo exists for one reason: to give a Claude Code (web) session something to attach to so
it can keep the **Everpure Artifact Intelligence — Team Guide** claude.ai artifact
([link](https://claude.ai/code/artifact/c79ddad2-dd9f-4371-abb5-42df155c0347)) in sync with the
real product.

- **Source of truth for the product itself** is the main repo:
  [everpure-artifact-intelligence](https://github.com/brandonjspencer/everpure-artifact-intelligence)
  (`docs/team-guide.md`, `docs/jtbd-catalog.md`).
- [team-guide.md](./team-guide.md) and [jtbd-catalog.md](./jtbd-catalog.md) here are copies of
  those same files, kept in sync by hand whenever the main repo's copies change.
- When the guide needs refreshing, open a Claude Code session with this repo attached, point it
  at the artifact above, and ask it to update the artifact from `team-guide.md`.

No application code, secrets, or infrastructure lives here — just the two docs.
