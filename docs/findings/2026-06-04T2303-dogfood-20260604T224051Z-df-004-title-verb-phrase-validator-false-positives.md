---
title: Title verb-phrase validator false-positives on legitimate verbs ("accepts" not in whitelist)
created_at: 2026-06-04T23:03:54Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# Title verb-phrase validator false-positives on legitimate verbs ("accepts" not in whitelist)

**TL;DR.** A hardcoded English verb whitelist degrades valid specs and is a correctness risk against the Korean-first / language-aware principle. Replace the closed verb set with a more permissive heuristic (or at minimum expand it — `accept` is an obvious gap), and make the error message/details name the offending word and list/hint accepted forms so the agent can recover without a misleading mental model. Keep `--force` as the escape hatch but ensure the validation does not block legitimate verb phrases in the first place.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: QANS.
Root-cause area: `apps/api/src/application/verb-phrases.ts (VERB_PHRASE_STARTS whitelist + titleLooksLikeEnglishVerbPhrase)`. Routing: codex.

## Evidence

Commands 12-15: `vspec usecase create --title "Partner accepts a shared-budget invitation"` returned `"code": "TITLE_NOT_VERB_PHRASE", "message": "Use case title should be a verb phrase"` (digest lines 102, 465-466). The agent had to retry with `--force` (command 15) and narrated (line 134) it believed the validator only accepts a leading subject like "User". Actual root cause confirmed in apps/api/src/application/verb-phrases.ts: VERB_PHRASE_STARTS checks words[0]/words[1] against a curated English set that contains `approve`/`archive` but NOT `accept`, so the genuine verb phrase 'Partner accepts ...' is rejected. The failed create also returned an error envelope with data=null, which crashed the agent's success-path parse: `TypeError: 'NoneType' object is not subscriptable` (digest line 116/448).

## Recommendation

A hardcoded English verb whitelist degrades valid specs and is a correctness risk against the Korean-first / language-aware principle. Replace the closed verb set with a more permissive heuristic (or at minimum expand it — `accept` is an obvious gap), and make the error message/details name the offending word and list/hint accepted forms so the agent can recover without a misleading mental model. Keep `--force` as the escape hatch but ensure the validation does not block legitimate verb phrases in the first place.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

The English verb heuristic now accepts the dogfood anchor
`Partner accepts a shared-budget invitation` and a corpus of common finite verbs
that were absent from the old closed set. Rejections also include
`offending_word` so agents can see which title word failed validation.
