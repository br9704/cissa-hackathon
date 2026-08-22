/// <reference types="vite/client" />

/*
  CSS Modules are typed as a loose record on purpose. Generating exact per file types
  would need a codegen step in the watch loop, and the guard that actually matters here
  is the hex scan, not class name completion.
*/
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
