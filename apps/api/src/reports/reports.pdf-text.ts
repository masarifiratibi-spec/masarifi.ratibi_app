import bidiFactory, { type EmbeddingLevels } from 'bidi-js';

const bidi = bidiFactory();
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function visualRuns(
  text: string,
  embedding: EmbeddingLevels,
  start: number,
  end: number,
): string[] {
  const indices = bidi.getReorderedIndices(text, embedding, start, end).slice(start, end + 1);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding.levels, start, end);
  const groups: Array<{ level: number; indices: number[] }> = [];
  for (const index of indices) {
    const level = embedding.levels[index] ?? 0;
    const previous = groups.at(-1);
    const previousIndex = previous?.indices.at(-1);
    const step = level & 1 ? -1 : 1;
    if (
      previous &&
      previousIndex !== undefined &&
      previous.level === level &&
      previousIndex + step === index
    )
      previous.indices.push(index);
    else groups.push({ level, indices: [index] });
  }
  return groups.map((group) => {
    // Fontkit shapes and reverses an Arabic run when PDFKit's word cache is bypassed.
    // Other runs are already in visual order, including Latin currency values.
    const logical = [...group.indices]
      .sort((left, right) => left - right)
      .map((index) => mirrored.get(index) ?? text[index] ?? '')
      .join('');
    if (group.level & 1 && /\p{Script=Arabic}/u.test(logical)) return logical;
    const visual = group.indices.map((index) => mirrored.get(index) ?? text[index] ?? '').join('');
    // Fontkit also infers RTL for Arabic-Indic digit-only runs, although Unicode
    // resolves their numbers LTR. Compensate before shaping; keep their glyphs.
    return !(group.level & 1) && /[٠-٩۰-۹]/u.test(visual) && !/\p{Letter}/u.test(visual)
      ? Array.from(graphemeSegmenter.segment(visual), (entry) => entry.segment)
          .reverse()
          .join('')
      : visual;
  });
}

export function layoutPdfText(
  text: string,
  width: number,
  measure: (run: string) => number,
): string[][] {
  if (!Number.isFinite(width) || width <= 0) throw new Error('REPORT_PDF_WIDTH_INVALID');
  return text
    .replaceAll('\t', ' ')
    .split(/\r\n|\r|\n/u)
    .flatMap((paragraph) => {
      const embedding = bidi.getEmbeddingLevels(paragraph);
      const whole = paragraph ? visualRuns(paragraph, embedding, 0, paragraph.length - 1) : [];
      if (whole.reduce((sum, run) => sum + measure(run), 0) <= width) return [whole];
      const characters = [...graphemeSegmenter.segment(paragraph)];
      const lines: string[][] = [];
      let first = 0,
        cursor = 0,
        lastSpace = -1;
      const runs = (from: number, through: number) => {
        while (from <= through && /\s/u.test(characters[from]?.segment ?? '')) from++;
        while (through >= from && /\s/u.test(characters[through]?.segment ?? '')) through--;
        if (from > through) return [];
        const firstCharacter = characters[from];
        const lastCharacter = characters[through];
        if (!firstCharacter || !lastCharacter) throw new Error('REPORT_PDF_LINE_INVALID');
        const start = firstCharacter.index;
        const end = lastCharacter.index + lastCharacter.segment.length - 1;
        return visualRuns(paragraph, embedding, start, end);
      };
      while (cursor < characters.length) {
        const candidate = runs(first, cursor);
        if (candidate.reduce((sum, run) => sum + measure(run), 0) > width) {
          if (lastSpace >= first) {
            lines.push(runs(first, lastSpace - 1));
            first = lastSpace + 1;
          } else if (cursor > first) {
            lines.push(runs(first, cursor - 1));
            first = cursor;
          } else throw new Error('REPORT_PDF_GLYPH_TOO_WIDE');
          cursor = first;
          lastSpace = -1;
        } else {
          if (/\s/u.test(characters[cursor]?.segment ?? '')) lastSpace = cursor;
          cursor++;
        }
      }
      if (first < characters.length) lines.push(runs(first, characters.length - 1));
      return lines.length ? lines : [[]];
    });
}

export function pdfTextHeight(document: PDFKit.PDFDocument, text: string, width: number): number {
  const lines = layoutPdfText(text, width, (run) => document.widthOfString(run, { features: [] }));
  return lines.length * document.currentLineHeight(true);
}

export function drawPdfText(
  document: PDFKit.PDFDocument,
  text: string,
  box: { x: number; y: number; width: number; align?: 'left' | 'right' | 'center' },
): void {
  const measure = (run: string) => document.widthOfString(run, { features: [] });
  const lines = layoutPdfText(text, box.width, measure);
  const lineHeight = document.currentLineHeight(true);
  lines.forEach((runs, index) => {
    const used = runs.reduce((sum, run) => sum + measure(run), 0);
    let x =
      box.x +
      (box.align === 'left'
        ? 0
        : box.align === 'center'
          ? (box.width - used) / 2
          : box.width - used);
    for (const run of runs) {
      document.text(run, x, box.y + index * lineHeight, { lineBreak: false, features: [] });
      x += measure(run);
    }
  });
  document.x = box.x;
  document.y = box.y + lines.length * lineHeight;
}
