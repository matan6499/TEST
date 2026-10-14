# סוכן תמלול (Claude Code מקומי)

## התקנה (פעם אחת)
1. Python 3.10 ומעלה.
2. ffmpeg:
   - Mac: `brew install ffmpeg`
   - Windows: `winget install ffmpeg`
3. בתוך התיקייה הזאת:
   ```
   pip install -r requirements.txt
   ```

בהרצה הראשונה המודל יורד אוטומטית (כ-1.6GB לעברית), ומשם הוא נשמר במחשב.

## שימוש
```
cd transcriber
claude
```
ואז פשוט להדביק לינק (יוטיוב / טיקטוק / רילס / שורטס) או לגרור קובץ וידאו.
התוצאה נשמרת ב-`output/<שם הסרטון>/transcript.md`.

הכל רץ אצלך במחשב, חינמי, בלי API בתשלום.
