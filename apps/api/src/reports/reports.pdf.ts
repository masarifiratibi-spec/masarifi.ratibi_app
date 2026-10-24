import type { ReportSnapshot } from './reports.schemas';
import { drawPdfText, pdfTextHeight } from './reports.pdf-text';
import {
  buildReportPdfSections,
  PDF_REPORT_TITLES,
  type PdfReportSection,
} from './reports.pdf-content';

export async function writeReportPdf(
  document: PDFKit.PDFDocument,
  snapshot: ReportSnapshot,
): Promise<void> {
  let page = 0;
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const pageHeader = () => {
    page++;
    document.fontSize(10).fillColor('#155E55');
    drawPdfText(document, 'Masarifi', { x: left, y: 28, width: width / 3, align: 'left' });
    drawPdfText(document, String(page), {
      x: left + width / 3,
      y: 28,
      width: width / 3,
      align: 'center',
    });
    drawPdfText(document, 'مصاريفي', { x: left + (width * 2) / 3, y: 28, width: width / 3 });
    document.y = 62;
    document.x = left;
    document.fillColor('#162C29');
  };
  document.on('pageAdded', pageHeader);
  pageHeader();
  const line = (text: string) => {
    drawPdfText(document, text, { x: left, y: document.y, width });
  };
  document.fontSize(18);
  line(PDF_REPORT_TITLES[snapshot.reportType]);
  document.moveDown(0.5).fontSize(10);
  line(`${snapshot.period.startDate} - ${snapshot.period.endDate}`);
  line(snapshot.period.timezone);
  const states: Record<ReportSnapshot['dataState'], string> = {
    complete: 'بيانات مكتملة',
    empty: 'لا توجد بيانات في الفترة المحددة',
    partial: 'بيانات جزئية',
    estimated: 'يتضمن التقرير بيانات تقديرية',
  };
  line(states[snapshot.dataState]);
  document.moveDown();
  for (const section of buildReportPdfSections(snapshot)) await drawTable(document, section);
}

async function drawTable(document: PDFKit.PDFDocument, section: PdfReportSection): Promise<void> {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const fractions =
    section.columns.length === 2
      ? [0.55, 0.45]
      : section.columns.length === 3
        ? [0.5, 0.3, 0.2]
        : [0.23, 0.17, 0.3, 0.3];
  const widths = fractions.map((fraction) => fraction * width);
  const bottom = () => document.page.height - document.page.margins.bottom;
  const heading = () => {
    document.fontSize(12).fillColor('#155E55');
    drawPdfText(document, section.title, { x: left, y: document.y, width });
    document.moveDown(0.35);
  };
  const row = (cells: readonly string[], header: boolean) => {
    document.fontSize(9);
    const height = Math.max(
      24,
      ...cells.map(
        (cell, index) => pdfTextHeight(document, cell, (widths[index] ?? width) - 14) + 12,
      ),
    );
    if (height > document.page.height - 130 - document.page.margins.bottom)
      throw new Error('REPORT_PDF_ROW_TOO_LARGE');
    if (document.y + height > bottom()) {
      document.addPage();
      heading();
      if (!header) row(section.columns, true);
    }
    document.fontSize(9);
    const top = document.y;
    let right = left + width;
    cells.forEach((cell, index) => {
      const cellWidth = widths[index] ?? width;
      right -= cellWidth;
      if (header) document.save().rect(right, top, cellWidth, height).fill('#E6F0ED').restore();
      document.fillColor('#162C29');
      drawPdfText(document, cell, { x: right + 7, y: top + 6, width: cellWidth - 14 });
    });
    document
      .save()
      .strokeColor('#D5E0DC')
      .lineWidth(0.4)
      .moveTo(left, top + height)
      .lineTo(left + width, top + height)
      .stroke()
      .restore();
    document.x = left;
    document.y = top + height;
  };
  if (document.y + 80 > bottom()) document.addPage();
  heading();
  row(section.columns, true);
  let drawn = 0;
  for (const cells of section.rows) {
    if (document.destroyed) throw new Error('REPORT_RENDER_CANCELLED');
    row(cells, false);
    if (++drawn % 32 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
  }
  document.y += 18;
}
