# tools/claude-bridge

A loopback bridge from Continuity's three LLM routes to the Claude Code CLI, running under
the developer's own subscription on the developer's own machine.

```bash
node tools/claude-bridge/server.mjs        # then set CLAUDE_BRIDGE_URL in .env.local
curl -s localhost:8787/health
```

## Why this exists, and why it does not run in production

The owner has a Claude subscription and did not want to buy metered API credits. Anthropic
documents `claude -p` with stdin, `--output-format json`, and CI tokens, so a developer
scripting the tool they pay for, on their own machine, for their own work, is a supported
use.

Serving other people through those credentials is not. Anthropic's Claude Code legal page:

> "Anthropic does not permit third-party developers to offer Claude.ai login into their own
> applications, or to route requests through Free, Pro, or Max plan credentials on behalf
> of their users."

So this binds to `127.0.0.1`, rejects any caller that is not loopback, and the deployed
demo has no route to it. **That limitation is the design, not a shortcoming.** The hosted
demo does not draft, and the UI says so rather than quietly doing something it should not.

## The flags are the whole trick

Measured on this machine: the same call costs **40,953 prompt tokens** with the developer's
normal config and **240** with the flags this bridge uses. A 170x difference, and it is
entirely MCP tool definitions being injected into every request. Any version of this that
drops `--strict-mcp-config` or `--setting-sources ""` will burn a weekly subscription limit
in an afternoon.

The child environment is also scrubbed of `CLAUDE_CODE_*` and of `ANTHROPIC_API_KEY`: if a
key were set the CLI would silently bill metered credits, which is the one outcome the
owner asked to avoid.

## Before a demo, check the usage window

Subscription limits are shared with every Claude Code session on the machine. A heavy
session before the demo can take the demo down. Run `/usage` in Claude Code and look at the
seven-day window.

## What each route loses or keeps

| route | through the bridge | note |
| --- | --- | --- |
| `/api/draft-decision` | full, with schema-valid JSON | `--json-schema` replaces the API's structured output |
| `/api/debrief` | full, token streaming | stream-json unwraps to the same SSE the route already forwards |
| `/api/ask` | answers, weaker citations | the CLI has no document blocks with span attribution, so citations are what the model reports it used. The response carries `citation_mode: "model_reported"` and the UI says so |
