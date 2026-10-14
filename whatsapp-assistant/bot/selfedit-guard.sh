#!/bin/bash
# Runs 3 minutes after a self edit was applied. If the bot never confirmed it came back up,
# the change is rolled back to the previous version and the service restarts.
DIR=/home/ubuntu/claude-whatsapp-bot
STATE="$DIR/.selfedit.json"
phase=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("phase",""))' "$STATE" 2>/dev/null)
[ "$phase" = applied ] || exit 0
prev=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("prev",""))' "$STATE")
[ -n "$prev" ] || exit 0
cd "$DIR" || exit 1
git reset -q --hard "$prev"
python3 - "$STATE" <<'EOF'
import json, sys
p = sys.argv[1]; s = json.load(open(p)); s["phase"] = "rolledback"; s["status"] = "idle"
json.dump(s, open(p, "w"), ensure_ascii=False, indent=2)
EOF
sudo systemctl restart whatsapp-bot
