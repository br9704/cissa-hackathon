import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./CapturePage.module.css";
import { CaptureSheet } from "../components/CaptureSheet";
import { PixelIcon } from "../components/pixel/PixelIcon";
import { StatusChip } from "../components/StatusChip";
import { PixelAgent } from "../components/pixel/PixelAgent";
import {
  subscribeToCaptures,
  allCaptures,
  fileCapture,
  CHANNEL_LABEL,
  type CaptureChannel,
} from "../data/capture";
import { ago, strategyName } from "../data/source";
import { PageHeader } from "../components/PageHeader";

/*
  Every way in, in one room.

  The critique's finding was that this product does a great deal and performs none of it: the
  recorder, the importer and the CLI all existed and all sat below 184 rows of output. This is
  the room that shows the pipeline instead of hiding it, from raw input on the left to a filed
  record on the right.

  The inbox is the part that matters. Everything captured lands there and a person files it,
  which is the rule the whole product rests on: a ledger that files automatically is a log,
  and a log nobody approved is not evidence of anything.
*/

const CHANNELS: {
  id: CaptureChannel;
  glyph: Parameters<typeof PixelIcon>[0]["name"];
  name: string;
  what: string;
  how: string;
  opens: boolean;
}[] = [
  {
    id: "note",
    glyph: "note",
    name: "Write it down",
    what: "Thirty seconds while you remember why. The smallest possible ask, which is why it is the one people actually do.",
    how: "Cmd N anywhere",
    opens: true,
  },
  {
    id: "meeting",
    glyph: "mic",
    name: "Record a meeting",
    what: "Transcribed and split by speaker inside this browser. The audio never leaves the tab.",
    how: "in the sheet",
    opens: true,
  },
  {
    id: "transcript",
    glyph: "upload",
    name: "Import a transcript",
    what: "Paste or drop a call transcript and it is parsed into turns by speaker.",
    how: "in the sheet",
    opens: true,
  },
  {
    id: "commit",
    glyph: "repo",
    name: "From your commits",
    what: "A git hook reads what changed and drafts a record, so the reasoning is captured where the work already happens.",
    how: "continuity install",
    opens: false,
  },
];

export function CapturePage() {
  const captures = useSyncExternalStore(subscribeToCaptures, allCaptures, allCaptures);
  const [open, setOpen] = useState(false);

  /*
    The desktop tray can ask for this room with the recorder open.

    An event rather than a route parameter, because the tray is telling the app to DO
    something rather than navigate somewhere, and a URL that opens a microphone would be a
    URL somebody could send you.
  */
  useEffect(() => {
    function onListen() {
      setOpen(true);
    }
    window.addEventListener("continuity:start-listening", onListen);
    return () => window.removeEventListener("continuity:start-listening", onListen);
  }, []);

  const unfiled = captures.filter((c) => !c.filed);
  const filed = captures.filter((c) => c.filed);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Capture"
        lead="A ledger is worth exactly what people put into it, and asking somebody to stop working and write is the reason wikis fail. So capture happens where the work already happens, and everything lands in an inbox first: nothing reaches the record unread."
      />

      <div className={styles.grid}>
        <div>
          <div className={styles.channels}>
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={styles.channel}
                data-passive={!ch.opens}
                onClick={ch.opens ? () => setOpen(true) : undefined}
              >
                <span className={styles.channelHead}>
                  <PixelIcon name={ch.glyph} size={16} />
                  <span className={styles.channelName}>{ch.name}</span>
                </span>
                <span className={styles.channelWhat}>{ch.what}</span>
                <span className={styles.channelHow}>{ch.how}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Inbox</span>
              <span className={styles.panelHint}>
                {unfiled.length === 0 ? "nothing waiting" : `${unfiled.length} waiting for you`}
              </span>
            </div>

            {unfiled.length === 0 ? (
              <p className={styles.empty}>
                Nothing captured yet in this session. Anything you record, import or write
                appears here first, with the channel it came in through, and stays a draft
                until you file it.
              </p>
            ) : (
              unfiled.map((c) => (
                <div key={c.id} className={styles.item}>
                  <span className={styles.itemHead}>
                    <span className={styles.itemTitle}>{c.title}</span>
                    {c.draftedBy === "model" ? (
                      <StatusChip variant="draft">
                        <PixelAgent state="spoke" size={11} label="a model wrote this" />
                        drafted by model
                      </StatusChip>
                    ) : null}
                  </span>
                  <span className={styles.itemBody}>{c.body.slice(0, 220)}</span>
                  <span className={styles.itemRow}>
                    <button
                      type="button"
                      className={styles.file}
                      onClick={() => fileCapture(c.id)}
                    >
                      File into the ledger
                    </button>
                    <span className={styles.channelTag}>
                      {CHANNEL_LABEL[c.channel]}
                      {c.strategyId ? ` · ${strategyName(c.strategyId)}` : ""} · {ago(c.at)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>

          {filed.length > 0 ? (
            <div className={styles.panel} style={{ marginTop: 20 }}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Filed this session</span>
                <span className={styles.panelHint}>appended to the chain</span>
              </div>
              {filed.map((c) => (
                <div key={c.id} className={styles.item}>
                  <span className={styles.itemHead}>
                    <span className={styles.itemTitle}>{c.title}</span>
                    <StatusChip variant="verified">chained</StatusChip>
                  </span>
                  <span className={styles.channelTag}>{CHANNEL_LABEL[c.channel]}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <CaptureSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
