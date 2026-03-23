function normalizeSpaces(s: string) {
  return (s ?? "").replace(/[^\S\r\n]+/g, " ").trim();
}

export function stripHtml(html: string) {
  // Preserve newlines but collapse horizontal whitespace
  const clean = (html ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|ul|ol|blockquote|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  
  return clean.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

/**
 * Cheap token estimate (good enough for chunk sizing).
 */
export function estimateTokens(text: string) {
  const t = text || "";
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
  const raw = html ?? "";

  // Replace headings with sentinel lines
  let withSentinels = raw
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n[[H1]] $1 \n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n[[H2]] $1 \n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n[[H3]] $1 \n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n[[H4]] $1 \n");

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
  chunkIndex: number;
};

export function chunkArticleHtml(args: {
  html: string;
  maxTokens?: number;   
  overlapTokens?: number;
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
    chunks.push({ headingPath: [...headingPath], text, chunkIndex: order++ });
  };

  const resetBufferWithOverlap = () => {
    if (overlapTokens > 0 && buffer.length) {
      const joined = buffer.join("\n");
      const words = joined.split(/\s+/).filter(Boolean);
      const keepWords = Math.max(30, Math.round(overlapTokens * 1.3));
      const overlapText = words.slice(-keepWords).join(" ").trim();

      if (overlapText) {
        buffer = [overlapText];
        bufferTokens = estimateTokens(overlapText);
        return;
      }
    }

    buffer = [];
    bufferTokens = 0;
  };

  const pushText = (text: string) => {
    const t = normalizeSpaces(text);
    if (!t) return;

    if (t.length > 20000) {
      console.warn("CHUNK_ENGINE: Large block detected, forcing split", { length: t.length });
    }

    const tok = estimateTokens(t);

    // If a single block is huge, split it
    if (tok > maxTokens) {
      const parts = t.split(/(?<=[.?!])\s+/).filter(Boolean);

      // 🔒 HARD STOP: if splitting by sentences doesn't work, iterative slicing with boundary logic
      if (parts.length === 1) {
        const words = t.split(/\s+/).filter(Boolean);
        const chunkSizeInWords = 100;

        for (let i = 0; i < words.length; i += chunkSizeInWords) {
          const slice = words.slice(i, i + chunkSizeInWords).join(" ");
          if (!slice) continue;
          
          const sliceTok = estimateTokens(slice);

          // Boundary check for the current slice
          if (bufferTokens + sliceTok > maxTokens && buffer.length) {
            flush();
            resetBufferWithOverlap();
          }

          buffer.push(slice);
          bufferTokens += sliceTok;
        }
        return;
      }

      for (const p of parts) {
        if (p === t) continue; // 🔒 recursion safety
        pushText(p);
      }
      return;
    }

    // Standard chunk-boundary logic
    if (bufferTokens + tok > maxTokens && buffer.length) {
      flush();
      resetBufferWithOverlap();
    }

    buffer.push(t);
    bufferTokens += tok;
  };

  for (const b of blocks) {
    if (b.kind === "heading") {
      if (buffer.length) {
        flush();
        buffer = [];
        bufferTokens = 0;
      }

      const lvl = b.level ?? 2;
      const idx = Math.max(0, lvl - 1);
      headingPath = headingPath.slice(0, idx);
      headingPath[idx] = b.text;
      continue;
    }

    pushText(b.text);
  }

  if (buffer.length) flush();

  return chunks.filter(c => c.text.length >= 80);
}
