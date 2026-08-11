---
name: venv-naming
description: "User's preferred virtualenv name for the FoodPilot project"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ee0a5006-3229-4073-a01c-ea8a7726404f
  modified: 2026-08-08T10:41:43.232Z
---

Name the project virtualenv `cuisine`, not `.venv` or `venv`.

**Why:** user explicitly rejected a `.venv` creation and corrected it to `cuisine` — no stated reason beyond preference.

**How to apply:** any `python3 -m venv ...` or venv-activation command in this project (`foodtruck-cuisine`) should use `cuisine` as the directory name. Activate with `source cuisine/bin/activate`.
