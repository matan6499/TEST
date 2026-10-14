# סוכן תמלול

רץ בסשן ענן של Claude Code על הריפו הזה. בתחילת כל סשן ה-hook ב-`.claude/settings.json` מתקין אוטומטית את yt-dlp ואת faster-whisper. ffmpeg כבר מותקן בסביבה.

## דרישה חד פעמית: גישת רשת
בהגדרות הסביבה (Edit, ואז Network access) צריך לבחור Full, או לבחור Limited ולהוסיף תחת Allowed domains:
youtube.com, googlevideo.com, ytimg.com, tiktok.com, tiktokcdn.com, instagram.com, cdninstagram.com, huggingface.co, hf.co

## שימוש
פותחים סשן חדש ומדביקים לינק או מעלים קובץ. התוצאה נשמרת ב-`transcriber/output/<שם הסרטון>/transcript.md`.
