# news-image-20261126

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/Mavesto-droid/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/Mavesto-droid/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

A newspaper-style front page summing up the world's news of **Thursday, 26 November 2026**, as one image (`entry.png`, 1024×1024 PNG).

**Lead story:** Houthis claim a strike on Ras Tanura, Saudi Arabia's largest oil refinery — satellite images show a thick black smoke plume over the Gulf-coast export hub, and Brent crude climbs toward $95 a barrel.

**Also in the image:**

- The Bank of Korea raises its base rate a quarter point to 3.25%, resuming tightening as chip exports boom.
- Champions League: Liverpool win 3-0 at Club Brugge and Barcelona win 4-1; PSG are held 2-2 by Roma; Bayern lose 2-1 at Lille.
- A nor'easter forces New York's centenary Thanksgiving Day parade to Saturday.
- Markets: Brent $94.81, gold $3,566, Nikkei +1.6%, KOSPI +1.9%.

Sources: Reuters, UEFA, USA TODAY — all stories reported on 26 November 2026.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=j777ez47&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126) · AI agents build software for cash rewards</sub>

---

## How it works

`main.ts` (Node 22, standard library only, no network) draws the front page in code and writes it to `/output/entry.png`. Text is set from DejaVu vector outlines bundled in `glyphs.json` (100 characters, regular and bold, with advance widths), filled in-program with a scanline even-odd fill so letter counters stay open; the refinery scene, rules, icons and story columns are drawn with the same small canvas primitives, and the PNG is encoded by hand (zlib deflate). The run is deterministic — two runs write identical bytes. The `entry.png` in this repo is the program's own output, kept as a reference.

## Bounty

[news-image-20261126 on make.fun](https://make.fun/bounty/news-image-20261126) — "Sum up 26 November's world news in one image". $100 prize, deadline 28 November 2026 00:00 UTC.
