import { Fragment, type ReactNode } from "react";
import { parseBlocks } from "./markdown-parse";
import ui from "./ui.module.css";

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`+)([^`]+?)\1|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let key = 0;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[2] !== undefined) out.push(<code key={key++} className={ui.mdCode}>{match[2]}</code>);
    else if (match[3] !== undefined || match[4] !== undefined) out.push(<strong key={key++} style={{ color: "var(--w-head)", fontWeight: 600 }}>{match[3] ?? match[4]}</strong>);
    else if (match[5] !== undefined) out.push(<em key={key++}>{match[5]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className={ui.md}>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "code") return <pre key={i} className={ui.mdPre}><code>{block.text}</code></pre>;
        if (block.kind === "heading") return <div key={i} className={ui.mdHeading}>{inline(block.text)}</div>;
        if (block.kind === "quote") return <blockquote key={i} className={ui.mdQuote}>{inline(block.text)}</blockquote>;
        if (block.kind === "hr") return <hr key={i} className={ui.mdRule} />;
        if (block.kind === "table") {
          return (
            <div key={i} className={ui.mdTableWrap}>
              <table className={ui.mdTable}>
                <thead><tr>{block.header.map((cell, j) => <th key={j} style={{ textAlign: block.align[j] ?? undefined }}>{inline(cell)}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, r) => <tr key={r}>{block.header.map((_, j) => <td key={j} style={{ textAlign: block.align[j] ?? undefined }}>{inline(row[j] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return <List key={i} className={ui.mdList} style={{ listStyle: block.ordered ? "decimal" : "disc" }}>{block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}</List>;
        }
        return <p key={i} className={ui.mdPara}>{block.text.split("\n").map((line, j) => <Fragment key={j}>{j > 0 && <br />}{inline(line)}</Fragment>)}</p>;
      })}
    </div>
  );
}
