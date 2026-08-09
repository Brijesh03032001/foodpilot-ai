"""Phase 4 (manual tool loop, built by hand) and Phase 5 (prebuilt FEED ME
agent). Both use the tool-capable model from app.llm; CreateAI can't tool-call.
"""
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from app.llm import get_tool_model
from app.tools import PHASE4_TOOLS, PHASE5_TOOLS, PHASE7_TOOLS

# ===========================================================================
# PHASE 4 — the manual tool loop, written out by hand.
# The point is to see EXACTLY what a prebuilt agent automates: bind tools,
# invoke, inspect tool_calls, run each tool, feed a ToolMessage back, repeat
# until the model stops asking for tools.
# ===========================================================================
_PHASE4_SYSTEM = (
    "You are FoodPilot's food concierge. You have tools to search food "
    "trucks, read menus, check availability, locations, wait times and "
    "prices. Use them to answer the user's request with real data. Call "
    "tools step by step; when you have enough information, give a final "
    "answer naming specific trucks and items."
)

_phase4_tools_by_name = {t.name: t for t in PHASE4_TOOLS}
_phase4_model = get_tool_model().bind_tools(PHASE4_TOOLS)


def run_manual_tool_loop(user_text: str, max_steps: int = 6, verbose: bool = True):
    """Phase 4: the hand-written agent loop. Returns the full message list."""
    messages = [SystemMessage(_PHASE4_SYSTEM), HumanMessage(user_text)]

    for step in range(max_steps):
        ai = _phase4_model.invoke(messages)
        messages.append(ai)

        if not ai.tool_calls:
            # No tool requested -> the model is done; ai.content is the answer.
            if verbose:
                print(f"[step {step}] final answer (no tool calls)")
            break

        if verbose:
            called = [tc["name"] for tc in ai.tool_calls]
            print(f"[step {step}] model called tools: {called}")

        for tc in ai.tool_calls:
            tool = _phase4_tools_by_name.get(tc["name"])
            if tool is None:
                result = f"ERROR: unknown tool '{tc['name']}'"
            else:
                result = tool.invoke(tc["args"])
            # The ToolMessage carries the result back, tied to the exact
            # tool_call_id the model used to ask for it.
            messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))
    else:
        if verbose:
            print(f"[stopped] hit max_steps={max_steps}")

    return messages


# ===========================================================================
# PHASE 5 — the FEED ME agent. create_react_agent wraps the SAME kind of loop
# you just wrote by hand, but the model now decides tool order autonomously
# and it has two extra tools (rank_meals, build_order_draft).
# ===========================================================================
_FEED_ME_SYSTEM = (
    "You are FoodPilot's FEED ME agent. The user gives one vague, tired "
    "request. Do EVERYTHING autonomously: search trucks, read menus, check "
    "availability and wait times, rank the candidates against what they "
    "asked for, and finally build ONE order draft with build_order_draft. "
    "Respect every constraint they gave (protein, spice, budget, wait). End "
    "by presenting the order draft for their approval."
)

feed_me_agent = create_react_agent(
    get_tool_model(),
    PHASE5_TOOLS,
    prompt=_FEED_ME_SYSTEM,
)


def run_feed_me(user_text: str):
    """Phase 5: invoke the prebuilt agent. Returns the final message list.

    recursion_limit is raised because qwen3's thinking model takes several
    reason+act steps to complete the full search->menu->rank->draft chain.
    """
    result = feed_me_agent.invoke(
        {"messages": [HumanMessage(user_text)]},
        {"recursion_limit": 30},
    )
    return result["messages"]


# ===========================================================================
# PHASE 7 — the Owner Copilot. Same create_react_agent loop, but the tools are
# HETEROGENEOUS: sales_stats (structured SQL) + review_search (unstructured
# semantic search). The lesson: agent power comes from tool DIVERSITY, not a
# bigger model. Many owner questions need BOTH — numbers AND themes — in one
# answer, and the model decides which tool answers which part of the question.
# ===========================================================================
_OWNER_COPILOT_SYSTEM = (
    "You are FoodPilot's Owner Copilot, helping a food-truck owner understand "
    "their business. You have two kinds of tools:\n"
    "- sales_stats: exact NUMBERS from the orders database (revenue, order "
    "counts, top-selling items, sales by day). Use it for any 'how much / how "
    "many / which sells best / revenue over time' question.\n"
    "- review_search: customer REVIEW themes by meaning (complaints, praise, "
    "value, waits). Use it for any 'what are people saying / unhappy about / "
    "loving' question.\n"
    "Many owner questions need BOTH: pull the numbers AND the themes, then give "
    "ONE short answer that combines them. When the owner names a truck, pass it "
    "to both tools. Ground every claim in the tool results — cite the real "
    "numbers and paraphrase real reviews; never invent figures."
)

owner_copilot_agent = create_react_agent(
    get_tool_model(),
    PHASE7_TOOLS,
    prompt=_OWNER_COPILOT_SYSTEM,
)


def run_owner_copilot(user_text: str):
    """Phase 7: invoke the Owner Copilot. Returns the final message list.

    A good owner question forces at least one sales_stats call AND one
    review_search call in the same run, then a synthesized answer.
    """
    result = owner_copilot_agent.invoke(
        {"messages": [HumanMessage(user_text)]},
        {"recursion_limit": 30},
    )
    return result["messages"]
