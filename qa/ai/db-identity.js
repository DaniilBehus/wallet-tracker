'use strict';

/*
 * Which file the live evaluator may open as its own database (N1, independent
 * review 2026-09-16).
 *
 * A path string is not a file. A directory junction or symlink, a relative
 * spelling, another letter case on Windows or a hard link can each name an
 * application database while looking like something else — the review opened
 * a synthetic sentinel through a junction and the evaluator wrote into it.
 *
 * The evaluation database and each SQLite companion it may create (-wal, -shm,
 * -journal) are compared with every protected application database and its
 * companions in two ways:
 *
 *   canonical path  the real path of the deepest existing ancestor (links and
 *                   letter case resolved by the filesystem) with the part that
 *                   does not exist yet appended; compared case-insensitively on
 *                   Windows. A file not created yet is placed where it would
 *                   really be created.
 *   file identity   device plus inode / NTFS file index, for files that exist.
 *                   Catches hard links, which no path comparison can.
 *
 * Fail closed when identity cannot be established: an existing file reporting
 * inode 0, an existing evaluation file with more than one hard link, or a
 * Windows path with ":" past the drive (an alternate data stream).
 *
 * Not defended: another process replacing directories or files between this
 * check and the open. The evaluator checks before reading anything and again
 * immediately before opening for writing; it does not claim more than that.
 */

const fs = require('fs');
const path = require('path');

const COMPANIONS = ['', '-wal', '-shm', '-journal'];
const IS_WINDOWS = process.platform === 'win32';

class UnsafeDatabaseError extends Error {
  constructor(reason) {
    super(`evaluation database refused: ${reason}; it must never be an application database`);
    this.name = 'UnsafeDatabaseError';
  }
}

const fold = (p) => (IS_WINDOWS ? p.toLowerCase() : p);

/** Real path through the deepest existing ancestor; the missing tail is appended as spelled. */
function canonicalPath(p) {
  let current = path.resolve(p);
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...tail);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.join(current, ...tail);
    tail.unshift(path.basename(current));
    current = parent;
  }
}

function identityOf(file) {
  try {
    const st = fs.statSync(file, { bigint: true });
    return { dev: st.dev, ino: st.ino, nlink: st.nlink };
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}

/** The application databases a live evaluation must never open. */
function protectedDatabasePaths({ root, env = process.env, cwd = process.cwd() }) {
  const paths = [path.join(root, 'data', 'wallet.db')];          // src/db.js default
  if (env.DB_PATH) paths.push(path.resolve(cwd, env.DB_PATH));    // what src/db.js would open
  return paths;
}

/** Throws UnsafeDatabaseError unless `evalPath` is a file distinct from every protected database. */
function assertDistinctDatabase(evalPath, protectedPaths) {
  const target = path.resolve(evalPath);
  if (IS_WINDOWS && target.slice(path.parse(target).root.length).includes(':')) {
    throw new UnsafeDatabaseError('a Windows path with ":" names an alternate data stream of another file');
  }

  const guarded = protectedPaths.flatMap((p) => COMPANIONS.map((suffix) => `${path.resolve(p)}${suffix}`));
  const guardedByCanonical = new Map(guarded.map((file) => [fold(canonicalPath(file)), file]));
  const guardedIdentities = [];
  for (const file of guarded) {
    const id = identityOf(file);
    if (!id) continue;
    if (id.ino === 0n) throw new UnsafeDatabaseError(`the filesystem reports no file identity for ${file}`);
    guardedIdentities.push({ file, id });
  }

  for (const suffix of COMPANIONS) {
    const candidate = `${target}${suffix}`;
    const same = guardedByCanonical.get(fold(canonicalPath(candidate)));
    if (same) throw new UnsafeDatabaseError(`${candidate} resolves to ${same}`);

    const id = identityOf(candidate);
    if (!id) continue;
    if (id.ino === 0n) throw new UnsafeDatabaseError(`the filesystem reports no file identity for ${candidate}`);
    if (id.nlink > 1n) throw new UnsafeDatabaseError(`${candidate} has ${id.nlink} hard links, so it may be another database`);
    const twin = guardedIdentities.find((g) => g.id.dev === id.dev && g.id.ino === id.ino);
    if (twin) throw new UnsafeDatabaseError(`${candidate} is the same file as ${twin.file}`);
  }
}

module.exports = { UnsafeDatabaseError, canonicalPath, protectedDatabasePaths, assertDistinctDatabase, COMPANIONS };
