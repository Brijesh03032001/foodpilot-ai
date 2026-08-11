---
name: progress-log-pointer
description: "Where FoodPilot's phase-by-phase build progress is tracked"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ee0a5006-3229-4073-a01c-ea8a7726404f
  modified: 2026-08-08T11:17:56.133Z
---

Project progress (what's built, decided, tested per phase) is tracked in `memory.md` at the repo root (`foodtruck-cuisine/memory.md`), not just in this memory system. User asked for it explicitly as a human-readable log.

Separately, `chapter/` at the repo root holds beginner teaching write-ups — numbered files (`01_langchain_basics_and_phase1_workflow.md`, etc.), one per concept area, written in the style described in [[teaching-style]] (plain English, real exact input/output traces, not simplified). User wants these kept as a personal reference to study from later.

**How to apply:** read `memory.md` at session start for current build state (which phases are done, active model config, key decisions like [[venv-naming]] and model choice). Update it after finishing each phase's milestone, keeping the same table/section structure already in the file. When a new concept gets explained from scratch in the teaching style, offer to add a new numbered file to `chapter/` capturing it, same as chapter 1.
