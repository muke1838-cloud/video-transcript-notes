# video-transcript-notes

Field notes from building a transcript tool that reads YouTube, TikTok and Instagram
links: where the text can come from on each platform, what the speech model actually
accepts as input, a small CLI that pulls a transcript for a link, and another that
writes TXT, SRT and VTT from caption events already on disk.

The files in `data/` are published as measured. The TikTok, Instagram and Whisper
files were measured against a live endpoint on 2026-09-18. The YouTube file-size
file is the 2026-09-19 caption run published on the download page. Nothing here
is estimated.

## What is inside

| Path | What it is |
| --- | --- |
| `data/tiktok-20-link-run-2026-09-18.csv` | 20 public TikTok links, the outcome for each, which source produced the text, and the failure message where there was one |
| `data/instagram-10-link-run-2026-09-18.csv` | 10 public Instagram links, same columns |
| `data/workers-ai-whisper-input-limits-2026-09-18.csv` | the input sizes and audio lengths the hosted Whisper endpoint accepted or rejected, with the exact error codes |
| `docs/caption-sources.md` | per platform: whether a readable caption track exists publicly, and what to do when it does not |
| `docs/mp4-audio-extraction.md` | the trap that made the first audio pipeline return boilerplate, and the container rebuild that fixed it |
| `cli/transcribe.mjs` | Node CLI: give it a link, get the transcript text back |
| `data/youtube-transcript-file-sizes-2026-09-19.csv` | three YouTube caption files from the 2026-09-19 run: event counts, TXT and SRT byte and line counts, plus the first cue, last cue and overlap count where the download page published them |
| `docs/srt-timestamps.md` | how a caption event's start and duration become an SRT cue and a VTT cue, including the 3,000 ms fallback and the overlap the downloader keeps |
| `cli/captions-to-files.mjs` | Node CLI: local caption events in, TXT, SRT and VTT out, using the download page's timestamp rules. Sample input is `cli/sample-events.json` |

## Quick start

```bash
node cli/transcribe.mjs https://www.youtube.com/watch?v=dQw4w9WgXcQ
node cli/transcribe.mjs https://www.tiktok.com/@tiktokcreators/video/7630922277026090254
node cli/transcribe.mjs https://www.instagram.com/reel/C192Qr7IPVp/ --srt out.srt
node cli/captions-to-files.mjs cli/sample-events.json --check
```

`transcribe.mjs` calls the public JSON endpoints of the site these notes came from
(<https://watchtotext.com/>), which is the quickest way to reproduce the 2026-09-18
link runs in `data/` without building the pipeline yourself. Node 18 or newer, no
dependencies.

`captions-to-files.mjs` does not use the network. It reads a local JSON file of
caption events and writes TXT, SRT and VTT. Pass `--txt`, `--srt` or `--vtt` with
a path to choose the output file.

## Pages on the site

https://watchtotext.com/ takes a public YouTube, TikTok or Instagram video link and returns the available transcript, which you can copy or download as a text file.

https://watchtotext.com/youtube-transcript-download/ builds a TXT, SRT or VTT file in the browser from a YouTube caption track, and lists each caption language when the video has more than one.

https://watchtotext.com/tiktok-transcript/ is the TikTok entry point: paste a public TikTok video link to get the available transcript.

https://watchtotext.com/instagram-transcript/ is the Instagram entry point: paste a public Instagram reel or video link to get the available transcript.

https://watchtotext.com/how-to-get-a-transcript-of-a-youtube-video/ walks through getting a YouTube transcript step by step: paste the link, copy the text or save it as TXT or timed SRT, and what the status message means when a video has no usable captions.

## Terms

MIT. The measurements are free to quote with a link back to this repository.
