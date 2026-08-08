from app.chains import parse_chain, recommend
from app.agent import run_manual_tool_loop, run_feed_me


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


COMMANDS = {
    "parse": cmd_parse,
    "recommend": cmd_recommend,
    "tools": cmd_tools,
    "feedme": cmd_feedme,
}


def main() -> None:
    print("FoodPilot — commands: parse | recommend | tools | feedme | quit")
    while True:
        cmd = input("\nfoodpilot> ").strip().lower()
        if cmd in {"quit", "exit"}:
            break
        fn = COMMANDS.get(cmd)
        if fn:
            fn()
        else:
            print("Unknown. Try: parse | recommend | tools | feedme | quit")


if __name__ == "__main__":
    main()
