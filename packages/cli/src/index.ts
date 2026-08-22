#!/usr/bin/env -S npx tsx
/*
  continuity

    init      install the post-commit hook in this repository
    capture   post one commit as an artifact, and ask for a draft if it is material
    status    what is installed here and what it would capture
    watch     tail notebook checkpoints and file them as artifacts

  Every command is safe to run twice. init refuses to clobber somebody else's hook,
  capture is idempotent on the commit sha, and with no apiUrl configured the whole thing
  is a dry run that prints what it would have sent.
*/
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, chmodSync, watch, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, isMaterial, DEFAULT_CONFIG, type Config } from "./config.js";
import { hookScript, isOurs } from "./hook.js";
import { readCommit, materialDiff, buildPayload } from "./capture.js";

function repoRoot(from = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: from,
      encoding: "utf8",
    }).trim();
  } catch {
    fail("not inside a git repository");
  }
}

function fail(message: string): never {
  console.error(`continuity: ${message}`);
  process.exit(1);
}

/**
 * The command the hook should shell into.
 *
 * Prefers `continuity` on the PATH, because that is what a desk will have once this is
 * installed properly and it survives the checkout moving. Falls back to an absolute path
 * to this very file, so a hook installed from a workspace checkout actually runs instead
 * of failing silently in the background, which is the worst possible failure mode: the
 * hook is installed, it exits zero, and nothing is ever captured.
 */
function resolveCliCommand(): string {
  try {
    /* Invoke the shell directly rather than passing shell: true with arguments, which
       Node deprecated because the arguments are concatenated rather than escaped. */
    execFileSync("/bin/sh", ["-c", "command -v continuity"], { stdio: "ignore" });
    return "continuity";
  } catch {
    const self = fileURLToPath(import.meta.url);
    const tsx = join(self, "..", "..", "node_modules", ".bin", "tsx");
    if (existsSync(tsx)) return `${JSON.stringify(tsx)} ${JSON.stringify(self)}`;
    return `node ${JSON.stringify(self)}`;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

// ---------------------------------------------------------------- init

function init() {
  const root = repoRoot();
  const hookPath = join(root, ".git", "hooks", "post-commit");

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!isOurs(existing)) {
      /*
        Refuse rather than merge. Appending to somebody's existing hook works right up
        until theirs exits non-zero and ours never runs, and then the failure looks like
        Continuity being broken.
      */
      fail(
        `${relative(root, hookPath)} already exists and was not installed by us.\n` +
          "  Move it aside, or call `continuity capture` from it yourself.",
      );
    }
  }

  writeFileSync(hookPath, hookScript(resolveCliCommand()), "utf8");
  chmodSync(hookPath, 0o755);

  const configPath = join(root, ".continuity.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
    console.log(`wrote ${relative(root, configPath)}`);
  }

  console.log(`installed ${relative(root, hookPath)}`);
  console.log("");
  console.log("Every commit from here is filed as an artifact. Commits touching a path");
  console.log("your .continuity.json calls material also get a decision record drafted,");
  console.log("which waits for one keystroke from you before it is part of the record.");
}

// ---------------------------------------------------------------- capture

async function capture() {
  const root = repoRoot();
  const config = loadConfig(root);
  const sha =
    arg("commit") ??
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

  const info = readCommit(sha, root);
  const diff = materialDiff(info, config, root);
  const payload = buildPayload(info, config, diff);

  if (!config.apiUrl) {
    /* Dry run is the default, and it prints. A capture tool that does nothing visible
       when it is not configured is indistinguishable from one that is broken. */
    console.log("continuity: no apiUrl configured, this is a dry run");
    console.log(`  commit    ${payload.external_ref}  ${info.message.split("\n")[0]}`);
    console.log(`  author    ${info.author}`);
    console.log(`  paths     ${info.paths.length}`);
    console.log(`  material  ${payload.material ? "yes, a draft would be requested" : "no"}`);
    if (payload.diff_truncated) console.log("  diff      truncated at 24 kB");
    return;
  }

  try {
    const response = await fetch(`${config.apiUrl}/api/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firm_id: config.firmId, member_id: config.memberId, ...payload }),
    });
    if (!response.ok) {
      fail(`server said ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    console.log(`continuity: filed ${payload.external_ref}`);
  } catch (err) {
    /* Never throws into the hook. The commit is already made and this is a background
       process; the worst acceptable outcome is a missing draft. */
    console.error(`continuity: could not file ${payload.external_ref}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------- status

function status() {
  const root = repoRoot();
  const config = loadConfig(root);
  const hookPath = join(root, ".git", "hooks", "post-commit");
  const installed = existsSync(hookPath) && isOurs(readFileSync(hookPath, "utf8"));

  console.log(`repository  ${root}`);
  console.log(`hook        ${installed ? "installed" : "not installed, run continuity init"}`);
  console.log(`endpoint    ${config.apiUrl ?? "not set, capture runs as a dry run"}`);
  console.log(`include     ${config.include.join(" ")}`);
  console.log(`exclude     ${config.exclude.join(" ")}`);

  const recent = execFileSync("git", ["log", "-10", "--format=%h %s"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  console.log("");
  console.log("last 10 commits, and whether they would draft a decision:");
  for (const line of recent) {
    const sha = line.split(" ")[0]!;
    const paths = execFileSync("git", ["show", "--name-only", "--format=", sha], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    const material = isMaterial(paths, config);
    console.log(`  ${material ? "draft " : "      "} ${line}`);
  }
}

// ---------------------------------------------------------------- watch

function watchNotebooks() {
  const root = repoRoot();
  const config: Config = loadConfig(root);
  const target = resolve(arg("path") ?? root);

  console.log(`continuity: watching ${target} for notebook checkpoints`);
  console.log("a saved notebook is filed as an artifact, the same as a commit");

  const seen = new Map<string, number>();

  watch(target, { recursive: true }, (_event, filename) => {
    if (!filename || !filename.endsWith(".ipynb")) return;
    if (filename.includes(".ipynb_checkpoints")) return;

    const full = join(target, filename);
    let mtime: number;
    try {
      mtime = statSync(full).mtimeMs;
    } catch {
      return;
    }

    /*
      Editors write a notebook several times in a second when saving. Without this the
      ledger gets four artifacts for one save, which is noise dressed up as capture.
    */
    const last = seen.get(full) ?? 0;
    if (mtime - last < 2000) return;
    seen.set(full, mtime);

    const material = isMaterial([filename], config);
    console.log(
      `  ${new Date().toLocaleTimeString("en-AU")}  ${filename}` +
        (material ? "  (material)" : ""),
    );
  });
}

// ---------------------------------------------------------------- main

const command = process.argv[2];

switch (command) {
  case "init":
    init();
    break;
  case "capture":
    void capture();
    break;
  case "status":
    status();
    break;
  case "watch":
    watchNotebooks();
    break;
  default:
    console.log("continuity <init|capture|status|watch>");
    console.log("");
    console.log("  init     install the post-commit hook in this repository");
    console.log("  capture  file one commit as an artifact, and draft a decision if material");
    console.log("  status   what is installed here and what it would capture");
    console.log("  watch    file notebook saves as artifacts");
    process.exit(command ? 1 : 0);
}
