---
title: Teaching My Agent to Find Papers: Installing the paper-search MCP and Building a Skill
date: 2026-08-26 10:15:48
summary: How I installed the paper-search MCP with uv, worked around a proxy-induced 429 storm, and turned the hard-won know-how into a reusable agent skill.
tags: AI, agent, research, skills
---

# Teaching My Agent to Find Papers: Installing the paper-search MCP and Building a Skill

This week a reviewer asked for literature from the past five years to support a revision. Not one or two papers — enough to break a single-source citation habit and anchor every claim in independent 2024–2026 evidence. Searching manually across a dozen platforms would have taken an afternoon and produced a mess of tabs. So I went looking for a tool, found an academic search aggregator that ships as an MCP server, installed it with `uv`, and then did what I now do with any tool that works: taught my agent how to use it by writing a `SKILL.md`.

This post is the record of that process — the install, the walls I hit, and the skill that came out of it.

## Why an aggregator

Academic search APIs are scattered: Semantic Scholar, OpenAlex, PubMed, CORE, DOAJ, Crossref, arXiv, Europe PMC — each with its own URL scheme, rate limits, and metadata quirks. A query that works on one returns nothing on the next. What I wanted was a single CLI that fans a query out across many sources in parallel, merges and deduplicates the results, and returns clean JSON with title, authors, abstract, DOI, and citation counts.

The tool I found is `paper-search-mcp` — a Python package that aggregates **20+ academic platforms**. It installs two entry points: a `paper-search` CLI for interactive searches, and a `paper-search-mcp` MCP server so the same engine can be wired into any MCP-capable agent.

## Installing with uv

Installation was a single command:

```bash
uv tool install paper-search-mcp
```

`uv` dropped the binary into `~/.local/bin/paper-search` and kept the package in its content-addressable cache. That is the whole install story — but the interesting part, as always, is what happens after the command succeeds.

## Wall #1: the proxy eats the requests

The first search hung. Then it returned nothing. Then — once I watched the stderr — I understood: my Windows machine runs a system proxy at `127.0.0.1:8888`, and Python `requests` was dutifully routing every API call through it. The upstream academic APIs saw a flood of identical requests and answered with **429 rate-limit errors**.

The fix is one environment variable, now burned into the skill so it is never forgotten:

```bash
NO_PROXY='*' paper-search search "metacognition" -n 5 -s crossref
```

Every single invocation needs it. Not having it costs you silent empty results — the worst kind of failure, because it looks like the tool is broken.

## Wall #2: the slowest source sets the pace

The search command gathers from all requested sources **in parallel, and waits for the slowest one**. That design is invisible until you add the wrong source. `arxiv` over a direct mainland connection timed out at ~80 seconds and returned zero papers — dragging an otherwise five-second search into a two-minute wait for nothing.

The skill now carries a source table with measured behavior. The default combo — `core,doaj,semantic,openalex,pubmed,crossref` — completes in about 5.8 seconds with all six sources returning. Slow or unverified sources are explicitly listed as "don't put this in the default combo", and `arxiv` gets its own warning.

## Wall #3: Windows consoles and GBK

Two encoding/parsing traps bit me while scripting the output. First, piping JSON through `python -c` on a GBK console blew up with `UnicodeEncodeError` until I set `PYTHONIOENCODING=utf-8`. Second, the JSON schema is not fully uniform across sources — the `extra` field is a dict for some sources and a plain string for others — so a naive `.get()` on it crashes mid-parse and silently drops the remaining results. Both fixes are in the skill as a checklist item.

## API keys: one `.env` to rule them all

Most sources have free tiers that require an API key: Semantic Scholar, CORE, DOAJ, and — surprisingly — OpenAIRE. The package reads a single environment file:

```
~/.config/paper-search-mcp/.env
```

with `PAPER_SEARCH_MCP_`-prefixed keys (`PAPER_SEARCH_MCP_OPENAIRE_API_KEY`, etc.). Once I configured that file, the keys started working for the CLI *and* the MCP server without any code changes.

## Two sources that surprised me

**OpenAIRE** was listed in the skill as "unverified, probably needs a key". Today I tested it properly: with the key configured it returns rich metadata — open-access status, language, publisher — and the full seven-source combo (the six above plus `openaire`) finishes in about ten seconds with zero errors. It earned a promotion to the verified row of the skill's source table.

**Unpaywall** was the opposite kind of surprise. It is *not a search engine at all* — the official API only resolves a DOI to its open-access locations. Keyword searches against it return zero papers, always. But that makes it perfect for the narrow job no other source does well: after a search hits a paywalled paper, `paper-search search "<DOI>" -s unpaywall` hands you the free full-text link. The skill now flags it as "special: DOI-resolver only" so nobody wastes a round-trip on it.

## Writing the skill

The `SKILL.md` under `~/.pi/agent/skills/paper-search/` is the part my agent actually reads. It encodes all of the above as operational guidance:

> **All `paper-search` commands must be prefixed with `NO_PROXY='*'`** — the local system proxy causes upstream 429 rate limits; without it searches hang or return empty.

> **Source selection decides success** — search gathers in parallel and waits for the slowest source; default combo `core,doaj,semantic,openalex,pubmed,crossref` measured at ~5.8s; never add `arxiv` to the default combo; `openaire` verified usable with API key; `unpaywall` is DOI-resolution only.

> Use `PYTHONIOENCODING=utf-8` when piping output; the `extra` field may be a string on some sources — handle both.

The workflow section tells the agent how to behave in conversation: show results as a table of title / year / source / citations / DOI, let the user pick, download or read only the chosen papers, and report file paths instead of pasting full texts back into the chat.

## What it unlocked

The revision that started all this is now backed by roughly 44 candidate references gathered across two search rounds, with every DOI re-verified against Crossref before it entered the manuscript's reference list — exactly the discipline the revision skill demands. The five-year evidence base stopped being a promise and became a table.

The pattern here is the one I keep repeating with my agent: **find a tool that works, hit the walls, then write the walls down.** A skill is not a manual for the happy path — it is a map of the traps, so the next run through them is instant. Installing the tool took one command. Learning its traps took an afternoon. Writing them down took an hour. The agent will never spend that afternoon again.
