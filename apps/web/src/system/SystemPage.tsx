import { useEffect, useState } from "react";
import styles from "./SystemPage.module.css";
import { PixelIcon, type GlyphName } from "../components/pixel/PixelIcon";
import { corpus, backend } from "../data/source";

/*
  What the thing actually is, drawn.

  Most architecture diagrams are slides, which means they are wrong within a week. This one
  checks itself: every component that CAN be probed is probed live, so the picture is either
  true or it says plainly which part is not running.

  The shape it is trying to convey is the argument of the product in one screen. Many ways
  in, ONE append only spine, and everything else is a projection of that spine. A system that
  updated rows in place could not do the replay, could not prove tamper evidence, and could
  not answer "what did we know in March", and all three fall out of the same decision made
  once at the start.
*/

type Probe = "checking" | "up" | "down" | "static";

type Node = {
  name: string;
  glyph: GlyphName;
  what: string;
  probe?: "tagger" | "firm" | "supabase";
  state?: Probe;
};

type Layer = {
  name: string;
  what: string;
  note: string;
  spine?: boolean;
  nodes: Node[];
};

export function SystemPage() {
  const [tagger, setTagger] = useState<Probe>("checking");
  const [firm, setFirm] = useState<Probe>("checking");
  const c = corpus();

  useEffect(() => {
    let live = true;
    async function probe(path: string, set: (p: Probe) => void) {
      try {
        const res = await fetch(path);
        const body = (await res.json()) as { available?: boolean };
        if (live) set(body.available ? "up" : "down");
      } catch {
        if (live) set("down");
      }
    }
    void probe("/api/tag", setTagger);
    void probe("/api/firm-model", setFirm);
    return () => {
      live = false;
    };
  }, []);

  const layers: Layer[] = [
    {
      name: "Capture",
      what: "many ways in",
      note:
        "Every one of these exists because asking somebody to stop working and write is the reason wikis fail. Capture has to happen where the work already happens.",
      nodes: [
        { name: "Git hook", glyph: "repo", what: "a commit becomes a draft record", state: "static" },
        { name: "Meeting recorder", glyph: "mic", what: "speech to text and speaker split, inside the browser", state: "static" },
        { name: "Transcript import", glyph: "upload", what: "paste or drop a call transcript", state: "static" },
        { name: "Quick capture", glyph: "note", what: "a global hotkey and a single field", state: "static" },
        { name: "MCP server", glyph: "chip", what: "your editor files the record as you change the code", state: "static" },
      ],
    },
    {
      name: "The spine",
      what: "one append only event log",
      spine: true,
      note:
        "Every capture becomes an event, and every event is hashed together with the hash of the one before it. Nothing updates and nothing deletes. Three database triggers make editing hard; the chain makes editing VISIBLE, which is the part that matters, because a determined administrator can disable a trigger and cannot forge a chain.",
      nodes: [
        { name: "events", glyph: "link", what: `${c.decisions.length} rows, each sealed to the one before it` },
        { name: "Postgres triggers", glyph: "shield", what: "no update, no delete, no fork of the chain" },
        {
          name: "Supabase",
          glyph: "database",
          what: backend === "supabase" ? "hosted, and this app is reading it" : "configured by environment; running on the seeded corpus",
          state: backend === "supabase" ? "up" : "down",
        },
      ],
    },
    {
      name: "Projections",
      what: "everything else is derived",
      note:
        "None of this is a source of truth. Each one is a fold over the events, which is why the replay works: the state at any past moment is simply the events up to that moment, with no history table and nothing reconstructed.",
      nodes: [
        { name: "Decisions", glyph: "record", what: `${c.decisions.length} records with reasoning and rejected alternatives` },
        { name: "Genealogy", glyph: "graph", what: `${c.links.length} links, what replaced what` },
        { name: "Knowledge risk", glyph: "clock", what: "concentration per book, never per person" },
        { name: "Curriculum", glyph: "academy", what: "the same records, ordered for somebody new" },
        { name: "Compliance packs", glyph: "seal", what: "RTS 6 and SR 11-7 shaped extracts" },
      ],
    },
    {
      name: "Models",
      what: "on this machine wherever it matters",
      note:
        "The retrieval model runs in the browser tab, so a question never leaves the machine. The tagger and the firm model run locally too, which is the entire argument for training them: this data can never leave the building, so the inference cannot either.",
      nodes: [
        { name: "Retrieval", glyph: "search", what: "embeddings in the tab, with a keyword fallback when the model cannot load", state: "up" },
        { name: "On-prem tagger", glyph: "chip", what: "classifies a record, fine tuned on this corpus", probe: "tagger", state: tagger },
        { name: "Firm model", glyph: "spark", what: "answers from the ledger with the corpus offline", probe: "firm", state: firm },
      ],
    },
    {
      name: "Surfaces",
      what: "what a person actually touches",
      note:
        "One React front end, two shells: a web app and a Tauri desktop app that adds a tray and a global capture hotkey. Both read the same projections.",
      nodes: [
        { name: "Desk", glyph: "people", what: "arranged by who is looking" },
        { name: "The record", glyph: "record", what: "every decision, every one of them clickable" },
        { name: "Verify", glyph: "shield", what: "recompute every seal, and try to break one" },
        { name: "Academy", glyph: "academy", what: "the record as a training programme" },
        { name: "Desktop shell", glyph: "waveform", what: "tray, global hotkey, floating capture panel" },
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <h1>The system</h1>
      <p className={styles.lede}>
        What this actually is, checked against itself. Anything that can be probed is probed
        live, so this diagram is either true or it tells you which part is not running. The
        shape is the whole argument: many ways in, one append only spine, and everything else
        derived from it.
      </p>

      <div className={styles.flow}>
        {layers.map((layer, i) => (
          <div key={layer.name}>
            <section className={`${styles.layer} ${layer.spine ? styles.layerSpine : ""}`}>
              <div className={styles.layerHead}>
                <span className={styles.layerName}>{layer.name}</span>
                <span className={styles.layerWhat}>{layer.what}</span>
              </div>
              <p className={styles.layerNote}>{layer.note}</p>
              <div className={styles.nodes}>
                {layer.nodes.map((n) => (
                  <div key={n.name} className={styles.node}>
                    <span className={styles.nodeHead}>
                      <PixelIcon name={n.glyph} size={14} />
                      <span className={styles.nodeName}>{n.name}</span>
                      {n.state && n.state !== "static" ? (
                        <>
                          <span className={styles.dot} data-state={n.state} />
                          <span className={styles.state}>
                            {n.state === "checking" ? "checking" : n.state}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className={styles.nodeWhat}>{n.what}</span>
                  </div>
                ))}
              </div>
            </section>
            {i < layers.length - 1 ? (
              <div className={styles.arrow} aria-hidden="true">
                <span className={styles.arrowLine} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dot} data-state="up" /> running now, checked from this page
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} data-state="down" /> not running, and the app degrades
          rather than pretending
        </span>
        <span className={styles.legendItem}>
          everything unmarked is code rather than a service, so there is nothing to probe
        </span>
      </div>
    </div>
  );
}
