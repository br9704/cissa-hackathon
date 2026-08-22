/*
  Per repository configuration.

  Lives in .continuity.json at the repo root, next to the code it describes, so a desk
  that runs three repos can have three different opinions about what counts as a strategy
  change without anybody editing a global setting.
*/
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Config = {
  /** Where to post. Absent means dry run, which is the default until someone sets it. */
  apiUrl?: string;
  firmId?: string;
  memberId?: string;
  /*
    Glob-ish path rules deciding whether a commit is worth drafting a decision for.

    Deliberately prefix and suffix matching rather than a real glob library. The rules a
    desk actually writes are "anything under strategies/" and "any .yaml", and a
    dependency that handles brace expansion would be carrying a lot of weight for two
    cases. A rule nobody can predict the behaviour of is worse than a simple one.
  */
  include: string[];
  exclude: string[];
};

export const DEFAULT_CONFIG: Config = {
  include: ["strategies/", "research/", "params/", ".yaml", ".yml", ".toml", ".cfg"],
  exclude: ["test/", "tests/", "__tests__/", ".md", ".lock", "node_modules/"],
};

export function loadConfig(repoRoot: string): Config {
  const path = join(repoRoot, ".continuity.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Config>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      include: parsed.include ?? DEFAULT_CONFIG.include,
      exclude: parsed.exclude ?? DEFAULT_CONFIG.exclude,
    };
  } catch (err) {
    /*
      A malformed config is reported and then ignored in favour of the defaults. Refusing
      to run would mean a typo in a JSON file silently stops a desk capturing anything,
      and the failure would look like the hook not being installed.
    */
    console.error(`continuity: .continuity.json could not be read, using defaults (${(err as Error).message})`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Does this commit touch anything worth drafting a decision for.
 *
 * Exclude wins over include. A parameter file inside a test directory is a test fixture,
 * and treating it as a live parameter change is how a capture system trains people to
 * ignore it.
 */
export function isMaterial(paths: string[], config: Config = DEFAULT_CONFIG): boolean {
  return paths.some((path) => {
    const p = path.toLowerCase();
    if (config.exclude.some((rule) => matches(p, rule))) return false;
    return config.include.some((rule) => matches(p, rule));
  });
}

function matches(path: string, rule: string): boolean {
  const r = rule.toLowerCase();
  /* A rule ending in a slash is a directory prefix anywhere in the path. */
  if (r.endsWith("/")) return path.includes(r);
  /* A rule starting with a dot is an extension. */
  if (r.startsWith(".")) return path.endsWith(r);
  return path.includes(r);
}
