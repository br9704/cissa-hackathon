/*
  Which shell are we running in.

  Tauri injects both `isTauri` and `__TAURI_INTERNALS__` into every main frame
  unconditionally. `isTauri` is the documented contract now, and checking for it by
  name means the web bundle never has to import @tauri-apps/api just to find out
  whether it is in the desktop app.
*/
export const isDesktop = typeof window !== "undefined" && "isTauri" in window;
