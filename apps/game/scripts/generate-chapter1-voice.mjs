// Chapter 1 voice generator (orchestrator). Design: .kiro/specs/chapter-01-voice-narrative/design.md,
// section 10. Local only: no network call and no new dependency. Windows only for synthesis.
//
// Usage (from d:\scam-maze):
//   pnpm --filter @scammaze/game voice:chapter1                    all missing or stale clips
//   pnpm --filter @scammaze/game voice:chapter1 -- --locale vi     one locale
//   pnpm --filter @scammaze/game voice:chapter1 -- --only a,b --force
//   pnpm --filter @scammaze/game voice:chapter1 -- --dry-run       list jobs, write nothing
//   pnpm --filter @scammaze/game voice:script                      print the spoken lines, write nothing
//   pnpm --filter @scammaze/game voice:report [-- --strict]        counts and missing clips
//
// Honesty rule: a clip is written as `present` only when its MP3 file exists, passed the checks
// below and was produced by this script in this run (or was verified again from a previous run
// that this script wrote). Anything else is written as `missing`.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(APP_ROOT, "src", "game", "voice", "chapter1.manifest.ts");
const CACHE_DIR = path.join(APP_ROOT, ".voice-cache");
const WORKER_PATH = path.join(APP_ROOT, "scripts", "generate-chapter1-voice.ps1");

const MAX_CLIP_BYTES = 150 * 1024;
const MIN_CLIP_MS = 500;
const MAX_CLIP_MS = 25_000;
const MAX_LOCALE_BYTES = 6 * 1024 * 1024;
const DURATION_TOLERANCE_MS = 120;
const CLIP_MIME = "audio/mpeg";
const LOCALES = ["en", "vi"];

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const options = {
    locale: null,
    only: null,
    force: false,
    dryRun: false,
    printScript: false,
    report: false,
    strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) fail(`Missing value for ${arg}.`);
      return value;
    };
    if (arg === "--") continue;
    else if (arg === "--locale") options.locale = next();
    else if (arg.startsWith("--locale=")) options.locale = arg.slice(9);
    else if (arg === "--only") options.only = next();
    else if (arg.startsWith("--only=")) options.only = arg.slice(7);
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--print-script") options.printScript = true;
    else if (arg === "--report") options.report = true;
    else if (arg === "--strict") options.strict = true;
    else fail(`Unknown argument: ${arg}`);
  }
  if (options.locale !== null && !LOCALES.includes(options.locale)) {
    fail(`--locale must be one of: ${LOCALES.join(", ")}.`);
  }
  options.onlyIds =
    options.only === null
      ? null
      : new Set(
          options.only
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        );
  return options;
}

