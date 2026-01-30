
function normalizeSpaces(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function stripHtml(html: string) {
  return normalizeSpaces(
    (html ?? "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|h4|li|ul|ol|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

/**
 * Cheap token estimate (good enough for chunk sizing).
 * Later you can swap to a real tokenizer.
 */
export function estimateTokens(text: string) {
  const t = normalizeSpaces(text);
  if (!t) return 0;
  // rule of thumb: ~4 chars/token in English
  return Math.ceil(t.length / 4);
}

type Block = {
  kind: "heading" | "text";
  level?: number;
  text: string;
};

function extractBlocksFromHtml(html: string): Block[] {
  // We’ll “preserve” headings via regex before stripping everything.
  // This is not a perfect HTML parser, but works well for typical rich-text output.
  const raw = html ?? "";

  // Replace headings with sentinel lines
  let withSentinels = raw
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n[[H1]] $1 \n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n[[H2]] $1 \n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n[[H3]] $1 \n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n[[H4]] $1 \n");

  // Now strip remaining tags, keeping newlines
  const plain = stripHtml(withSentinels);

  const lines = plain
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  for (const line of lines) {
    const m = line.match(/^\[\[H([1-4])\]\]\s*(.*)$/);
    if (m) {
      const level = Number(m[1]);
      const text = normalizeSpaces(m[2]);
      if (text) blocks.push({ kind: "heading", level, text });
    } else {
      const text = normalizeSpaces(line);
      if (text) blocks.push({ kind: "text", text });
    }
  }

  // Merge consecutive text blocks that are tiny
  const merged: Block[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (b.kind === "text" && last?.kind === "text" && (last.text.length < 140 || b.text.length < 140)) {
      last.text = normalizeSpaces(`${last.text}\n${b.text}`);
    } else {
      merged.push({ ...b });
    }
  }

  return merged;
}

export type ChunkSpec = {
  headingPath: string[];
  text: string;
  order: number;
};

export function chunkArticleHtml(args: {
  html: string;
  maxTokens?: number;   // default 220
  overlapTokens?: number; // default 60
}) : ChunkSpec[] {
  const maxTokens = args.maxTokens ?? 220;
  const overlapTokens = args.overlapTokens ?? 60;

  const blocks = extractBlocksFromHtml(args.html);

  const chunks: ChunkSpec[] = [];
  let headingPath: string[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let order = 0;

  const flush = () => {
    const text = normalizeSpaces(buffer.join("\n"));
    if (!text) return;
    chunks.push({ headingPath: [...headingPath], text, order: order++ });
  };

  const pushText = (text: string) => {
    const t = normalizeSpaces(text);
    if (!t) return;

    const tok = estimateTokens(t);

    // if a single block is huge, split it by sentences-ish
    if (tok > maxTokens) {
      const parts = t.split(/(?<=[.?!])\s+/).filter(Boolean);
      for (const p of parts) pushText(p);
      return;
    }

    // If adding would exceed limit, flush current chunk with overlap
    if (bufferTokens + tok > maxTokens && buffer.length) {
      flush();

      // overlap: keep last N tokens worth of text in buffer
      if (overlapTokens > 0) {
        const joined = buffer.join("\n");
        const words = joined.split(/\s+/);
        // approx tokens ~ words*0.75 (very rough); we’ll just keep last X words
        const keepWords = Math.max(30, Math.round(overlapTokens * 1.3));
        buffer = [words.slice(-keepWords).join(" ")];
        bufferTokens = estimateTokens(buffer[0]);
      } else {
        buffer = [];
        bufferTokens = 0;
      }
    }

    buffer.push(t);
    bufferTokens += tok;
  };

  for (const b of blocks) {
    if (b.kind === "heading") {
      // Flush before changing heading context
      if (buffer.length) {
        flush();
        buffer = [];
        bufferTokens = 0;
      }

      // Update heading path based on level
      const lvl = b.level ?? 2;
      const idx = Math.max(0, lvl - 1);
      headingPath = headingPath.slice(0, idx);
      headingPath[idx] = b.text;
      continue;
    }

    pushText(b.text);
  }

  if (buffer.length) flush();

  // Drop extremely tiny chunks
  return chunks.filter(c => c.text.length >= 80);
}
