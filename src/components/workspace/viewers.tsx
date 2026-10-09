"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { CaretDown, CaretRight, DownloadSimple, FileDashed, ImageBroken, WarningCircle } from "@phosphor-icons/react";
import { parseBlocks } from "./markdown-parse";
import { formatBytes, linkKind, parseDelimited, resolveRelative } from "./file-kinds";
import ui from "./ui.module.css";

type DocLinks = { path: string; rawUrl: (path: string) => string; onOpenPath: (path: string) => void };

function richInline(text: string, links: DocLinks): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^>\s]+)>|(`+)([^`]+?)\6|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*\s][^*]*)\*|(?<![\w])_([^_\s][^_]*)_(?![\w])/g;
  let last = 0;
  let key = 0;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      const kind = linkKind(match[2]);
      const target = kind === "workspace" ? resolveRelative(links.path, match[2]) : null;
      if (target) out.push(<img key={key++} src={links.rawUrl(target)} alt={match[1]} className={ui.docImage} loading="lazy" />);
      else if (kind === "external") out.push(<a key={key++} href={match[2]} target="_blank" rel="noreferrer noopener" className={ui.docLink}>{match[1] || match[2]}</a>);
      else out.push(<span key={key++} className={ui.faint}>{match[1]}</span>);
    } else if (match[4] !== undefined) {
      const kind = linkKind(match[4]);
      const label = richInline(match[3], links);
      const target = kind === "workspace" ? resolveRelative(links.path, match[4]) : null;
      if (kind === "external") out.push(<a key={key++} href={match[4]} target="_blank" rel="noreferrer noopener" className={ui.docLink}>{label}</a>);
      else if (target) out.push(<button key={key++} type="button" className={ui.docLinkBtn} onClick={() => links.onOpenPath(target)} title={target}>{label}</button>);
      else out.push(<Fragment key={key++}>{label}</Fragment>);
    } else if (match[5] !== undefined) out.push(<a key={key++} href={match[5]} target="_blank" rel="noreferrer noopener" className={ui.docLink}>{match[5]}</a>);
    else if (match[7] !== undefined) out.push(<code key={key++} className={ui.mdCode}>{match[7]}</code>);
    else if (match[8] !== undefined || match[9] !== undefined) out.push(<strong key={key++} style={{ color: "var(--w-head)", fontWeight: 600 }}>{richInline(match[8] ?? match[9], links)}</strong>);
    else if (match[10] !== undefined) out.push(<del key={key++}>{richInline(match[10], links)}</del>);
    else if (match[11] !== undefined || match[12] !== undefined) out.push(<em key={key++}>{richInline(match[11] ?? match[12], links)}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ListItem({ text, links }: { text: string; links: DocLinks }) {
  const task = text.match(/^\[([ xX])\]\s+(.*)$/);
  if (!task) return <li>{richInline(text, links)}</li>;
  return (
    <li className={ui.docTask}>
      <input type="checkbox" checked={task[1] !== " "} readOnly disabled className={ui.check} aria-label={task[1] !== " " ? "Done" : "Not done"} />
      <span>{richInline(task[2], links)}</span>
    </li>
  );
}

export function MarkdownDoc({ text, path, rawUrl, onOpenPath }: { text: string } & DocLinks) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const links = { path, rawUrl, onOpenPath };
  return (
    <div className={ui.scroll}>
      <article className={ui.doc} data-el="markdown-view">
        {blocks.map((block, i) => {
          if (block.kind === "code") return <pre key={i} className={ui.docPre} data-lang={block.lang || undefined}><code>{block.text}</code></pre>;
          if (block.kind === "heading") {
            const Tag = `h${Math.min(6, block.level)}` as "h1";
            return <Tag key={i}>{richInline(block.text, links)}</Tag>;
          }
          if (block.kind === "quote") return <blockquote key={i}>{block.text.split("\n").map((line, j) => <Fragment key={j}>{j > 0 && <br />}{richInline(line, links)}</Fragment>)}</blockquote>;
          if (block.kind === "hr") return <hr key={i} />;
          if (block.kind === "list") {
            const List = block.ordered ? "ol" : "ul";
            return <List key={i}>{block.items.map((item, j) => <ListItem key={j} text={item} links={links} />)}</List>;
          }
          if (block.kind === "table") {
            return (
              <div key={i} className={ui.mdTableWrap}>
                <table className={ui.mdTable}>
                  <thead><tr>{block.header.map((cell, j) => <th key={j} style={{ textAlign: block.align[j] ?? undefined }}>{richInline(cell, links)}</th>)}</tr></thead>
                  <tbody>{block.rows.map((row, r) => <tr key={r}>{block.header.map((_, j) => <td key={j} style={{ textAlign: block.align[j] ?? undefined }}>{richInline(row[j] ?? "", links)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
          return <p key={i}>{block.text.split("\n").map((line, j) => <Fragment key={j}>{j > 0 && <br />}{richInline(line, links)}</Fragment>)}</p>;
        })}
        {!blocks.length && <p className={ui.faint}>This file is empty.</p>}
      </article>
    </div>
  );
}

const MAX_TABLE_ROWS = 2000;

export function DelimitedTable({ text, delimiter }: { text: string; delimiter: string }) {
  const { rows, truncated } = useMemo(() => parseDelimited(text, delimiter, MAX_TABLE_ROWS + 1), [text, delimiter]);
  const [header, ...body] = rows;
  const shown = body.slice(0, MAX_TABLE_ROWS);
  const total = useMemo(() => (truncated || body.length > MAX_TABLE_ROWS ? parseDelimited(text, delimiter).rows.length - 1 : body.length), [text, delimiter, truncated, body.length]);
  if (!header) return <Placeholder icon={<FileDashed size={18} />} title="This file is empty" />;
  const columns = Math.max(header.length, ...shown.map((r) => r.length));
  return (
    <div className={ui.panelBody} data-el="table-view">
      <div className={ui.viewerMeta}>
        <span><b>{total.toLocaleString("en-US")}</b> {total === 1 ? "row" : "rows"}</span>
        <span><b>{columns}</b> {columns === 1 ? "column" : "columns"}</span>
        {total > shown.length && <span className={ui.faint}>showing the first {shown.length.toLocaleString("en-US")}</span>}
      </div>
      <div className={ui.tableScroll}>
        <table className={ui.dataTable}>
          <thead>
            <tr>
              <th className={ui.rowNo} aria-label="Row" />
              {Array.from({ length: columns }, (_, j) => <th key={j} title={header[j]}>{header[j] ?? ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r}>
                <td className={ui.rowNo}>{r + 1}</td>
                {Array.from({ length: columns }, (_, j) => <td key={j} title={row[j] && row[j].length > 40 ? row[j] : undefined} className={row[j] !== undefined && /^-?\d+([.,]\d+)?$/.test(row[j].trim()) ? ui.num : undefined}>{row[j] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const MAX_CHILDREN = 200;

function JsonValue({ value }: { value: Json }) {
  if (value === null) return <span className={ui.jsonNull}>null</span>;
  if (typeof value === "string") return <span className={ui.jsonString}>&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className={ui.jsonNumber}>{String(value)}</span>;
  if (typeof value === "boolean") return <span className={ui.jsonBool}>{String(value)}</span>;
  return null;
}

function JsonNode({ name, value, depth, last }: { name: string | null; value: Json; depth: number; last: boolean }) {
  const branch = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < 2);
  const [limit, setLimit] = useState(MAX_CHILDREN);
  const label = name !== null && <><span className={ui.jsonKey}>{name}</span><span className={ui.faint}>: </span></>;
  if (!branch) {
    return <div className={ui.jsonRow} style={{ paddingLeft: depth * 16 + 18 }}>{label}<JsonValue value={value} />{!last && <span className={ui.faint}>,</span>}</div>;
  }
  const isArray = Array.isArray(value);
  const entries: [string, Json][] = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  const [openMark, closeMark] = isArray ? ["[", "]"] : ["{", "}"];
  return (
    <>
      <button type="button" className={`${ui.jsonRow} ${ui.jsonToggle}`} style={{ paddingLeft: depth * 16 }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={ui.treeIcon}>{open ? <CaretDown size={11} weight="bold" /> : <CaretRight size={11} weight="bold" />}</span>
        {label}
        <span className={ui.faint}>{openMark}</span>
        {!open && <><span className={ui.jsonSummary}>{entries.length} {isArray ? (entries.length === 1 ? "item" : "items") : entries.length === 1 ? "key" : "keys"}</span><span className={ui.faint}>{closeMark}{!last && ","}</span></>}
      </button>
      {open && (
        <>
          {entries.slice(0, limit).map(([key, child], i) => <JsonNode key={key} name={isArray ? null : JSON.stringify(key)} value={child} depth={depth + 1} last={i === entries.length - 1} />)}
          {entries.length > limit && (
            <button type="button" className={`${ui.jsonRow} ${ui.jsonMore}`} style={{ paddingLeft: (depth + 1) * 16 + 18 }} onClick={() => setLimit((n) => n + MAX_CHILDREN)}>
              Show {Math.min(MAX_CHILDREN, entries.length - limit)} more of {entries.length - limit}
            </button>
          )}
          <div className={ui.jsonRow} style={{ paddingLeft: depth * 16 + 18 }}><span className={ui.faint}>{closeMark}{!last && ","}</span></div>
        </>
      )}
    </>
  );
}

export function JsonTree({ text }: { text: string }) {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as Json };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "invalid JSON" };
    }
  }, [text]);
  if (!parsed.ok) {
    return (
      <Placeholder icon={<WarningCircle size={18} />} title="This JSON does not parse">
        <span className={ui.mono} style={{ fontSize: 11.5 }}>{parsed.message}</span>
        <span>Switch to the source view to see the text.</span>
      </Placeholder>
    );
  }
  return (
    <div className={`${ui.scroll} ${ui.jsonTree}`} data-el="json-view">
      <JsonNode name={null} value={parsed.value} depth={0} last />
    </div>
  );
}

export function ImageView({ src, name, size }: { src: string; name: string; size?: number }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return <Placeholder icon={<ImageBroken size={18} />} title="This image could not be shown">{size !== undefined && <span>{formatBytes(size)}</span>}</Placeholder>;
  return (
    <div className={ui.panelBody} data-el="image-view">
      <div className={ui.viewerMeta}>
        {dims && <span><b>{dims.w}</b> × <b>{dims.h}</b> px</span>}
        {size !== undefined && <span>{formatBytes(size)}</span>}
      </div>
      <div className={ui.imageStage}>
        <img src={src} alt={name} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => setFailed(true)} />
      </div>
    </div>
  );
}

export function PdfView({ src, name }: { src: string; name: string }) {
  return (
    <div className={ui.panelBody} data-el="pdf-view">
      <iframe title={name} src={src} className={ui.pdfFrame} />
    </div>
  );
}

export function Placeholder({ icon, title, children, download }: { icon: ReactNode; title: string; children?: ReactNode; download?: string }) {
  return (
    <div className={ui.empty}>
      <div className={ui.emptyInner}>
        <span className={ui.emptyIcon}>{icon}</span>
        <span style={{ color: "var(--w-fg)", fontWeight: 500, fontSize: 13 }}>{title}</span>
        {children}
        {download && (
          <a className={`${ui.btn} ${ui.btnSm}`} href={download} download>
            <DownloadSimple size={13} /> Download
          </a>
        )}
      </div>
    </div>
  );
}
