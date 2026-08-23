/*
  Real progress, not a fake tween.

  A bar that animates to ninety percent on a timer and then waits is a lie told to somebody
  who is already waiting, and it is the most common way a loading screen makes a product feel
  cheap. This is a weighted manifest instead: each thing that actually has to happen
  registers with a weight, reports its own progress, and the bar shows the weighted mean of
  the truth.

  Two properties matter, both learned by getting them wrong:

    Monotonic per asset. A reported value only goes up. A retry that restarts at zero makes
    the bar walk backwards, which reads as a fault rather than as a retry.

    Weighted. The corpus parses in milliseconds; the retrieval model is tens of megabytes
    over the network. Averaging them evenly makes the bar leap to half and sit there, which
    is the same lie in a different shape.
*/

type Asset = { weight: number; progress: number };

const assets = new Map<string, Asset>();
const labels = new Map<string, string>();
const listeners = new Set<() => void>();

/*
  Notifications are deferred to a microtask, never fired synchronously.

  corpus() is a memoised getter called during render by half the app, and it reports here.
  Firing listeners inline meant a component's render triggered setState inside the boot
  screen, which React flags as updating one component while rendering another. It is the same
  class of bug as the render loop this codebase already hit once with a getSnapshot that
  built a new object every call. Deferring costs nothing: a progress bar does not need to be
  correct within the same frame as the thing it is measuring.
*/
let queued = false;

function notify(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    for (const l of listeners) l();
  });
}

export function register(name: string, weight: number): void {
  if (!assets.has(name)) assets.set(name, { weight, progress: 0 });
}

export function report(name: string, progress: number): void {
  const asset = assets.get(name);
  if (!asset) return;
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= asset.progress) return;
  asset.progress = clamped;
  notify();
}

export function done(name: string): void {
  report(name, 1);
}

export function aggregate(): number {
  let total = 0;
  let sum = 0;
  for (const a of assets.values()) {
    total += a.weight;
    sum += a.weight * a.progress;
  }
  return total === 0 ? 0 : sum / total;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function label(name: string, text: string): void {
  labels.set(name, text);
  notify();
}

/** The first started but unfinished asset, so the readout follows the boot in order. */
export function currentLabel(): string {
  for (const [name, asset] of assets) {
    if (asset.progress < 1) return labels.get(name) ?? name;
  }
  return "ready";
}

export function reset(): void {
  assets.clear();
  labels.clear();
}
