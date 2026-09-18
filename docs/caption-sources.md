# Where the text can come from, per platform

Checked on 2026-09-18 against public posts. Each row says what a link can carry,
what a page can read without signing in, and what is left when there is no track.

## YouTube

A video can carry several caption tracks: a creator-uploaded one, an automatic one
built by speech recognition, or both. In the player response the uploaded track has
no `asr` kind and a plain language name, while the automatic track arrives with
`kind: asr` and a name ending in "auto-generated".

* Readable without signing in: yes, the caption list and the timed (WebVTT/JSON3) file.
* Prefer a human-uploaded track over the automatic one when both exist.
* When the caption list is empty the video is still playable — that case is not an error on YouTube's side.

Measured sample used while building the pipeline: one uploaded English track had 6
timed events and 222 characters, with no overlapping cue windows; one automatic
English track had 43 events, 11 of which were exactly `[Music]`, and consecutive
windows overlapped by design.

## TikTok

A video carries its captions in the item data: `video.subtitleInfos[]` (creator track)
and `video.claInfo.captionInfos[]` (the automatic one), each with a signed CDN URL that
serves WebVTT. Both fields can be empty.

* Readable without signing in: yes, the item data is served on the watch page; the
  media itself needs the session cookies from that same page or the CDN answers 403.
* When there is no track, `video.claInfo.noCaptionReason` carries a code. Values seen
  in this work: `1` and `3` on videos with no caption track at all.
* A caption-free TikTok is the common case, so a speech step is required, not optional.

## Instagram

The public embed view (`https://www.instagram.com/{reel|p|tv}/<shortcode>/embed/captioned/`)
served to a mobile user agent returns a `contextJSON` block with the post data:
`video_url`, `video_duration`, `owner`, `edge_media_to_caption` and
`accessibility_caption`. There is **no caption track field** in that payload, and the
normal web pages are a login wall that returns no post data at all.

* Readable without signing in: only the embed view, and only for posts Instagram
  chooses to serve (a removed, private or restricted post returns the same embed page
  with no post data — that is how the failures in `data/` were produced).
* The post caption is author-written text, not speech. Keep it out of the transcript.
* Speech recognition is the only route to the spoken words.

## What that means for a transcript tool

1. Try the platform's own caption track first: it is exact, instant, and free.
2. Fall back to speech recognition on the audio track, and say plainly which of the
   two produced the text.
3. Classify every failure in words a visitor can act on. Platform error pages and raw
   HTTP codes are not acceptable output.
