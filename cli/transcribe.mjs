#!/usr/bin/env node
// Pull a transcript for a YouTube, TikTok or Instagram link.
//
//   node cli/transcribe.mjs <link> [--txt out.txt] [--srt out.srt] [--vtt out.vtt] [--json]
//
// The CLI calls the public JSON endpoints of https://watchtotext.com/ so the numbers
// in ../data/ can be reproduced without reimplementing the pipeline.
import { writeFile } from 'node:fs/promises';

const BASE = process.env.TRANSCRIPT_BASE || 'https://watchtotext.com';

function pickEndpoint(link) {
  if (/youtube\.com|youtu\.be/i.test(link) || /^[\w-]{11}$/.test(link)) {
    return { path: '/api/transcript', param: 'v' };
  }
  if (/tiktok\.com/i.test(link) || /^\d{15,25}$/.test(link)) {
    return { path: '/api/tiktok', param: 'v' };
  }
  if (/instagram\.com/i.test(link) || /^[A-Za-z0-9_-]{6,20}$/.test(link)) {
    return { path: '/api/instagram', param: 'v' };
  }
  throw new Error('Unsupported link: pass a YouTube, TikTok or Instagram video URL.');
}

const pad = (n, w) => String(n).padStart(w, '0');
const stamp = (ms, comma) => {
  const t = Math.max(0, Math.floor(ms));
  return (
    `${pad(Math.floor(t / 3600000), 2)}:${pad(Math.floor((t % 3600000) / 60000), 2)}:` +
    `${pad(Math.floor((t % 60000) / 1000), 2)}${comma ? ',' : '.'}${pad(t % 1000, 3)}`
  );
};

function toSrt(segments) {
  return segments
    .map((s, i) => `${i + 1}\n${stamp(s.startMs, true)} --> ${stamp(s.startMs + (s.durationMs || 3000), true)}\n${s.text}\n`)
    .join('\n');
}

function toVtt(segments) {
  return 'WEBVTT\n\n' + segments
    .map((s) => `${stamp(s.startMs, false)} --> ${stamp(s.startMs + (s.durationMs || 3000), false)}\n${s.text}\n`)
    .join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const link = args.find((a) => !a.startsWith('--'));
  if (!link) {
    console.error('usage: node cli/transcribe.mjs <link> [--txt file] [--srt file] [--vtt file] [--json]');
    process.exit(2);
  }
  const flagValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  const { path, param } = pickEndpoint(link);
  const url = `${BASE}${path}?${param}=${encodeURIComponent(link)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    console.error(`failed: ${data.error}`);
    process.exit(1);
  }
  const segments = Array.isArray(data.segments) ? data.segments : [];
  if (args.includes('--json')) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const header = [data.author && `@${data.author}`, data.title, `source: ${data.source || 'caption'}`]
    .filter(Boolean)
    .join('\n');
  console.log(header ? `${header}\n` : '');
  console.log(data.plain || '');

  const txtOut = flagValue('--txt');
  if (txtOut) {
    await writeFile(txtOut, data.plain || '', 'utf8');
    console.error(`wrote ${txtOut}`);
  }
  const srtOut = flagValue('--srt');
  if (srtOut) {
    await writeFile(srtOut, toSrt(segments), 'utf8');
    console.error(`wrote ${srtOut}`);
  }
  const vttOut = flagValue('--vtt');
  if (vttOut) {
    await writeFile(vttOut, toVtt(segments), 'utf8');
    console.error(`wrote ${vttOut}`);
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
