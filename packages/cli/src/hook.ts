/*
  The post-commit hook.

  Written as a shell script that shells back into the CLI, rather than as a Node file, so
  it works whether the developer's shell has node on the path at hook time or not, and so
  someone reading .git/hooks/post-commit can see in four lines exactly what it does. A
  hook nobody can read is a hook people delete.

  It never blocks the commit. The commit already happened by the time post-commit runs,
  and a capture system that can fail a developer's workflow gets uninstalled the first
  time it does.
*/
export const HOOK_MARKER = "# installed by continuity";

export function hookScript(cliCommand: string): string {
  return `#!/bin/sh
${HOOK_MARKER}
#
# Posts the commit to Continuity as an artifact, and asks for a decision record draft
# if it touched anything the repo's .continuity.json calls material.
#
# Runs in the background and swallows its own failures on purpose. This is post-commit:
# the commit is already made, and nothing here is worth delaying or worrying a developer
# about. If Continuity is down, the worst case is a missing draft, not a broken workflow.
(${cliCommand} capture --commit "$(git rev-parse HEAD)" >/dev/null 2>&1 &) || true
exit 0
`;
}

/**
 * Is an existing hook one of ours.
 *
 * Checked before writing, because silently overwriting somebody's existing post-commit
 * hook is a genuinely bad thing to do to a repository, and a lot of desks have one.
 */
export function isOurs(existing: string): boolean {
  return existing.includes(HOOK_MARKER);
}
