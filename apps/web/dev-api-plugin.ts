/*
  Runs the /api routes inside the Vite dev server.

  Vercel runs those files as functions in production; `vite` alone serves static assets and
  knows nothing about them, so without this the AI features only work under `vercel dev`
  and the ordinary `pnpm dev` loop silently has no backend. That gap is exactly the kind of
  thing that gets discovered on a demo morning.

  It imports the SAME route modules Vercel deploys rather than reimplementing them, so
  there is one copy of the logic and no chance of the dev path and the deployed path
  drifting apart.
*/
import type { Plugin, ViteDevServer } from "vite";
import { readdirSync } from "node:fs";
import { join } from "node:path";

type WebHandler = (request: Request) => Promise<Response> | Response;

export function devApi(apiDir: string): Plugin {
  return {
    name: "continuity-dev-api",
    configureServer(server: ViteDevServer) {
      /*
        Resolved per request, not once at startup.

        The route list used to be read here and cached for the life of the server, so a route
        file added while the dev server was running returned 404 until somebody restarted it.
        The comment two lines down promised that editing a route needs no restart, and that
        was true for edits and false for new files, which is the most confusing shape a
        half truth can take. A readdir per /api request is microseconds and this is the dev
        server, not production.
      */
      const routesNow = (): string[] =>
        readdirSync(apiDir)
          .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && !f.endsWith(".test.ts"))
          .map((f) => f.replace(/\.ts$/, ""));

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) return next();

        const name = url.slice("/api/".length).split("?")[0]!;
        if (!routesNow().includes(name)) return next();

        try {
          /* ssrLoadModule so the route gets Vite's transform pipeline and hot reload,
             which means editing a route does not need a server restart. */
          const mod = (await server.ssrLoadModule(join(apiDir, `${name}.ts`))) as Record<
            string,
            WebHandler | undefined
          >;

          const method = (req.method ?? "GET").toUpperCase();
          const handler = mod[method];
          if (!handler) {
            res.statusCode = 405;
            res.end(`no ${method} handler in api/${name}.ts`);
            return;
          }

          /* Node's IncomingMessage into a Web Request, which is the signature the routes
             are written against because that is what Vercel gives them. */
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;

          const request = new Request(`http://localhost${url}`, {
            method,
            headers: req.headers as Record<string, string>,
            body: method === "GET" || method === "HEAD" ? undefined : body,
          });

          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));

          if (!response.body) {
            res.end();
            return;
          }

          /* Streamed responses have to stay streamed: the debrief route's whole point is
             that a question types itself, and buffering it here would make the dev
             experience differ from production in the one way that matters. */
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (err) {
          server.config.logger.error(`api/${name} failed: ${String(err)}`);
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}
