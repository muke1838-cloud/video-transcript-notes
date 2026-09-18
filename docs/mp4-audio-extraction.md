# Getting audio out of a platform MP4 without ffmpeg

The speech model behind the transcript endpoint accepts a media file, not a raw
bitstream, and it rejects anything above roughly 2.9 MB. A platform MP4 is mostly
video, so the audio track has to be separated first. On a serverless runtime there is
no ffmpeg, so the separation has to be done with the container's own sample tables.

## The trap: ADTS wrapping looks right and decodes wrong

The first attempt read the audio track's sample table and wrapped each MP4 sample in an
ADTS header, which is the usual way to turn MP4 audio into something a decoder accepts.
The output was byte-count identical to what `ffmpeg -c:a copy` produces for the same
file, and it decoded without complaint.

The transcripts were still garbage: on a 32-second clip whose own caption track reads
"the answer has to do with what's inside", the model returned "Thank you very much."
repeated — the shape of a hallucination on input it cannot use.

The cause is in `stts`. On this MP4 the sample delta was **2048**, not 1024: every MP4
sample holds **two** AAC frames. Wrapping one sample per ADTS frame puts two frames
inside a header that promises one, so everything after the first frame is misaligned.

Diagnosis path used here, all local and repeatable:

```bash
ffprobe -show_entries stream=codec_name,sample_rate,channels,duration video.mp4
ffmpeg -i video.mp4 -vn -c:a copy ref.aac          # compare sizes with your own output
ffmpeg -i ref.aac -af volumedetect -f null -       # confirm the audio is not silence
```

`volumedetect` reported mean −22.3 dB and max −3.3 dB, which proved the source audio
was fine and the problem was on the extraction side, not the recording.

## The fix: rebuild an audio-only MP4

Instead of re-wrapping frames, rebuild a small MP4 that contains only the audio track:

1. Parse `moov`, find the `trak` whose `hdlr` handler is `soun`.
2. Keep its `stsd` (codec description), `tkhd`, `edts`, `hdlr`, `smhd`, `dinf`.
3. Rebuild `stts`/`stsc`/`stsz`/`stco` for the samples in the chunk, and write a new
   `mdat` with those sample bytes.
4. Write absolute file offsets into `stco` — they are offsets from the start of the
   file, not from the start of `mdat`. This needs two passes: build `moov` once to
   learn its size, then rebuild it with the real `mdat` data offset.
5. `mvhd` is a 100-byte version-0 payload: timescale sits at byte 12, duration at 16.
   Getting that off by one field still parses as "valid" to some tools and produces a
   file that decodes zero frames.

Result for the 32-second test clip: the source MP4 was 8,507,135 bytes, the rebuilt
audio-only MP4 was 132,707 bytes, and the transcript then matched the video's own
caption track word for word. For long audio, cut the sample list into pieces of about
45 seconds and send each piece as its own rebuilt MP4, offsetting the returned word
timings by the cumulative duration of the earlier pieces.

## Limits worth knowing before you build

Measured against the hosted model on 2026-09-18 (see
`data/workers-ai-whisper-input-limits-2026-09-18.csv`):

* A 2,900,000-byte payload was accepted; 2,953,029 bytes was rejected with
  `3006: Request is too large`.
* 70 seconds of audio was accepted; 80 seconds was rejected with
  `3010: Unsupported audio input`.

So chunk on duration first, with the byte ceiling as a secondary guard. Sending a
matched pair of tiny WAV files (a tone and silence) is a fast way to confirm the model
is reachable before you spend time debugging your container code.
