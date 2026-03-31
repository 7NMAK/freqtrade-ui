#!/usr/bin/env python3
"""
Backfill experiment_runs from FT backtest zip files.
Run on the HOST (not inside container): python3 backfill_host.py
Reads zip files from freqtrade container, then inserts via orchestrator API.
"""
import subprocess
import json
import sys
import os

ORCH_URL = "http://127.0.0.1:8888"
ORCH_USER = os.environ.get("ORCH_USER", "admin")
ORCH_PASS = os.environ.get("ORCH_PASS", "")

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
    return r.stdout.strip(), r.returncode

def main():
    # 1. Get orchestrator auth token
    import requests

    if not ORCH_PASS:
        print("ERROR: Set ORCH_PASS env var")
        sys.exit(1)

    r = requests.post(f"{ORCH_URL}/api/auth/login", json={"username": ORCH_USER, "password": ORCH_PASS})
    if r.status_code != 200:
        print(f"Auth failed: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    token = r.json()["access_token"]
    hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("Auth OK")

    # 2. Get experiments list
    r = requests.get(f"{ORCH_URL}/api/experiments/?limit=500", headers=hdr)
    resp_data = r.json()
    experiments = resp_data.get("items", resp_data.get("experiments", []))
    # Build name -> experiment_id map
    name_to_eid = {}
    for exp in experiments:
        sname = exp.get("strategy_name", "")
        if sname:
            name_to_eid[sname] = exp["id"]
    print(f"Experiments: {len(name_to_eid)} mapped")
    print(f"  Names: {list(name_to_eid.keys())[:10]}...")

    # 3. Read meta files from freqtrade container
    out, rc = run('docker exec freqtrade bash -c \'for f in /freqtrade/user_data/backtest_results/*.meta.json; do echo "FILE:$f"; cat "$f"; echo; done\'')
    if rc != 0:
        print(f"Cannot read meta files: rc={rc}")
        sys.exit(1)

    entries = []
    current_file = None
    for line in out.split("\n"):
        if line.startswith("FILE:"):
            current_file = line.replace("FILE:", "").strip()
        elif line.strip() and current_file:
            try:
                meta = json.loads(line.strip())
                zip_file = os.path.basename(current_file).replace(".meta.json", ".zip")
                for sn in meta.keys():
                    entries.append({"zip": zip_file, "strategy": sn})
            except json.JSONDecodeError:
                pass
            current_file = None

    print(f"Found {len(entries)} backtest entries")

    # 4. For each entry, extract metrics from zip and create experiment run
    created = 0
    skipped = 0

    for entry in entries:
        sn = entry["strategy"]
        zf = entry["zip"]

        eid = name_to_eid.get(sn)
        if not eid:
            skipped += 1
            continue

        # Read strategy data from zip
        extract_cmd = f"""docker exec freqtrade python3 -c "
import zipfile, json, sys
try:
    with zipfile.ZipFile('/freqtrade/user_data/backtest_results/{zf}') as z:
        for name in z.namelist():
            if name.endswith('.json'):
                data = json.loads(z.read(name))
                strat = data.get('strategy', {{}})
                if '{sn}' in strat:
                    print(json.dumps(strat['{sn}']))
                    sys.exit(0)
    print('null')
except Exception as e:
    print(json.dumps({{'error': str(e)}}))
"
"""
        stdout, rc = run(extract_cmd)
        if rc != 0 or not stdout or stdout == "null":
            skipped += 1
            continue

        try:
            sd = json.loads(stdout)
        except json.JSONDecodeError:
            skipped += 1
            continue

        if not sd or "error" in sd or "total_trades" not in sd:
            skipped += 1
            continue

        tt = int(sd.get("total_trades", 0))
        w = int(sd.get("wins", 0))
        ls = int(sd.get("losses", 0))
        dr = int(sd.get("draws", 0))
        tot = w + ls + dr
        wr = round(w / tot * 100, 2) if tot > 0 else None

        pt = sd.get("profit_total")
        pta = sd.get("profit_total_abs")
        mda = sd.get("max_drawdown_account")
        sh = sd.get("sharpe")
        so = sd.get("sortino")
        ca = sd.get("calmar")

        pp = round(pt * 100, 4) if pt is not None else None
        mp = round(mda * 100, 4) if mda is not None else None

        # Create experiment run via API
        payload = {
            "run_type": "backtest",
            "status": "completed",
            "total_trades": tt,
        }
        if wr is not None: payload["win_rate"] = wr
        if pp is not None: payload["profit_pct"] = pp
        if pta is not None: payload["profit_abs"] = pta
        if mp is not None: payload["max_drawdown"] = mp
        if sh is not None: payload["sharpe_ratio"] = round(sh, 4)
        if so is not None: payload["sortino_ratio"] = round(so, 4)
        if ca is not None: payload["calmar_ratio"] = round(ca, 4)

        r = requests.post(
            f"{ORCH_URL}/api/experiments/{eid}/runs",
            headers=hdr, json=payload
        )
        if r.status_code == 201:
            created += 1
            print(f"  + {sn}: {tt} trades, profit={pp}%, WR={wr}%, DD={mp}%, sharpe={sh}")
        else:
            print(f"  ! {sn}: API error {r.status_code}: {r.text[:100]}")
            skipped += 1

    print(f"\nDONE: {created} runs created, {skipped} skipped")


if __name__ == "__main__":
    main()
