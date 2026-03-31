"""
Backfill experiment_runs by reading FT backtest result files directly from the filesystem.
Bypasses the FT API entirely — reads meta.json + unzips result files.
"""
import asyncio
import sys
import os
import json
import zipfile
import tempfile
import logging
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, "/app")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Path to FT backtest results (mounted from host)
BT_DIR = "/freqtrade_data/backtest_results"


async def main():
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from src.models.experiment import Experiment
    from src.models.experiment_run import ExperimentRun
    from src.models.strategy import Strategy
    from src.config import settings

    engine = create_async_engine(settings.database_url)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Check if we can access the directory
    bt_dir = Path(BT_DIR)
    if not bt_dir.exists():
        # Try alternative paths
        for alt in ["/backtest_results", "/data/backtest_results", "/freqtrade/user_data/backtest_results"]:
            if Path(alt).exists():
                bt_dir = Path(alt)
                break
        else:
            log.error(f"Cannot find backtest results directory. Tried: {BT_DIR}")
            log.info("Will use docker exec to read files...")
            await backfill_via_docker(engine, Session)
            return

    log.info(f"Reading from {bt_dir}")
    await backfill_from_dir(bt_dir, engine, Session)


async def backfill_via_docker(engine, Session):
    """Read files via subprocess docker exec calls."""
    import subprocess

    # List meta files
    result = subprocess.run(
        ["ls", "/freqtrade_data/backtest_results/"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        log.error("Cannot list files")
        log.info("Trying direct SQL insert from meta.json content...")
        await backfill_from_meta_strings(engine, Session)
        return

    log.info(f"Files: {result.stdout[:500]}")


async def backfill_from_meta_strings(engine, Session):
    """Last resort: parse meta.json contents passed via env or read from known location."""
    import subprocess

    # Read all meta.json files from the freqtrade container
    proc = subprocess.run(
        ["docker", "exec", "freqtrade", "bash", "-c",
         'for f in /freqtrade/user_data/backtest_results/*.meta.json; do echo "FILE:$f"; cat "$f"; echo; done'],
        capture_output=True, text=True
    )

    if proc.returncode != 0:
        log.error(f"docker exec failed: {proc.stderr}")
        return

    # Parse meta files to get strategy -> filename mappings
    entries = []
    current_file = None
    for line in proc.stdout.split("\n"):
        if line.startswith("FILE:"):
            current_file = line.replace("FILE:", "").strip()
        elif line.strip() and current_file:
            try:
                meta = json.loads(line.strip())
                zip_file = current_file.replace(".meta.json", ".zip")
                for strat_name in meta.keys():
                    entries.append({"filename": zip_file, "strategy": strat_name, "meta": meta[strat_name]})
            except json.JSONDecodeError:
                pass
            current_file = None

    log.info(f"Found {len(entries)} strategy results from meta files")

    if not entries:
        return

    # Now read each zip result
    async with Session() as db:
        sid_to_eid = {}
        for row in (await db.execute(
            select(Experiment.id, Experiment.strategy_id).where(Experiment.is_deleted == False)
        )).all():
            sid_to_eid[row[1]] = row[0]

        strats = {}
        for row in (await db.execute(
            select(Strategy.id, Strategy.name).where(Strategy.is_deleted == False)
        )).all():
            strats[row[1]] = row[0]

        log.info(f"DB: {len(strats)} strategies, {len(sid_to_eid)} experiments")

        created = 0
        skipped = 0

        for entry in entries:
            sn = entry["strategy"]
            fn = entry["filename"]

            sid = strats.get(sn)
            if not sid:
                skipped += 1
                continue
            eid = sid_to_eid.get(sid)
            if not eid:
                skipped += 1
                continue

            # Read zip content from freqtrade container
            zip_basename = os.path.basename(fn)
            proc2 = subprocess.run(
                ["docker", "exec", "freqtrade", "python3", "-c", f"""
import zipfile, json, sys
try:
    with zipfile.ZipFile('/freqtrade/user_data/backtest_results/{zip_basename}') as z:
        for name in z.namelist():
            if name.endswith('.json'):
                data = json.loads(z.read(name))
                strat = data.get('strategy', {{}})
                if '{sn}' in strat:
                    sd = strat['{sn}']
                    print(json.dumps(sd))
                    sys.exit(0)
                # Try top level
                if 'total_trades' in data:
                    print(json.dumps(data))
                    sys.exit(0)
    print('{{}}')
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"""],
                capture_output=True, text=True, timeout=30
            )

            if proc2.returncode != 0 or not proc2.stdout.strip():
                log.warning(f"  skip {zip_basename}/{sn}: read failed")
                skipped += 1
                continue

            try:
                sd = json.loads(proc2.stdout.strip())
            except json.JSONDecodeError:
                log.warning(f"  skip {zip_basename}/{sn}: bad JSON")
                skipped += 1
                continue

            if "error" in sd or "total_trades" not in sd:
                log.warning(f"  skip {zip_basename}/{sn}: {sd.get('error', 'no total_trades')}")
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

            # Parse date from filename
            try:
                ds = os.path.basename(fn).replace("backtest-result-", "").replace(".zip", "")
                rd = datetime.strptime(ds, "%Y-%m-%d_%H-%M-%S").replace(tzinfo=timezone.utc)
            except (ValueError, AttributeError):
                rd = datetime.now(timezone.utc)

            run = ExperimentRun(
                experiment_id=eid, run_type="backtest", status="completed",
                total_trades=tt,
                win_rate=Decimal(str(wr)) if wr is not None else None,
                profit_pct=Decimal(str(pp)) if pp is not None else None,
                profit_abs=Decimal(str(pta)) if pta is not None else None,
                max_drawdown=Decimal(str(mp)) if mp is not None else None,
                sharpe_ratio=Decimal(str(round(sh, 4))) if sh is not None else None,
                sortino_ratio=Decimal(str(round(so, 4))) if so is not None else None,
                calmar_ratio=Decimal(str(round(ca, 4))) if ca is not None else None,
                created_at=rd,
            )
            db.add(run)
            created += 1
            log.info(f"  + {sn}: {tt} trades, profit={pp}%, WR={wr}%, DD={mp}%, sharpe={sh}")

        if created:
            await db.commit()
        log.info(f"DONE: {created} runs created, {skipped} skipped")

    await engine.dispose()


async def backfill_from_dir(bt_dir, engine, Session):
    """Read directly from mounted directory."""
    pass  # Not used in container


if __name__ == "__main__":
    asyncio.run(main())