function fail(message) {
  console.error(`[voice] ERROR: ${message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------
// MP3 check: frame sync, frame walk and duration (MPEG audio Layer III only)
// ---------------------------------------------------------------------------------------------
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function parseFrameHeader(buf, pos) {
  if (pos + 4 > buf.length) return null;
  if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) return null;
  const version = (buf[pos + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layer = (buf[pos + 1] >> 1) & 3; // 1 = Layer III
  if (version === 1 || layer !== 1) return null;
  const bitrateIndex = (buf[pos + 2] >> 4) & 15;
  const rateIndex = (buf[pos + 2] >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const padding = (buf[pos + 2] >> 1) & 1;
  const bitrate = (version === 3 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const samples = version === 3 ? 1152 : 576;
  const length = Math.floor(((version === 3 ? 144 : 72) * bitrate) / sampleRate) + padding;
  return { length, sampleRate, samples };
}

/** Returns `{ ok: true, durationMs, frames }` or `{ ok: false, error }`. */
export function analyzeMp3(buf) {
  if (buf.length === 0) return { ok: false, error: "MP3 file is empty." };
  let pos = 0;
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "ID3") {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    pos = 10 + size + ((buf[5] & 0x10) !== 0 ? 10 : 0);
  }
  // Find the first frame sync (allow a little padding after a tag).
  const limit = Math.min(buf.length, pos + 4096);
  while (pos < limit && parseFrameHeader(buf, pos) === null) pos++;
  if (parseFrameHeader(buf, pos) === null) return { ok: false, error: "No MPEG frame sync found." };

  let frames = 0;
  let samples = 0;
  let sampleRate = 0;
  for (;;) {
    const header = parseFrameHeader(buf, pos);
    if (header === null || pos + header.length > buf.length) break;
    const body = buf.toString("latin1", pos + 4, Math.min(pos + 44, pos + header.length));
    const isInfoFrame = body.includes("Xing") || body.includes("Info");
    if (!isInfoFrame) {
      frames++;
      samples += header.samples;
      sampleRate = header.sampleRate;
    }
    pos += header.length;
  }
  if (frames === 0) return { ok: false, error: "No audio frames found." };
  // Allow an ID3v1 tag (128 bytes) or a few stray bytes at the end; anything more means lost sync.
  if (buf.length - pos > 256) return { ok: false, error: `Lost frame sync at byte ${pos}.` };
  return { ok: true, frames, durationMs: Math.round((samples * 1000) / sampleRate) };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
function readManifest(parseManifestSource) {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return parseManifestSource(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    console.warn(`[voice] Warning: existing manifest could not be read (${error.message}). Treating all clips as new.`);
    return null;
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function castNote(job) {
  return `${job.voice}, rate ${job.rate}, pitch ${job.pitch}, tone ${job.tone}`;
}

function countBy(items, keyFn) {
  const result = {};
  for (const item of items) result[keyFn(item)] = (result[keyFn(item)] ?? 0) + 1;
  return result;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const readOnly = options.dryRun || options.printScript || options.report;

  const server = await createServer({
    root: APP_ROOT,
    appType: "custom",
    logLevel: "error",
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, watch: null },
  });

  try {
    const load = (file) => server.ssrLoadModule(file);
    const { CHAPTER_1_SCENARIO } = await load("/src/game/narrative/chapter1/scenario.ts");
    const { CHAPTER_1_NARRATIVE_VI } = await load("/src/i18n/narrative/chapter1.vi.ts");
    const { buildVoiceJobs, listUntranslatedSpokenLines, CHAPTER1_VOICE_CAST } = await load(
      "/src/game/voice/buildVoiceJobs.ts",
    );
    const { renderManifest, parseManifestSource } = await load("/src/game/voice/renderManifest.ts");
    const { buildVoiceReport } = await load("/src/game/voice/voiceReport.ts");
    const { fnv1a32 } = await load("/src/game/voice/hash.ts");
    const { CHAPTER1_VOICE_BASE } = await load("/src/config/assetPaths.ts");
    const { VOICE_MANIFEST_SCHEMA_VERSION } = await load("/src/game/voice/manifestTypes.ts");

    const overlays = { vi: CHAPTER_1_NARRATIVE_VI };
    const allJobs = buildVoiceJobs(CHAPTER_1_SCENARIO, overlays, CHAPTER1_VOICE_CAST);

    // One slot per Spoken_Node and locale. `job` is absent when the locale has no text.
    const slots = new Map();
    const slotKey = (clipId, locale) => `${clipId}|${locale}`;
    for (const job of allJobs) slots.set(slotKey(job.clipId, job.locale), { job });
    const untranslated = [];
    for (const locale of LOCALES) {
      for (const line of listUntranslatedSpokenLines(CHAPTER_1_SCENARIO, overlays, locale)) {
        const graph = CHAPTER_1_SCENARIO.dialogues[line.graphId];
        const node = graph.nodes[line.clipId];
        const speakerId = node.speakerId ?? graph.persona.speakerId;
        const info = { ...line, locale, speakerId, tone: node.tone };
        untranslated.push(info);
        slots.set(slotKey(line.clipId, locale), { untranslated: info });
      }
    }

    const inScope = (clipId, locale) =>
      (options.locale === null || options.locale === locale) &&
      (options.onlyIds === null || options.onlyIds.has(clipId));
    const scopedJobs = allJobs.filter((job) => inScope(job.clipId, job.locale));

    if (options.onlyIds !== null) {
      const known = new Set(allJobs.map((job) => job.clipId));
      for (const id of options.onlyIds) {
        if (!known.has(id)) fail(`--only: "${id}" is not a Spoken_Node with voice text.`);
      }
    }

    // ---- --print-script ---------------------------------------------------------------------
    if (options.printScript) {
      console.log(`Voice script: ${scopedJobs.length} line(s). Nothing is written.`);
      for (const job of scopedJobs) {
        console.log(
          `\n[${job.locale}] ${job.clipId}  (${job.speakerId}, ${job.tone}; ${job.voice}, rate ${job.rate}, pitch ${job.pitch})\n  ${job.text}`,
        );
      }
      const missingText = untranslated.filter((line) => inScope(line.clipId, line.locale));
      if (missingText.length > 0) {
        console.log(`\nNo text (no job): ${missingText.length}`);
        for (const line of missingText) console.log(`  [${line.locale}] ${line.clipId}`);
      }
      return 0;
    }

    const existing = readManifest(parseManifestSource);
    const existingByKey = new Map((existing?.clips ?? []).map((e) => [slotKey(e.clipId, e.locale), e]));

    /** Verifies a previously written file against its manifest entry. Returns true when still good. */
    const stillGood = (entry, job) => {
      if (entry === undefined || entry.status !== "present" || entry.origin !== "tts-generated") return false;
      if (entry.sourceTextHash !== job.textHash) return false; // text changed
      if (entry.voiceNote !== castNote(job)) return false; // cast, rate, pitch or tone changed
      const file = path.join(APP_ROOT, job.outMp3);
      if (!existsSync(file)) return false;
      const buf = readFileSync(file);
      if (buf.length === 0 || buf.length > MAX_CLIP_BYTES || buf.length !== entry.bytes) return false;
      return analyzeMp3(buf).ok;
    };

    // ---- decide which jobs run -------------------------------------------------------------
    const toRun = [];
    const fresh = new Set();
    for (const job of scopedJobs) {
      const entry = existingByKey.get(slotKey(job.clipId, job.locale));
      if (!options.force && stillGood(entry, job)) fresh.add(slotKey(job.clipId, job.locale));
      else toRun.push(job);
    }

    // ---- --dry-run ---------------------------------------------------------------------------
    if (options.dryRun) {
      console.log(`Dry run. Nothing is written and no speech is generated.`);
      console.log(
        `Jobs in scope: ${scopedJobs.length}. Up to date (skipped): ${fresh.size}. Jobs to run: ${toRun.length}.`,
      );
      console.log(`Jobs to run by locale: ${JSON.stringify(countBy(toRun, (job) => job.locale))}`);
      for (const job of toRun) {
        console.log(`  [${job.locale}] ${job.clipId}  ${job.voice}, rate ${job.rate}, pitch ${job.pitch} -> ${job.outMp3}`);
      }
      const missingText = untranslated.filter((line) => inScope(line.clipId, line.locale));
      if (missingText.length > 0) {
        console.log(`No text, no job (will be written as missing): ${missingText.length}`);
        for (const line of missingText) console.log(`  [${line.locale}] ${line.clipId}`);
      }
      return 0;
    }

    // ---- --report ----------------------------------------------------------------------------
    const lineTextFor = (entry) => {
      const slot = slots.get(slotKey(entry.clipId, entry.locale));
      return slot?.job?.text ?? "(no text for this locale)";
    };

    if (options.report) {
      let manifest = existing;
      if (manifest === null) {
        console.log("No manifest file yet: every clip is reported as missing.");
        manifest = {
          schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION,
          chapterId: "chapter-1",
          clips: [...slots.entries()].map(([, slot]) => missingEntry(slot, CHAPTER1_VOICE_CAST)),
        };
      }
      return printReport(buildVoiceReport(manifest, lineTextFor), options.strict);
    }

    // ---- generate ---------------------------------------------------------------------------
    const results = new Map();
    if (toRun.length > 0) {
      for (const result of runWorker(toRun)) results.set(slotKey(result.clipId, result.locale), result);
    }

    const failedReasons = new Map();
    const entries = [];
    for (const [key, slot] of slots) {
      if (slot.untranslated !== undefined) {
        entries.push(missingEntry(slot, CHAPTER1_VOICE_CAST));
        continue;
      }
      const job = slot.job;
      if (fresh.has(key)) {
        entries.push(existingByKey.get(key));
        continue;
      }
      if (toRun.includes(job)) {
        const outcome = verifyResult(job, results.get(key));
        if (outcome.entry) entries.push(outcome.entry);
        else {
          failedReasons.set(key, outcome.error);
          entries.push(missingEntry(slot, CHAPTER1_VOICE_CAST));
        }
        continue;
      }
      // Out of scope: keep a previous entry only when it still verifies against current text and cast.
      const previous = existingByKey.get(key);
      entries.push(stillGood(previous, job) ? previous : missingEntry(slot, CHAPTER1_VOICE_CAST));
    }

    const manifest = { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips: entries };
    mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    writeFileSync(MANIFEST_PATH, renderManifest(manifest), "utf8");
    console.log(`\nManifest written: ${toPosix(path.relative(APP_ROOT, MANIFEST_PATH))}`);

    const localeBytes = countBytesByLocale(entries);
    for (const [locale, total] of Object.entries(localeBytes)) {
      if (total > MAX_LOCALE_BYTES) console.warn(`[voice] Warning: "${locale}" clips total ${total} bytes (limit ${MAX_LOCALE_BYTES}).`);
    }
    if (failedReasons.size > 0) {
      console.log(`\nFailed jobs (${failedReasons.size}):`);
      for (const [key, reason] of failedReasons) console.log(`  ${key.replace("|", " [")}]  ${reason}`);
    }
    return printReport(buildVoiceReport(manifest, lineTextFor), options.strict);

    // ---- local functions that need the loaded modules --------------------------------------
    function missingEntry(slot, cast) {
      const job = slot.job;
      const info = slot.untranslated;
      const base = job
        ? { clipId: job.clipId, graphId: job.graphId, speakerId: job.speakerId, locale: job.locale, tone: job.tone }
        : { clipId: info.clipId, graphId: info.graphId, speakerId: info.speakerId, locale: info.locale, tone: info.tone };
      const voice = job
        ? castNote(job)
        : `${cast[base.speakerId].locales[base.locale].voice}; no ${base.locale} text yet; tone ${base.tone}`;
      return {
        clipId: base.clipId,
        nodeId: base.clipId,
        graphId: base.graphId,
        speakerId: base.speakerId,
        locale: base.locale,
        status: "missing",
        sources: [],
        tone: base.tone,
        voiceNote: voice,
        origin: "none",
        credit: "not provided",
        sourceTextHash: job ? job.textHash : fnv1a32(""),
      };
    }

    function verifyResult(job, result) {
      if (result === undefined) return { error: "The worker returned no result for this job." };
      if (!result.ok) return { error: result.error ?? "The worker reported a failure." };
      const file = path.join(APP_ROOT, job.outMp3);
      const reject = (error) => {
        rmSync(file, { force: true }); // never leave an unverified clip in public/
        return { error };
      };
      if (!existsSync(file)) return reject("The MP3 file does not exist.");
      const buf = readFileSync(file);
      if (buf.length === 0) return reject("The MP3 file is empty.");
      if (buf.length > MAX_CLIP_BYTES) return reject(`The MP3 is ${buf.length} bytes; the limit is ${MAX_CLIP_BYTES}.`);
      const mp3 = analyzeMp3(buf);
      if (!mp3.ok) return reject(mp3.error);
      if (typeof result.durationMs !== "number") return reject("The worker reported no WAV duration.");
      if (result.durationMs < MIN_CLIP_MS || result.durationMs > MAX_CLIP_MS) {
        return reject(`Duration ${result.durationMs} ms is outside ${MIN_CLIP_MS} to ${MAX_CLIP_MS} ms.`);
      }
      const diff = Math.abs(mp3.durationMs - result.durationMs);
      if (diff > DURATION_TOLERANCE_MS) {
        return reject(`MP3 duration ${mp3.durationMs} ms differs from WAV duration ${result.durationMs} ms by ${diff} ms.`);
      }
      return {
        entry: {
          clipId: job.clipId,
          nodeId: job.clipId,
          graphId: job.graphId,
          speakerId: job.speakerId,
          locale: job.locale,
          status: "present",
          sources: [{ src: `${CHAPTER1_VOICE_BASE}/${job.locale}/${job.clipId}.mp3`, type: CLIP_MIME }],
          durationMs: result.durationMs,
          bytes: buf.length,
          tone: job.tone,
          voiceNote: castNote(job),
          origin: "tts-generated",
          credit: `Generated locally with the Windows speech voice ${job.voice}`,
          sourceTextHash: job.textHash,
        },
      };
    }
  } finally {
    await server.close();
  }
}

function countBytesByLocale(entries) {
  const totals = {};
  for (const entry of entries) {
    if (entry.status === "present") totals[entry.locale] = (totals[entry.locale] ?? 0) + (entry.bytes ?? 0);
  }
  return totals;
}

/** Runs the PowerShell worker for the jobs. Returns the result list (empty when it could not run). */
function runWorker(jobs) {
  if (process.platform !== "win32") {
    console.error("[voice] Speech synthesis needs Windows. All jobs fail and stay missing.");
    return jobs.map((job) => ({ clipId: job.clipId, locale: job.locale, ok: false, error: "Not running on Windows." }));
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const jobFile = path.join(CACHE_DIR, "jobs.json");
  const resultFile = path.join(CACHE_DIR, "results.json");
  rmSync(resultFile, { force: true });
  writeFileSync(jobFile, JSON.stringify(jobs, null, 2), "utf8");

  console.log(`Running ${jobs.length} job(s) with Windows PowerShell 5.1 ...`);
  const run = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", WORKER_PATH, "-JobFile", jobFile, "-ResultFile", resultFile],
    { cwd: APP_ROOT, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  let parsed = null;
  try {
    if (existsSync(resultFile)) parsed = JSON.parse(readFileSync(resultFile, "utf8").replace(/^\uFEFF/, ""));
    else if (run.stdout) parsed = JSON.parse(run.stdout);
  } catch (error) {
    console.error(`[voice] The worker output could not be read: ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    const why = run.error ? run.error.message : `worker exit code ${String(run.status)}`;
    console.error(`[voice] The worker produced no results (${why}). All jobs fail and stay missing.`);
    return jobs.map((job) => ({ clipId: job.clipId, locale: job.locale, ok: false, error: `Worker failed (${why}).` }));
  }
  return parsed;
}

function printReport(report, strict) {
  console.log(`\nVoice report (${report.total} clip entries)`);
  console.log(`  by locale: ${JSON.stringify(report.byLocale)}`);
  console.log(`  by status: ${JSON.stringify(report.byStatus)}`);
  console.log(`  by origin: ${JSON.stringify(report.byOrigin)}`);
  console.log(`  by locale and status: ${JSON.stringify(report.byLocaleStatus)}`);
  if (report.missing.length > 0) {
    console.log(`\nMissing clips (${report.missing.length}):`);
    for (const item of report.missing) {
      console.log(`  [${item.locale}] ${item.clipId}  (${item.speakerId})  ${item.text}`);
    }
  }
  return strict && report.missing.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
