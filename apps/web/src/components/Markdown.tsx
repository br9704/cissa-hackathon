import { useMemo } from "react";
import styles from "./Markdown.module.css";

/*
  A small markdown renderer for the generated documents.

  Deliberately not a library. The generators in packages/core emit a known and small
  subset (headings, paragraphs, bullets, blockquotes, pipe tables, bold, rules), and
  every one of them is written by us. Pulling in a general parser would add a dependency,
  a sanitiser decision, and a much larger surface than the six constructs actually used.

  It does not render raw HTML, and that is the sanitiser decision: there is no path from
  document text to markup here, so a decision title containing a bracket is text.
*/

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "table"; head: string[]; rows: string[][] };

function parse(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        kind: "h",
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!,
      });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        parts.push(lines[i]!.slice(2));
        i++;
      }
      blocks.push({ kind: "quote", text: parts.join(" ") });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("- ")) {
        items.push(lines[i]!.slice(2));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    /* A pipe table: a header row, a separator, then body rows. The separator is what
       distinguishes a table from a paragraph that happens to contain a pipe. */
    if (line.startsWith("|") && lines[i + 1]?.match(/^\|[\s:|-]+\|$/)) {
      const cells = (row: string) =>
        row.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        rows.push(cells(lines[i]!));
        i++;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("#") &&
      !lines[i]!.startsWith("|") &&
      !lines[i]!.startsWith("- ") &&
      !lines[i]!.startsWith("> ") &&
      lines[i]!.trim() !== "---"
    ) {
      parts.push(lines[i]!);
      i++;
    }
    blocks.push({ kind: "p", text: parts.join(" ") });
  }

  return blocks;
}

/** Bold and italic only, rendered as elements rather than as injected markup. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parse(source), [source]);

  return (
    <div className={styles.doc}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "hr":
            return <hr key={i} />;
          case "h":
            return b.level === 1 ? (
              <h1 key={i}>{inline(b.text)}</h1>
            ) : b.level === 2 ? (
              <h2 key={i}>{inline(b.text)}</h2>
            ) : (
              <h3 key={i}>{inline(b.text)}</h3>
            );
          case "quote":
            return <blockquote key={i}>{inline(b.text)}</blockquote>;
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "table":
            return (
              <table key={i}>
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j}>{inline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k}>{inline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
