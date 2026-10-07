# Handoff: @matanthejew

## Status (7.10)
- Carousel "ההקפה השביעית": text in `carousel-7-10/slides3.json`, caption in `carousel-7-10/caption3.txt`.
- Black-background version ready: `carousel-7-10/hakafot/slide-1..9.png`.
- Render with photos: put `photos/1.jpg`..`9.jpg` in `carousel-7-10/`, then
  `cd carousel-7-10 && NODE_PATH=$(npm root -g) node render3.js`
  (each photo becomes a dark grayscale background automatically).
- Photo picks per slide (dark, symbolic, never fake documentation of 7.10):
  1 torah scroll, 2 empty chairs, 3 broken window, 4 family table, 5 foggy road with headlights,
  6 lone car at night, 7 flag over the Jerusalem walls, 8 father and daughter, 9 candles.
  Pexels/Unsplash IDs are listed in the commit history and in the prompt of the session that tried to download them.

## Still open
1. Higgsfield: connect the CORRECT account (the one connected before was the wrong account).
   Locally: `npm i -g @higgsfield/cli && higgsfield auth login && npx skills add higgsfield-ai/skills`
2. Check in Zernio whether @matanthejew is connected, and the follower count.
3. Daily reels automation, built on the pnima engine (`~/.claude/skills/judaism-carousels`, `scripts/reel.py`,
   `scripts/schedule.py`, `scripts/calendar.py`, `~/.claude/agents/nachshon.md`). Do not change the pnima engine.
   Make a separate copy of schedule.py, locked to matanthejew.

## User rules
- Hebrew. No em dashes, ever.
- Questions go through the question UI.
- Don't be a yes man. Correct the user when he's wrong.
- Don't attribute experiences to him that he didn't describe. Known fact: on 7.10 he was at home.
