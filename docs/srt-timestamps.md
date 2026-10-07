# How a caption event becomes an SRT or VTT cue

The download page does not guess times from the soundtrack. Each caption event
arrives from the caption track with a start time and a duration, both in
milliseconds. The browser writes the start as `HH:MM:SS,mmm` and the end as
start plus duration.

The numbers below are the ones published on that page from the 2026-09-19
caption run. This note does not add any others.

## SRT and VTT

For a timed download the page does this:

- SRT cue numbers start at 1 and count up in file order.
- SRT times use a comma before the milliseconds, as in `00:00:00,080`.
- VTT uses a period before the milliseconds and the file starts with a `WEBVTT` line.
- Each cue is the stamp line, then the event text. Cues are separated by a blank line.
- The end stamp is `time(start + duration)` with the same separator as the start.

`time` takes the milliseconds, floors them, treats a negative value as zero,
and prints two-digit hours, minutes and seconds plus three millisecond digits.
Hours are the total and are not wrapped at 24.

Overlapping windows are written as they arrived. The page does not move an
end time back to the next start.

## When the duration is missing

The page says the end is start plus duration, or start plus 3,000 ms when the
duration is missing.

In the download script, a segment is kept only when its text is non-empty after
trimming and its start is a finite number of milliseconds greater than or equal
to zero. The duration stored for that segment is the event's duration when that
value is a finite number greater than zero, and 3,000 ms otherwise. The cue end
is then start plus that stored duration. A missing duration, zero, and a
non-positive value all take the 3,000 ms fallback on this path.

The paste-a-transcript path is separate. Pasted lines have no duration field.
For every pasted line except the last, the duration is the next line's start
minus this line's start, and a gap below 1 ms is written as 1 ms. The last
pasted line uses 3,000 ms.

## Worked example

On one track pulled through the site, the first event started at 80 ms and
lasted 3,760 ms. The SRT cue the page writes for it is:

```
00:00:00,080 --> 00:00:03,840
```

because 80 + 3,760 = 3,840 ms. The same event in VTT uses a period:

```
00:00:00.080 --> 00:00:03.840
```

## Overlap kept

On that same file, 8,614 of 8,721 cues overlapped the next cue: one cue ended
after the next one had started. That overlap stays in the download. The page
does not clean it up before saving.
