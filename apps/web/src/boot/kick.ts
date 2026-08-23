/*
  The boot manifest.

  Registered before anything renders, so the weights exist before the first asset reports.
  Registering lazily inside each consumer would let a fast asset finish before the slow one
  is even known about, and the bar would jump to a hundred and then back down.

  ONLY things that actually report during a boot belong here. The first version also
  registered the retrieval model, which downloads on demand when the ask palette first opens
  and therefore never reported at boot at all: two of three assets stayed silent, the bar sat
  at zero for four seconds, and the hard cap released it. A progress bar that promises
  weighted progress and then shows none is worse than no bar, and it was the same lie the
  weighted manifest was written to avoid, arriving through the back door.
*/
import { register, label } from "./assets";

register("corpus", 1);
label("corpus", "reading the record");

/* Hashing 184 events takes a few milliseconds and it is the product's signature, so the
   boot does it for real rather than describing it. */
register("chain", 3);
label("chain", "verifying the chain");
