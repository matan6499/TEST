#!/bin/bash
# Every 5 minutes (cron): if the bot is down or disconnected twice in a row, push an alert
# to the owner's phone through ntfy. One alert per incident, and one when it recovers.
TOPIC="$(cat ~/claude-whatsapp-bot/.ntfy-topic)"
STATE_FILE=~/claude-whatsapp-bot/.watchdog-state
svc=$(systemctl is-active whatsapp-bot)
st=$(curl -s -m 10 http://127.0.0.1:7655/state | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status","?"))' 2>/dev/null || echo down)
[ "$svc" != active ] && st=down
prev=$(cat "$STATE_FILE" 2>/dev/null || echo ok)
send(){ curl -s -m 15 -H "Title: $1" -H "Priority: $2" -H "Tags: $3" -d "$4" "https://ntfy.sh/$TOPIC" >/dev/null; }
if [ "$st" = connected ]; then
  [ "$prev" = alerted ] && send 'העוזר חזר לעבוד' default white_check_mark 'הבוט מחובר שוב ל-WhatsApp.'
  echo ok > "$STATE_FILE"; exit 0
fi
case "$prev" in
  ok) echo suspect > "$STATE_FILE" ;;
  suspect)
    if [ "$st" = qr ]; then msg='WhatsApp ניתק את הבוט וצריך לסרוק QR מחדש. תפתח את Claude Code ותבקש לחבר מחדש.'
    else msg="הבוט לא מחובר כבר 10 דקות (מצב: $st). השירות מנסה לחזור לבד; אם זה נמשך, תפתח את Claude Code."; fi
    send 'העוזר לא עונה' high warning "$msg"; echo alerted > "$STATE_FILE" ;;
esac
