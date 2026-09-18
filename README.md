# video-transcript-notes

Field notes from building a transcript tool that reads YouTube, TikTok and Instagram
links: where the text can come from on each platform, what the speech model actually
accepts as input, and a small CLI that pulls a transcript for a link.

Everything in `data/` was measured against a live endpoint on 2026-09-18 and is
published as-is. Nothing here is estimated.

## What is inside

| Path | What it is |
| --- | --- |
| `data/tiktok-20-link-run-2026-09-18.csv` | 20 public TikTok links, the outcome for each, which source produced the text, and the failure message where there was one |
| `data/instagram-10-link-run-2026-09-18.csv` | 10 public Instagram links, same columns |
| `data/workers-ai-whisper-input-limits-2026-09-18.csv` | the input sizes and audio lengths the hosted Whisper endpoint accepted or rejected, with the exact error codes |
| `docs/caption-sources.md` | per platform: whether a readable caption track exists publicly, and what to do when it does not |
| `docs/mp4-audio-extraction.md` | the trap that made the first audio pipeline return boilerplate, and the container rebuild that fixed it |
| `cli/transcribe.mjs` | Node CLI: give it a link, get the transcript text back |

## Quick start

```bash
node cli/transcribe.mjs https://www.youtube.com/watch?v=dQw4w9WgXcQ
node cli/transcribe.mjs https://www.tiktok.com/@tiktokcreators/video/7630922277026090254
node cli/transcribe.mjs https://www.instagram.com/reel/C192Qr7IPVp/ --srt out.srt
```

The CLI calls the public JSON endpoints of the site these notes came from
(<https://watchtotext.com/>), which is the quickest way to reproduce the numbers in
`data/` without building the pipeline yourself. Node 18 or newer, no dependencies.

## Terms

MIT. The measurements are free to quote with a link back to this repository.
