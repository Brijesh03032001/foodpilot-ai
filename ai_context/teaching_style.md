---
name: teaching-style
description: How to explain LangChain/LangGraph concepts to this user — they are a beginner and my first attempt was too dense
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ee0a5006-3229-4073-a01c-ea8a7726404f
  modified: 2026-08-08T11:01:34.612Z
---

User is learning LangChain/LangGraph from scratch via the FoodPilot project (see [[progress-log-pointer]]). My first Phase 1 explanation was rejected as "so so bad" — too dense, too many concepts introduced back-to-back, too much jargon assumed.

**Why:** user needs true beginner pacing — one idea at a time, in plain English, tied to a concrete story/example, not a reference-doc style wall of concepts.

**How to apply, every explanation going forward:**
- Start with a real-world analogy in one or two sentences before any technical term.
- Walk through ONE real example end-to-end as a numbered story ("you type X → this happens → then this → you see Y"), using actual data from the project, not abstract placeholders.
- Introduce jargon only right when it's needed, and define it in the same breath with a plain-English restatement — never assume a term lands on its own.
- Keep paragraphs short. Prefer a short list of "parts used" (name → one-line plain meaning → where it lives in the actual code) over long prose.
- Do not pile multiple new concepts into one paragraph. One concept, confirm it's simple, then move to the next.
- Auto-clarity applies here: even under caveman mode, when the user asks for explanation/clarification, write in full normal prose, not compressed fragments.
