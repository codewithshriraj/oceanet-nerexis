'use client';

import { useEffect, useMemo, useState } from 'react';

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

const MAX_PREVIEW_LINES = 5000;
const INITIAL_VISIBLE_BLOCKS = 240;
const LOAD_MORE_BLOCKS = 240;

function parseMarkdownLike(content: string): { blocks: Block[]; truncated: boolean } {
  const allLines = String(content || '').split(/\r?\n/);
  const lines = allLines.slice(0, MAX_PREVIEW_LINES);
  const truncated = allLines.length > MAX_PREVIEW_LINES;
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };

  const flushLists = () => {
    if (ul.length) {
      blocks.push({ type: 'ul', items: [...ul] });
      ul = [];
    }
    if (ol.length) {
      blocks.push({ type: 'ol', items: [...ol] });
      ol = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushLists();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      ol = [];
      ul.push(line.replace(/^-\s+/, '').trim());
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      ul = [];
      ol.push(line.replace(/^\d+\.\s+/, '').trim());
      continue;
    }

    flushLists();
    paragraph.push(line);
  }

  flushParagraph();
  flushLists();
  if (truncated) {
    blocks.push({
      type: 'p',
      text: 'Preview truncated for performance. Download the full report (PDF, Word, or TXT) to view complete content.',
    });
  }

  return { blocks, truncated };
}

export default function ReportContentRenderer({ content }: { content: string }) {
  const parsed = useMemo(() => parseMarkdownLike(content), [content]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_BLOCKS);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_BLOCKS);
  }, [content]);

  const visibleBlocks = parsed.blocks.slice(0, visibleCount);
  const hasMore = parsed.blocks.length > visibleCount;

  return (
    <div className="space-y-4 text-text-secondary leading-7 text-sm">
      {visibleBlocks.map((block, index) => {
        if (block.type === 'h1') {
          return <h2 key={`h1-${index}`} className="text-2xl font-bold text-text-primary pt-2">{block.text}</h2>;
        }
        if (block.type === 'h2') {
          return <h3 key={`h2-${index}`} className="text-xl font-bold text-text-primary pt-2">{block.text}</h3>;
        }
        if (block.type === 'h3') {
          return <h4 key={`h3-${index}`} className="text-base font-semibold text-text-primary pt-1">{block.text}</h4>;
        }
        if (block.type === 'ul') {
          return (
            <ul key={`ul-${index}`} className="list-disc pl-5 space-y-1">
              {block.items.map((item, idx) => <li key={`li-${index}-${idx}`}>{item}</li>)}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={`ol-${index}`} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, idx) => <li key={`oi-${index}-${idx}`}>{item}</li>)}
            </ol>
          );
        }
        return <p key={`p-${index}`}>{block.text}</p>;
      })}

      {hasMore && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + LOAD_MORE_BLOCKS)}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            Load More Report Content
          </button>
        </div>
      )}

      {parsed.truncated && !hasMore && (
        <p className="text-xs text-text-muted">
          Preview is intentionally truncated to keep the page responsive.
        </p>
      )}
    </div>
  );
}
