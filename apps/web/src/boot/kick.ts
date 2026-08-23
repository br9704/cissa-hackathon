/*
  Register the boot manifest before anything renders.

  Imported for its side effects from main.tsx, so the weights exist before the first asset
  reports. Registering lazily inside each consumer would let a fast asset finish before the
  slow one is even known about, and the bar would jump to a hundred and then back down, which
  is worse than no bar.
*/
import { register, label } from "./assets";

register("corpus", 1);
label("corpus", "reading the record");

register("chain", 2);
label("chain", "verifying the chain");

/* The retrieval model is tens of megabytes over the network and dominates a cold boot, which
   is exactly why the manifest is weighted rather than averaged. */
register("search", 7);
label("search", "warming the search model");
