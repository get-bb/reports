// Forensic helper for get-bb/bb#2190: parse a SQLite WAL file, report which
// frames belong to the live "generation" (salt pair in the WAL header) and
// which are stale frames from an earlier generation, and optionally rebuild
// the previous generation onto a copy of the main database file.
//
// Usage:
//   node issue-2190-wal-tool.mjs inspect <path/to/bb.db>
//   node issue-2190-wal-tool.mjs recover <path/to/bb.db> <out-dir> [--salt1 N]
//
// Background (https://www.sqlite.org/fileformat2.html#walformat): every WAL
// frame carries the salt pair that was in the WAL header when it was written.
// When SQLite "restarts" the WAL (writes frame 1 again with salt1+1 and a new
// random salt2), the older frames physically remain in the file but are
// invisible to recovery because their salts no longer match the header. A
// database that "reverted to the last checkpoint" therefore usually still has
// the lost pages sitting in the WAL file as stale-salt frames.
import { copyFileSync, mkdirSync, openSync, readFileSync, writeSync, closeSync, ftruncateSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

const WAL_HEADER_SIZE = 32;
const FRAME_HEADER_SIZE = 24;
const WAL_MAGIC_LE = 0x377f0682;
const WAL_MAGIC_BE = 0x377f0683;

function walChecksum(bigEndian, buffer, start, end, s0 = 0, s1 = 0) {
  // SQLite's checksum walks the region in 8-byte steps using native (LE) or
  // big-endian 32-bit words depending on the magic number.
  for (let i = start; i < end; i += 8) {
    const x0 = bigEndian ? buffer.readUInt32BE(i) : buffer.readUInt32LE(i);
    const x1 = bigEndian ? buffer.readUInt32BE(i + 4) : buffer.readUInt32LE(i + 4);
    s0 = (s0 + x0 + s1) >>> 0;
    s1 = (s1 + x1 + s0) >>> 0;
  }
  return [s0, s1];
}

export function parseWal(walPath) {
  const wal = readFileSync(walPath);
  if (wal.length < WAL_HEADER_SIZE) {
    return { header: null, frames: [], fileBytes: wal.length, reason: "file shorter than a WAL header" };
  }
  const magic = wal.readUInt32BE(0);
  if (magic !== WAL_MAGIC_LE && magic !== WAL_MAGIC_BE) {
    return { header: null, frames: [], fileBytes: wal.length, reason: `bad magic 0x${magic.toString(16)}` };
  }
  const bigEndian = magic === WAL_MAGIC_BE;
  const header = {
    magic,
    bigEndian,
    version: wal.readUInt32BE(4),
    pageSize: wal.readUInt32BE(8),
    checkpointSeq: wal.readUInt32BE(12),
    salt1: wal.readUInt32BE(16),
    salt2: wal.readUInt32BE(20),
    cksum1: wal.readUInt32BE(24),
    cksum2: wal.readUInt32BE(28),
  };
  const [h0, h1] = walChecksum(bigEndian, wal, 0, 24);
  header.checksumValid = h0 === header.cksum1 && h1 === header.cksum2;

  const frameSize = FRAME_HEADER_SIZE + header.pageSize;
  const frames = [];
  let s0 = header.cksum1;
  let s1 = header.cksum2;
  let chainIntact = header.checksumValid;
  let offset = WAL_HEADER_SIZE;
  let index = 1;
  while (offset + frameSize <= wal.length) {
    const frame = {
      index,
      offset,
      pgno: wal.readUInt32BE(offset),
      dbSizeAfterCommit: wal.readUInt32BE(offset + 4),
      salt1: wal.readUInt32BE(offset + 8),
      salt2: wal.readUInt32BE(offset + 12),
      cksum1: wal.readUInt32BE(offset + 16),
      cksum2: wal.readUInt32BE(offset + 20),
      dataOffset: offset + FRAME_HEADER_SIZE,
    };
    frame.saltMatchesHeader = frame.salt1 === header.salt1 && frame.salt2 === header.salt2;
    if (chainIntact && frame.saltMatchesHeader) {
      [s0, s1] = walChecksum(bigEndian, wal, offset, offset + 8, s0, s1);
      [s0, s1] = walChecksum(bigEndian, wal, frame.dataOffset, frame.dataOffset + header.pageSize, s0, s1);
      frame.checksumValid = s0 === frame.cksum1 && s1 === frame.cksum2;
      if (!frame.checksumValid) chainIntact = false;
    } else {
      frame.checksumValid = false;
      chainIntact = false;
    }
    frames.push(frame);
    offset += frameSize;
    index += 1;
  }
  // Recovery only honours valid frames up to and including the last commit
  // frame (dbSizeAfterCommit > 0) of the unbroken chain.
  let liveFrameCount = 0;
  for (const frame of frames) {
    if (!frame.checksumValid) break;
    if (frame.dbSizeAfterCommit > 0) liveFrameCount = frame.index;
  }
  // Classify: "live" = replayed by SQLite; "live-uncommitted" = chain-valid
  // frames after the last commit (an in-flight transaction); "stale" = beyond
  // the chain break. Stale frames keep whatever salt they were written with:
  // a normal WAL restart bumps salt1, but recovery after an unreadable header
  // keeps the on-disk salt and simply rewrites frame 1 onwards, so stale
  // frames can carry the SAME salt as the live header.
  for (const frame of frames) {
    frame.status = frame.checksumValid
      ? frame.index <= liveFrameCount ? "live" : "live-uncommitted"
      : "stale";
  }
  return { header, frames, fileBytes: wal.length, liveFrameCount, wal };
}

export function summarizeGenerations(parsed) {
  const groups = new Map();
  for (const frame of parsed.frames) {
    const isLive = frame.status !== "stale";
    const key = `${isLive ? "live" : "stale"}:${frame.salt1}:${frame.salt2}`;
    let group = groups.get(key);
    if (!group) {
      group = { salt1: frame.salt1, salt2: frame.salt2, frameCount: 0, firstIndex: frame.index, lastIndex: frame.index, commitFrames: 0, pages: new Set(), isLive };
      groups.set(key, group);
    }
    group.frameCount += 1;
    group.lastIndex = frame.index;
    if (frame.dbSizeAfterCommit > 0) group.commitFrames += 1;
    group.pages.add(frame.pgno);
  }
  return [...groups.values()].sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.firstIndex - b.firstIndex);
}

