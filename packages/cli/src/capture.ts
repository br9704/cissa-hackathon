/*
  Turning a commit into an artifact and a draft.

  The interesting part is what it sends and what it does not. It sends the commit message,
  the paths, and the diff of the material files. It does not send the whole repository,
  and it does not send anything from a path the config excludes.

  On a real desk that distinction is the difference between a tool compliance will
  approve and one they will not.
*/
import { execFileSync } from "node:child_process";
import { isMaterial, type Config } from "./config.js";

export type CommitInfo = {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  committedAt: string;
  paths: string[];
};

export function readCommit(sha: string, cwd: string): CommitInfo {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

  return {
    sha,
    message: git("log", "-1", "--format=%B", sha),
    author: git("log", "-1", "--format=%an", sha),
    authorEmail: git("log", "-1", "--format=%ae", sha),
    committedAt: git("log", "-1", "--format=%cI", sha),
    paths: git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean),
  };
}

/**
 * The diff of the material files only.
 *
 * Capped, because a commit that reformats a whole directory produces a diff nobody
 * benefits from reading and a request nobody benefits from sending. The cap is announced
 * in the payload rather than applied silently, so a truncated draft is visibly truncated.
 */
export function materialDiff(
  info: CommitInfo,
  config: Config,
  cwd: string,
  maxBytes = 24_000,
): { diff: string; truncated: boolean } {
  const paths = info.paths.filter((p) => isMaterial([p], config));
  if (paths.length === 0) return { diff: "", truncated: false };

  const raw = execFileSync(
    "git",
    ["show", "--format=", "--unified=3", info.sha, "--", ...paths],
    { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );

  if (raw.length <= maxBytes) return { diff: raw, truncated: false };
  return { diff: raw.slice(0, maxBytes), truncated: true };
}

/** What gets posted. Kept flat so it reads clearly in a log or a network tab. */
export function buildPayload(info: CommitInfo, config: Config, diff: { diff: string; truncated: boolean }) {
  return {
    kind: "commit" as const,
    external_ref: info.sha.slice(0, 12),
    occurred_at: info.committedAt,
    author_email: info.authorEmail,
    author_name: info.author,
    message: info.message,
    paths: info.paths,
    material: isMaterial(info.paths, config),
    diff: diff.diff,
    diff_truncated: diff.truncated,
  };
}
