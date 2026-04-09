#!/usr/bin/env python3
"""Launch paper bots for all strategies not yet running."""
import requests, time, os, json

API = "http://localhost:80/api"

# Login
r = requests.post(f"{API}/auth/login", json={"username":"novakus","password":"Freqtrade2026"})
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Get existing bots
bots = requests.get(f"{API}/bots/", headers=headers).json()
existing = {b["strategy_name"] for b in bots}
print(f"Already have {len(existing)} bots registered")

# All strategies on disk
strat_dir = "/opt/freqtrade/user_data/strategies"
all_strats = [f.replace(".py","") for f in os.listdir(strat_dir) if f.endswith(".py")]
skip = {"DoesNothingStrategy", "Freqtrade_backtest_validation_freqtrade1", "__init__"}
to_launch = sorted([s for s in all_strats if s not in existing and s not in skip])
print(f"Need to launch {len(to_launch)} new bots\n")

ok_count = 0
fail_list = []

for strat in to_launch:
    payload = {
        "strategy_name": strat,
        "pair_whitelist": ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT"],
        "max_open_trades": 3,
        "stake_amount": "unlimited",
        "dry_run_wallet": 10000,
        "timeframe": "5m",
        "trading_mode": "spot"
    }
    try:
        r = requests.post(f"{API}/bots/launch-paper", headers=headers, json=payload, timeout=30)
        d = r.json()
        if r.status_code == 201:
            ok_count += 1
            print(f"  OK: {strat} -> {d.get('container_name')} port={d.get('port')}")
        else:
            fail_list.append((strat, d.get("detail","?")))
            print(f"  FAIL: {strat} -> {d.get('detail','?')}")
    except Exception as e:
        fail_list.append((strat, str(e)))
        print(f"  ERROR: {strat} -> {e}")
    time.sleep(2)

print(f"\n=== SUMMARY ===")
print(f"Launched OK: {ok_count}")
print(f"Failed: {len(fail_list)}")
for s, reason in fail_list:
    print(f"  FAIL: {s} -> {reason}")