/**
 * Parse the wal-index header (-shm). Layout per wal.c: two 48-byte copies of
 * WalIndexHdr (native byte order) followed by WalCkptInfo. mxFrame is the last
 * valid frame readers may use, nBackfill how many frames a checkpoint has
 * copied into the main file, aReadMark[] the snapshot each reader slot pins.
 * A long-lived reader pins checkpoints at its aReadMark value, which is how a
 * main file can sit weeks behind the WAL.
 */
export function parseShm(shmPath) {
  if (!existsSync(shmPath)) return { exists: false };
  const shm = readFileSync(shmPath);
  if (shm.length < 136) return { exists: true, fileBytes: shm.length, reason: "shorter than a wal-index header" };
  const readHdr = (o) => ({
    iVersion: shm.readUInt32LE(o),
    iChange: shm.readUInt32LE(o + 8),
    isInit: shm[o + 12],
    bigEndCksum: shm[o + 13],
    szPage: shm.readUInt16LE(o + 14),
    mxFrame: shm.readUInt32LE(o + 16),
    nPage: shm.readUInt32LE(o + 20),
    salt1: shm.readUInt32BE(o + 32),
    salt2: shm.readUInt32BE(o + 36),
  });
  const copy1 = readHdr(0);
  const copy2 = readHdr(48);
  const ckpt = {
    nBackfill: shm.readUInt32LE(96),
    aReadMark: [0, 1, 2, 3, 4].map((i) => shm.readUInt32LE(100 + i * 4)),
    nBackfillAttempted: shm.readUInt32LE(128),
  };
  return { exists: true, fileBytes: shm.length, copy1, copy2, copiesMatch: JSON.stringify(copy1) === JSON.stringify(copy2), ckpt };
}

