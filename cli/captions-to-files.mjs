#!/usr/bin/env node
// Turn caption events into TXT, SRT and VTT without calling the network.
//
//   node cli/captions-to-files.mjs <events.json> [--txt out.txt] [--srt out.srt] [--vtt out.vtt] [--check]
//
// Input is a JSON array of caption events:
//
//   [{ "start": <ms>, "duration": <ms>, "text": "..." }, ...]
//
// `startMs` and `durationMs` are accepted as aliases of `start` and `duration`.
// A missing, non-finite, or non-positive duration is written as 3,000 ms.
// Events with empty text, or a start that is not a finite number >= 0, are dropped.
// Overlapping cues are kept: the end is always start plus duration.
//
// A YouTube json3 document is also accepted, either `{ "events": [ ... ] }` or an
// array of those events. Each event uses `tStartMs`, `dDurationMs` and `segs`
// (`segs[].utf8`). That is the shape the transcript API parses before the
// download page writes a file. The browser download script itself does not parse
// json3; it receives segments that already have start, duration and text.
// An event that has a `segs` array is read as json3. Newlines inside a json3
// cue become spaces, matching that parser.
//
// TXT is the kept cue texts joined by a blank line, with no timestamps.
// SRT numbers cues from 1, uses a comma before the milliseconds, and ends with a
// newline. VTT starts with a WEBVTT line and uses a period before the milliseconds.
//
// `--check` asserts that an event with start 80 ms and duration 3,760 ms becomes
// the SRT cue "00:00:00,080 --> 00:00:03,840". It exits non-zero when that cue
// is missing or different. `--check` does not write files unless you also pass
// `--txt`, `--srt` or `--vtt`.
//
// With none of those output flags (and without relying on `--check`), the three
// files are written next to the input, using its basename.
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

function time(ms, separator = ',') {
  const n = Math.max(0, Math.floor(ms));
  return String(Math.floor(n / 3600000)).padStart(2, '0') + ':' + String(Math.floor(n / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(n / 1000) % 60).padStart(2, '0') + separator + String(n % 1000).padStart(3, '0');
}

function fromCaptionEvent(event) {
  if (!event || typeof event.text !== 'string' || !event.text.trim()) return null;
  const startMs = Number.isFinite(event.start) ? event.start : Number.isFinite(event.startMs) ? event.startMs : Number.NaN;
  if (!Number.isFinite(startMs) || startMs < 0) return null;
  const rawDuration = Number.isFinite(event.duration) ? event.duration : Number.isFinite(event.durationMs) ? event.durationMs : Number.NaN;
  const durationMs = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 3000;
  return { text: event.text, startMs, durationMs };
}

function fromJson3Event(event) {
  if (!event || !Array.isArray(event.segs)) return null;
  const text = event.segs
    .map((part) => (part && part.utf8) || '')
    .join('')
    .replace(/\n/g, ' ')
    .trim();
  if (!text || text === '\n') return null;
  const startMs = Number(event.tStartMs || 0);
  const rawDuration = Number(event.dDurationMs || 3000);
  if (!Number.isFinite(startMs) || startMs < 0) return null;
  const durationMs = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 3000;
  return { text, startMs, durationMs };
}

function toSegment(event) {
  if (event && Array.isArray(event.segs)) return fromJson3Event(event);
  return fromCaptionEvent(event);
}

function loadSegments(data) {
  const events = Array.isArray(data) ? data : data && Array.isArray(data.events) ? data.events : null;
  if (!events) {
    throw new Error('Expected a JSON array of { start, duration, text }, or a YouTube json3 object with events.');
  }
  return events.map(toSegment).filter(Boolean);
}

function toTxt(segments) {
  return segments.map((segment) => segment.text).join('\n\n').trim();
}

function toSrt(segments) {
  return segments.map((segment, index) => `${index + 1}\n${time(segment.startMs, ',')} --> ${time(segment.startMs + segment.durationMs, ',')}\n${segment.text}`).join('\n\n') + '\n';
}

function toVtt(segments) {
  return 'WEBVTT\n\n' + segments.map((segment) => `${time(segment.startMs, '.')} --> ${time(segment.startMs + segment.durationMs, '.')}\n${segment.text}`).join('\n\n') + '\n';
}

const WORKED_EXAMPLE = '00:00:00,080 --> 00:00:03,840';

function assertWorkedExample(segments) {
  const match = segments.find((segment) => segment.startMs === 80 && segment.durationMs === 3760);
  if (!match) {
    console.error('check failed: no caption event with start 80 ms and duration 3760 ms');
    process.exit(1);
  }
  const cue = `${time(match.startMs, ',')} --> ${time(match.startMs + match.durationMs, ',')}`;
  const srt = toSrt(segments);
  if (cue !== WORKED_EXAMPLE || !srt.includes(WORKED_EXAMPLE)) {
    console.error(`check failed: expected ${WORKED_EXAMPLE} but built ${cue}`);
    process.exit(1);
  }
  console.log(`check ok: ${WORKED_EXAMPLE}`);
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => !arg.startsWith('--'));
  if (!input) {
    console.error('usage: node cli/captions-to-files.mjs <events.json> [--txt file] [--srt file] [--vtt file] [--check]');
    process.exit(2);
  }
  const flagValue = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
  };
  const data = JSON.parse(await readFile(input, 'utf8'));
  const segments = loadSegments(data);
  if (!segments.length) {
    console.error('no caption events to write');
    process.exit(1);
  }
  if (args.includes('--check')) assertWorkedExample(segments);

  const stem = join(dirname(input), basename(input).replace(/\.json$/i, ''));
  const outputs = [
    ['--txt', toTxt(segments), `${stem}.txt`],
    ['--srt', toSrt(segments), `${stem}.srt`],
    ['--vtt', toVtt(segments), `${stem}.vtt`],
  ];
  const requested = outputs.filter(([flag]) => args.includes(flag));
  const writing = requested.length ? requested : args.includes('--check') ? [] : outputs;
  for (const [flag, text, fallback] of writing) {
    const path = flagValue(flag) || fallback;
    if (!path || path.startsWith('--')) {
      console.error(`missing path for ${flag}`);
      process.exit(2);
    }
    await writeFile(path, text, 'utf8');
    console.error(`wrote ${path}`);
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
