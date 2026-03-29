# Agent 5 — Server Diagnostics: FT Bot Won't Start

## CONTEXT

Server: 204.168.187.107 (SSH as root)
FreqTrade: 2026.2, Docker image `freqtradeorg/freqtrade:stable_freqai`
Container: `freqtrade`, port 127.0.0.1:8080
Config: dry_run: true, trading_mode: futures, margin_mode: isolated, exchange: binance

The default FreqTrade bot on the server won't start (or the user thinks it won't start).

---

## DIAGNOSTIC STEPS

### Step 1: Check container status
```bash
ssh root@204.168.187.107 "docker ps -a --filter name=freqtrade"
```
- Is the container running, exited, or restarting?
- Check the STATUS column for uptime or exit codes

### Step 2: Check container logs
```bash
ssh root@204.168.187.107 "docker logs freqtrade --tail 100"
```
- Look for: startup errors, config parsing errors, exchange connection errors
- Common issues: invalid config.json, missing strategy file, API key errors

### Step 3: Check FreqTrade log file
```bash
ssh root@204.168.187.107 "tail -200 /opt/freqtrade/user_data/logs/freqtrade.log"
```

### Step 4: Validate config
```bash
ssh root@204.168.187.107 "docker exec freqtrade freqtrade show-config --config /freqtrade/user_data/config.json 2>&1 | head -50"
```
If container isn't running:
```bash
ssh root@204.168.187.107 "cat /opt/freqtrade/user_data/config.json | python3 -m json.tool"
```

### Step 5: Check strategy exists
```bash
ssh root@204.168.187.107 "ls -la /opt/freqtrade/user_data/strategies/"
```
- Does `SampleStrategy.py` exist? (that's what docker-compose.yml references)
- Are there Python syntax errors in the strategy?

### Step 6: Check docker-compose
```bash
ssh root@204.168.187.107 "cat /opt/freqtrade/docker-compose.yml"
```
- Verify the command, volumes, ports are correct

### Step 7: Try manual start
```bash
ssh root@204.168.187.107 "cd /opt/freqtrade && docker compose down && docker compose up -d && sleep 5 && docker logs freqtrade --tail 30"
```

### Step 8: Check if port 8080 is responding
```bash
ssh root@204.168.187.107 "curl -s http://127.0.0.1:8080/api/v1/ping"
```
Expected: `{"status":"pong"}`

### Step 9: Check orchestrator status
```bash
ssh root@204.168.187.107 "cd /opt/freqtrade-ui && docker compose ps"
```
- Are postgres, redis, orchestrator all running?
- Check orchestrator logs: `docker compose logs orchestrator --tail 50`

---

## COMMON FIX PATTERNS

### Config JSON error
```bash
# Validate JSON syntax
ssh root@204.168.187.107 "python3 -c \"import json; json.load(open('/opt/freqtrade/user_data/config.json'))\""
```

### Strategy not found
```bash
# List available strategies
ssh root@204.168.187.107 "docker exec freqtrade freqtrade list-strategies --strategy-path /freqtrade/user_data/strategies 2>&1"
```

### Exchange connection issues
```bash
# Test exchange connectivity
ssh root@204.168.187.107 "docker exec freqtrade freqtrade test-pairlist --config /freqtrade/user_data/config.json 2>&1 | head -20"
```

### Container keeps restarting
```bash
# Check restart count and exit code
ssh root@204.168.187.107 "docker inspect freqtrade --format='{{.RestartCount}} restarts, last exit: {{.State.ExitCode}}'"
```

---

## EXPECTED OUTCOME

1. Identify WHY the bot won't start
2. Fix the issue
3. Verify bot is running: `curl http://127.0.0.1:8080/api/v1/ping` returns `pong`
4. Verify from UI: orchestrator can communicate with bot via `/api/bots/1/status`