export function inspect(dbPath) {
  const walPath = `${dbPath}-wal`;
  const shm = parseShm(`${dbPath}-shm`);
  if (!existsSync(walPath)) {
    return { dbPath, walPath, exists: false, shm };
  }
  const parsed = parseWal(walPath);
  const generations = parsed.header ? summarizeGenerations(parsed) : [];
  return {
    dbPath,
    walPath,
    exists: true,
    fileBytes: parsed.fileBytes,
    header: parsed.header,
    reason: parsed.reason,
    totalFrames: parsed.frames.length,
    liveFrameCount: parsed.liveFrameCount ?? 0,
    generations: generations.map((g) => ({ ...g, distinctPages: g.pages.size, pages: undefined })),
    shm,
  };
}

/**
 * Best-effort rebuild of a stale generation. Frames 1..k of the stale
 * generation were overwritten by the live generation, so the checksum chain
 * cannot be verified; instead the surviving stale frames are applied in file
 * order onto a copy of the main database file up to the last stale commit
 * frame. Pages whose only copy lived in the overwritten prefix are missing,
 * so always run PRAGMA integrity_check on the result. NOTE: the copy of the
 * main file must be the one from the cold backup taken right after the
 * incident; later checkpoints overwrite pages of the main file too.
 */
export function recoverGeneration(dbPath, outDir, { salt1 } = {}) {
  const parsed = parseWal(`${dbPath}-wal`);
  if (!parsed.header) throw new Error(`not a WAL file: ${parsed.reason}`);
  const generations = summarizeGenerations(parsed);
  // Default: the stale generation holding the most frames. (After a normal
  // WAL restart salt1 is old+1; after recovery of an unreadable header SQLite
  // keeps the on-disk salt, so stale frames may share the live salt. Neither
  // "header salt1 - 1" nor "different salt" is a reliable default.)
  const candidates = generations.filter((g) => !g.isLive && (salt1 === undefined || g.salt1 === salt1));
  if (candidates.length === 0) {
    throw new Error(`no stale generation${salt1 === undefined ? "" : ` with salt1=${salt1}`}; generations: ${JSON.stringify(generations.map((g) => ({ salt1: g.salt1, frames: g.frameCount, live: g.isLive })))}`);
  }
  const target = candidates.sort((a, b) => b.frameCount - a.frameCount)[0];
  const frames = parsed.frames.filter((f) => f.status === "stale" && f.salt1 === target.salt1 && f.salt2 === target.salt2);
  let lastCommit = -1;
  for (let i = 0; i < frames.length; i += 1) if (frames[i].dbSizeAfterCommit > 0) lastCommit = i;
  const applied = frames.slice(0, lastCommit + 1);

  mkdirSync(outDir, { recursive: true });
  const outDb = join(outDir, basename(dbPath));
  copyFileSync(dbPath, outDb);
  const fd = openSync(outDb, "r+");
  try {
    const { pageSize } = parsed.header;
    let finalDbSize = 0;
    for (const frame of applied) {
      writeSync(fd, parsed.wal, frame.dataOffset, pageSize, (frame.pgno - 1) * pageSize);
      if (frame.dbSizeAfterCommit > 0) finalDbSize = frame.dbSizeAfterCommit;
    }
    if (finalDbSize > 0) ftruncateSync(fd, finalDbSize * pageSize);
  } finally {
    closeSync(fd);
  }
  return {
    outDb,
    generation: { salt1: target.salt1, salt2: target.salt2, firstIndex: target.firstIndex, lastIndex: target.lastIndex },
    appliedFrames: applied.length,
    skippedTrailingFrames: frames.length - applied.length,
    overwrittenPrefixFrames: target.firstIndex - 1,
  };
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (invokedDirectly) {
  const [command, dbPath, outDir, ...rest] = process.argv.slice(2);
  if (command === "inspect" && dbPath) {
    console.log(JSON.stringify(inspect(dbPath), null, 2));
  } else if (command === "recover" && dbPath && outDir) {
    const saltFlag = rest.indexOf("--salt1");
    const salt1 = saltFlag !== -1 ? Number(rest[saltFlag + 1]) : undefined;
    console.log(JSON.stringify(recoverGeneration(dbPath, outDir, { salt1 }), null, 2));
  } else {
    console.error("usage: issue-2190-wal-tool.mjs inspect <bb.db> | recover <bb.db> <out-dir> [--salt1 N]");
    process.exit(2);
  }
}
