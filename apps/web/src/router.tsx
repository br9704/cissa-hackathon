import { useState } from "react";
import {
  Outlet,
  useRouterState,
  createRootRoute,
  createRoute,
  createRouter,
  createHashHistory,
  createBrowserHistory,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell";
import { BootScreen } from "./boot/BootScreen";
import { QuickCapture } from "./components/QuickCapture";
import { MyRecordPage } from "./routes/MyRecordPage";
import { LedgerPage } from "./routes/LedgerPage";
import { StrategiesPage } from "./routes/StrategiesPage";
import { RiskPage } from "./routes/RiskPage";
import { DebriefsPage } from "./routes/DebriefsPage";
import { CompliancePage } from "./routes/CompliancePage";
import { VerifyPage } from "./routes/VerifyPage";
import { DecisionDetail } from "./routes/detail/DecisionDetail";
import { StrategyDetail } from "./routes/detail/StrategyDetail";
import { PersonDetail } from "./routes/detail/PersonDetail";
import { ArtifactDetail } from "./routes/detail/ArtifactDetail";
import { DebriefDetail } from "./routes/detail/DebriefDetail";
import { QuestionDetail } from "./routes/detail/QuestionDetail";
import { AcademyPage } from "./academy/AcademyPage";
import { isDesktop } from "./lib/shell";

/*
  The quick capture window loads the same bundle as the main window and picks its route
  out of the hash. It must render WITHOUT the app shell: it is a 560 by 132 panel floating
  over the whole OS, and a nav rail in it would be absurd. So the root component branches
  on the path rather than the tree carrying two layouts, which keeps one router and one
  bundle for both windows.
*/
/*
  Which chrome a route gets.

  This was a string equality chain and is now a table, because the boot screen made it a
  third branch and a fourth is coming with auth. The quick capture entry is the one that
  matters: tauri.conf.json pins that window to index.html#/quick-capture, it is a 560 by 132
  transparent panel floating over the whole OS, and anything wrapped around it (a nav rail, a
  progress screen, later a login form) is absurd there.
*/
const BARE_ROUTES = new Set(["/quick-capture"]);

function Root() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const bare = BARE_ROUTES.has(path);
  const [booted, setBooted] = useState(() => bare || !shouldBoot());

  if (bare) return <Outlet />;
  if (!booted) return <BootScreen onDone={() => setBooted(true)} />;
  return <AppShell />;
}

/*
  Once per session, and never when the visitor has asked for less motion. Reading the flag
  here rather than inside the component means a reduced motion visitor never mounts it at
  all, so there is no frame of it to see.
*/
function shouldBoot(): boolean {
  try {
    if (sessionStorage.getItem("continuity:booted")) return false;
    sessionStorage.setItem("continuity:booted", "1");
  } catch {
    /* Private windows and blocked storage: show it, which is the harmless direction. */
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const rootRoute = createRootRoute({ component: Root });

/*
  Written out one by one rather than mapped over an array. A helper that takes `path:
  string` erases the literal types, and those literals are the whole point: they are what
  makes <Link to="/risk"> a compile error when the route is renamed.
*/
const ledgerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: LedgerPage });
const strategiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/strategies", component: StrategiesPage });
const riskRoute = createRoute({ getParentRoute: () => rootRoute, path: "/risk", component: RiskPage });
const debriefsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/debriefs", component: DebriefsPage });
const complianceRoute = createRoute({ getParentRoute: () => rootRoute, path: "/compliance", component: CompliancePage });
const verifyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/verify", component: VerifyPage });
const myRecordRoute = createRoute({ getParentRoute: () => rootRoute, path: "/my-record", component: MyRecordPage });
const quickCaptureRoute = createRoute({ getParentRoute: () => rootRoute, path: "/quick-capture", component: QuickCapture });

/*
  The detail routes: the drill down.

  Written out one by one for the same reason as the routes above, and it matters more here.
  Each of these widens the router's path union globally, so a Link carrying a computed string
  becomes a compile error rather than a dead link somebody finds during a demo. That is worth
  the repetition.

  Singular paths beside the existing plurals on purpose: /strategy/$id sits next to
  /strategies, and the distinct first segment keeps the two from ever being ambiguous.
*/
const academyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/academy", component: AcademyPage });
const decisionRoute = createRoute({ getParentRoute: () => rootRoute, path: "/decision/$id", component: DecisionDetail });
const strategyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/strategy/$id", component: StrategyDetail });
const personRoute = createRoute({ getParentRoute: () => rootRoute, path: "/person/$id", component: PersonDetail });
const artifactRoute = createRoute({ getParentRoute: () => rootRoute, path: "/artifact/$id", component: ArtifactDetail });
const debriefRoute = createRoute({ getParentRoute: () => rootRoute, path: "/debrief/$id", component: DebriefDetail });
const questionRoute = createRoute({ getParentRoute: () => rootRoute, path: "/question/$id", component: QuestionDetail });

const routeTree = rootRoute.addChildren([
  ledgerRoute,
  strategiesRoute,
  riskRoute,
  debriefsRoute,
  complianceRoute,
  verifyRoute,
  myRecordRoute,
  quickCaptureRoute,
  academyRoute,
  decisionRoute,
  strategyRoute,
  personRoute,
  artifactRoute,
  debriefRoute,
  questionRoute,
]);

/*
  Tauri serves the app from a custom protocol with no server side rewrites, so a browser
  history deep link resolves to nothing there. Hash history inside the desktop shell,
  real paths on the web.
*/
export const router = createRouter({
  routeTree,
  history: isDesktop ? createHashHistory() : createBrowserHistory(),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
