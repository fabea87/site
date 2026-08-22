# Teaching an AI to Revise Papers the Way I Do

After five full rounds of peer review — three at *Computer Assisted Language Learning* and two at *System* — I realized my revision habits had quietly become a method: the same four standards behind every edit, the same structure in every response letter, the same discipline about what *not* to change. So I wrote the method down as a `SKILL.md` file and installed it as a reusable skill for my AI assistant. Whenever a revision task starts, the assistant loads this file first.

This post introduces what the skill does, with excerpts, and the ideas behind it.

## The philosophy: calibrate, don't generalize

Most AI writing help is generic, because most prompts are generic. "Improve the academic tone" tells the model nothing about *your* academic tone. The core idea of the skill is **calibration**: its operational definitions are anchored to two of my own published papers — Yan and Gao (2025) in *Computer Assisted Language Learning* and Yan et al. (2026) in *System* — used as calibration samples, and its response-letter style is benchmarked against all five of my real review rounds.

> The goal is not "good academic English" in the abstract, but *the way this author writes*, already tested by peer review.

Two more beliefs shaped the design:

1. **Tacit knowledge does not scale.** What lives only in a researcher's intuition cannot be delegated, taught, or audited. Turning it into checklists makes it all three.
2. **Never let the model invent.** Every research question must be derivable from theory and prior evidence; every borrowed citation is verified against the literature before it enters the manuscript. When evidence is missing, the skill says so explicitly rather than guessing.

## The four standards

Every edit must satisfy four standards, each with an operational definition and a checklist. Adapted excerpts:

> **Academic English conventions** — formal register with systematic hedging; strict terminology management: define terms at first use, keep abbreviations consistent, operationalize core constructs before using them; explicit connectives; APA style throughout.

> **Logical soundness** — a macro "funnel" introduction that narrows step by step (background → construct → theoretical grounding → empirical evidence → gap → research questions); mirrored sections, so every RQ gets matching Results and Discussion subsections; and micro paragraph loops: topic sentence → evidence → interpretation, with explicit transitions between paragraphs.

> **Problem consciousness** — every RQ must be backed by theoretical grounding *and* empirical evidence, with an explicit gap statement ("no studies have yet examined…"). Questions without literature support are forbidden; if a reviewer proposes one, check the literature first — otherwise it goes to limitations and future directions.

> **Directness and clarity** — conclusion-first paragraphs, short subject–verb distance, statistics tucked into parentheses, parallel structures for contrasts, no redundancy and no rare words. (Reviewers once flagged *praxis-theory nexus* and *lacunae*; the checklist now bans such vocabulary outright.)

A few checklist items show how concrete this gets:

- Tense consistency: past tense for methods, present tense for universal claims
- No unsupported claims: conclusions must carry their evidence
- Every statistic reported with df / F / p and an effect size
- One edit may ripple across the paper — adding a discussion paragraph means re-checking whether the introduction sets it up

## Two working modes

**Mode 1 — reviewer-driven revision.** Read the whole manuscript first (never just the flagged passages), register every comment, and classify each one: substantive objection, supplementary suggestion, surface edit, or commentary. Then respond by strategy — accept, partially accept, or decline with reasons — and execute every edit under the four standards.

**Mode 2 — autonomous revision, review first.** Before touching the text, the assistant simulates peer review against the same standards, producing numbered comments that cite specific passages, split into Major and Minor:

> Run several sub-agents in parallel as simulated reviewers — one prioritizing theory, one methods, one language — to obtain a comment set closer to real review.

Only then does revision begin, answering simulated comments exactly as real ones would be answered.

## The response letter is a genre

Response letters have their own rhetoric, and the skill encodes mine: every reply opens with thanks; conclusions come before details; revised locations are named precisely (*Sections 4.1–4.2*, *Table 1*, *P. 8*); complex issues are organized as First / Second / Third. The most valuable pattern is the graceful refusal:

> Thank the reviewer and acknowledge the value of the suggestion → state concretely why it was not adopted (space limits, beyond the current scope, better suited to a follow-up study) → convert the concern into a limitation → thank again.

Refusals can even cite theory: one rejection was justified with Nicol and Macfarlane-Dick's feedback model to explain the intended role of GenAI in the design. Tone stays professional, respectful, and humble — but with a spine.

## Discipline

The skill ends where good craft always ends — with constraints:

> Make only the changes that are necessary; do not rewrite what the author did not ask to change. Never fabricate or alter data, statistics, or references. After editing, cross-check terminology, numbering, figures, citations, and numbers across the whole manuscript.

If you have your own revision habits — and after a few review cycles you will — consider writing them down. A method you can hand to a machine is a method you truly understand.