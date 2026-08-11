# ai_context — onboarding for any AI chat session

Snapshot copies of this project's cross-session memory, kept **in the repo** so
they travel with the code (the originals live in Claude's private auto-memory
outside the project). If you're an AI assistant picking up this project, read
this folder + `../memory.md` before doing anything.

## Files here
- `teaching_style.md` — how to explain things to this user (true beginner).
- `kid_section_convention.md` — end every phase chapter with an "Explanation to a little kid" section.
- `venv_naming.md` — the virtualenv is named `cuisine` (not `.venv`).
- `progress_log_pointer.md` — the real progress tracker is `../memory.md`.
- `MEMORY_index.md` — copy of the auto-memory index.

## Project state (as of Phase 9)
- **FoodPilot** — learning LangChain then LangGraph through a food-truck app.
- **Done:** Phases 1–9 (the entire LangChain half). **Next: Phase 10 — LangGraph.**
- Per-phase teaching: `../chapter/01…09_*.md` (each ends with a kid section).
- One-page LangChain summary: `../LANGCHAIN_LEARNINGS.md`.
- The two "walls" that motivate LangGraph: `../LOOP_LIMITATIONS.md` (Phase 5), `../LANGCHAIN_WALL.md` (Phase 9).
- Full progress log: `../memory.md`.

## Environment
- Run Python via `./cuisine/bin/python` (the shell's `python`/`pip` are Homebrew globals that bypass the venv).
- Vector/tool phases need Ollama: `ollama serve` (models: `bge-m3` embeddings, `qwen3:4b` tools). CreateAI (ASU) is a remote endpoint for structured extraction.
- REPL: `./cuisine/bin/python main.py` → `parse | recommend | tools | feedme | order | owner | report | quit`.

## How to teach this user (summary)
One concept at a time, plain English, real analogy first, then ONE worked
example end-to-end with real data, defining each term in the same breath. Short
paragraphs. End each phase's `chapter/NN_*.md` with an "Explanation to a little
kid" section. (Full detail in `teaching_style.md`.)

---

## Paste this into a new chat session to get it up to speed

> I'm a true beginner learning LangChain/LangGraph through this FoodPilot
> food-truck project. Before doing anything, read `ai_context/README.md`,
> `ai_context/teaching_style.md`, and `memory.md`. Phases 1–9 (all of LangChain)
> are done; I'm starting **Phase 10 (LangGraph)** next. Teach me one concept at a
> time in plain English with a real analogy and one worked example — no dense
> jargon walls — and end each phase's `chapter/NN_*.md` with an "Explanation to a
> little kid" section. Run Python with `./cuisine/bin/python` (venv is named
> `cuisine`), and `ollama serve` before vector/tool phases. Update `memory.md`
> after each phase. Start by summarizing where we are, then let's build Phase 10.
