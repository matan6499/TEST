#!/bin/bash
# Nightly copy of the WhatsApp bot's data from the server (lists, reminders, memory,
# recordings, WhatsApp session). Keeps the last 14 days. Run by launchd.
set -u
DIR="$HOME/Backups/assistant-bot"
OUT="$DIR/$(date +%Y-%m-%d).tgz"
if ssh -o ConnectTimeout=20 -o BatchMode=yes assistant 'tar czf - --exclude="accounts/*/media/*" --exclude="*.log" -C ~/claude-whatsapp-bot accounts' > "$OUT.part" && [ -s "$OUT.part" ]; then
  mv "$OUT.part" "$OUT"
  echo "$(date) ok $(du -h "$OUT" | cut -f1)" >> "$DIR/backup.log"
else
  rm -f "$OUT.part"
  echo "$(date) FAILED" >> "$DIR/backup.log"
fi
ls -1t "$DIR"/*.tgz 2>/dev/null | tail -n +15 | xargs -I{} rm -f {}
