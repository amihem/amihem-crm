// pdfLines.js — read a text-based PDF into text lines (rows rebuilt from the
// positions of each text fragment). Loaded on demand so pdf.js only
// downloads when someone actually uploads a PDF.

export async function pdfToLines(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ s: it.str.trim(), x: it.transform[4], y: it.transform[5] }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = [];
    let curY = null;
    const flush = () => {
      if (cur.length) lines.push(cur.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
      cur = [];
    };
    for (const it of items) {
      if (curY === null || Math.abs(curY - it.y) > 3) { flush(); curY = it.y; }
      cur.push(it);
    }
    flush();
  }
  return lines;
}
