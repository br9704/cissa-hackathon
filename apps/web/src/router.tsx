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
import { QuickCapture } from "./components/QuickCapture";
import { MyRecordPage } from "./routes/MyRecordPage";
import { LedgerPage } from "./routes/LedgerPage";
import { StrategiesPage } from "./routes/StrategiesPage";
import { RiskPage } from "./routes/RiskPage";
import { DebriefsPage } from "./routes/DebriefsPage";
import { CompliancePage } from "./routes/CompliancePage";
import { VerifyPage } from "./routes/VerifyPage";
import { isDesktop } from "./lib/shell";

/*
  The quick capture window loads the same bundle as the main window and picks its route
  out of the hash. It must render WITHOUT the app shell: it is a 560 by 132 panel floating
  over the whole OS, and a nav rail in it would be absurd. So the root component branches
  on the path rather than the tree carrying two layouts, which keeps one router and one
  bundle for both windows.
*/
function Root() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/quick-capture") return <Outlet />;
  return <AppShell />;
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

const routeTree = rootRoute.addChildren([
  ledgerRoute,
  strategiesRoute,
  riskRoute,
  debriefsRoute,
  complianceRoute,
  verifyRoute,
  myRecordRoute,
  quickCaptureRoute,
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
