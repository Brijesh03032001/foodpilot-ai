from app.analytics import generate_complaint_report
from app.chains import parse_and_resolve_order, parse_chain, recommend
from app.agent import run_manual_tool_loop, run_feed_me, run_owner_copilot


def cmd_parse() -> None:
    print("Phase 1: intent parser. Type a food request (blank to go back).")
    while True:
        text = input("parse> ").strip()
        if not text:
            return
        print(parse_chain.invoke({"text": text}).model_dump_json(indent=2), "\n")


def cmd_recommend() -> None:
    print("Phase 2: RAG recommend. Type a food request (blank to go back).")
    while True:
        text = input("recommend> ").strip()
        if not text:
            return
        _, docs, answer = recommend(text)
        print(f"[retrieved {len(docs)} items]\n{answer.content}\n")


def cmd_tools() -> None:
    print("Phase 4: manual tool loop. Type a request (blank to go back).")
    while True:
        text = input("tools> ").strip()
        if not text:
            return
        messages = run_manual_tool_loop(text)
        print(f"\n{messages[-1].content}\n")


def cmd_feedme() -> None:
    print("Phase 5: FEED ME agent. Type one vague request (blank to go back).")
    while True:
        text = input("FEED ME> ").strip()
        if not text:
            return
        messages = run_feed_me(text)
        print(f"\n{messages[-1].content}\n")


def cmd_order() -> None:
    print("Phase 6: order parser + modifier resolver. Type a full order, e.g.")
    print("  '3 Spam Musubi, remove onion from 2, add avocado to 1 if under $2'")
    print("(blank to go back).")
    while True:
        text = input("order> ").strip()
        if not text:
            return
        order, resolved = parse_and_resolve_order(text)
        print(f"\n[parsed] {order.quantity}x {order.item}")
        if resolved is None:
            print(f"  (couldn't match '{order.item}' to a real menu item)\n")
            continue
        for mod in resolved["modifications"]:
            for ch in mod["changes"]:
                mark = "OK" if ch.get("applied") else "no"
                head = f"  [{mark}] {ch['type']} {ch['ingredient']} (x{mod['quantity']})"
                if ch.get("applied"):
                    delta = ch.get("price_delta", 0.0)
                    print(f"{head}{f' +${delta:.2f}' if delta else ' (free)'}")
                else:
                    print(f"{head} — {ch.get('reason', '')}")
        base, add = resolved["base_price"], resolved["modifications_price_change"]
        total = base * order.quantity + add
        print(f"  ${base:.2f} x{order.quantity} + mods ${add:.2f} = ${total:.2f}\n")


def cmd_owner() -> None:
    print("Phase 7: Owner Copilot — asks the orders DB (SQL) + reviews together.")
    print("  e.g. 'How did Tokachi Musubi do recently and what upsets customers?'")
    print("(needs `ollama serve` running; qwen3 reasoning model is slow, ~1-3 min.)")
    print("(blank to go back).")
    while True:
        text = input("owner> ").strip()
        if not text:
            return
        print("...thinking...")
        messages = run_owner_copilot(text)
        print(f"\n{messages[-1].content}\n")


def cmd_report() -> None:
    print("Phase 8: complaint report — classifies ALL reviews via CreateAI, "
          "then aggregates (~90s). Working...")
    report = generate_complaint_report()
    print(f"\n{report['total_reviews']} reviews | sentiment {report['sentiment']} "
          f"| {report['negative_reviews']} negative "
          f"| {report['classify_failures']} failed\n")
    print("Top complaints (% of negative reviews):")
    for row in report["complaints"]:
        bar = "#" * int(row["pct_of_negatives"] / 3)
        print(f"  {row['topic']:10} {row['pct_of_negatives']:5}%  "
              f"({row['count']:>2})  {bar}")
    print()


COMMANDS = {
    "parse": cmd_parse,
    "recommend": cmd_recommend,
    "tools": cmd_tools,
    "feedme": cmd_feedme,
    "order": cmd_order,
    "owner": cmd_owner,
    "report": cmd_report,
}


def main() -> None:
    menu = "parse | recommend | tools | feedme | order | owner | report | quit"
    print(f"FoodPilot — commands: {menu}")
    while True:
        cmd = input("\nfoodpilot> ").strip().lower()
        if cmd in {"quit", "exit"}:
            break
        fn = COMMANDS.get(cmd)
        if fn:
            fn()
        else:
            print(f"Unknown. Try: {menu}")


if __name__ == "__main__":
    main()
