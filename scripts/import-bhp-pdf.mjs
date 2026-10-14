import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const source = process.argv[2] || 'C:/Users/ACER/Downloads/SC BHP NEW.pdf';
const bytes = await fs.readFile(source);
const loading = getDocument({ data: new Uint8Array(bytes) });
const pdf = await loading.promise;
const items = [];
const bounds = [55, 84, 143, 202, 349, 389, 433, 474, 512, 556, 587, 619, 685, 729, 758, 789];
const price = text => {
  assert(/^\d[\d.]*,\d{2}$/.test(text), `Invalid source price: ${text}`);
  return Number(text.replaceAll('.', '').replace(',', '.'));
};
await fs.mkdir('public/bhp/catalog', { recursive: true });
try {
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const text = (await page.getTextContent()).items.filter(item => item.str.trim());
    const anchors = text.filter(item => item.transform[4] < 82 && /^\d+$/.test(item.str)).sort((a, b) => b.transform[5] - a.transform[5]);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    for (let i = 0; i < anchors.length; i++) {
      const y = anchors[i].transform[5];
      const top = i ? (anchors[i - 1].transform[5] + y) / 2 : y + (y - anchors[i + 1].transform[5]) / 2;
      const bottom = i + 1 < anchors.length ? (y + anchors[i + 1].transform[5]) / 2 : y - (anchors[i - 1].transform[5] - y) / 2;
      const row = text.filter(item => item.transform[5] < top && item.transform[5] > bottom);
      const cells = bounds.slice(0, -1).map((left, c) => row.filter(item => item.transform[4] >= left && item.transform[4] < bounds[c + 1]).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]).map(item => item.str.trim()).join(' ').replace(/\s+/g, ' '));
      // Page 5 combines stock code + part number in one PDF text run.
      const merged = cells[1].match(/^(\d{5})\s*(IPN-BHP-\d{5})$/);
      if (merged) { cells[1] = merged[1]; cells[2] = merged[2]; }
      assert(cells[3] && cells[4] && cells[5]);
      assert(!cells[1] || /^\d{5}$/.test(cells[1]));
      assert(!cells[2] || /^IPN-BHP-\d{5}$/.test(cells[2]));
      const code = cells[1] || `PDF-BHP-${String(cells[0]).padStart(3, '0')}`;
      const crop = createCanvas(Math.round(29 * 3), Math.max(1, Math.round((top - bottom - 1) * 3)));
      const [x, cropY] = viewport.convertToViewportPoint(759, top - 0.5);
      crop.getContext('2d').drawImage(canvas, x, cropY, crop.width, crop.height, 0, 0, crop.width, crop.height);
      await fs.writeFile(`public/bhp/catalog/${code}.png`, crop.toBuffer('image/png'));
      items.push({
        id: code, code, stock_code: cells[1] || null, part_number: cells[2] || null,
        name: cells[3], mnemonic: cells[4], category: cells[7], unit: cells[5].toLowerCase(),
        pack_qty: 1, pack_unit: cells[5], default_abc: 'C', default_safety_pct: 5,
        stock_class: cells[6], stock_type: cells[7], equipment_id: cells[8],
        qty_install: Number(cells[9]), repairable: cells[10], coa: cells[11],
        price_est: price(cells[12]), price_usd: price(cells[13]),
        remarks: cells[1] ? '' : 'Stock Code dan Part Number belum tercantum pada PDF sumber.',
        image_url: `/bhp/catalog/${code}.png`, source_page: n, source_no: cells[0]
      });
    }
  }
  assert.equal(items.length, 138);
  assert.equal(new Set(items.map(item => item.code)).size, items.length);
  assert.equal(items.filter(item => !item.stock_code).length, 2);
  assert.equal(items[0].name, 'AIR MINERAL, BOTOL; SIZE 330 ML; PACK 24PCS');
  assert.equal(items.at(-1).stock_code, '43998');
  await fs.writeFile('src/data/bhpItemsPdf.json', JSON.stringify(items, null, 2) + '\n');
  await fs.writeFile('src/data/bhpCatalogSource.json', JSON.stringify({ version: 'sc-bhp-new-2026-09-17', filename: 'SC BHP NEW.pdf', registration: 'AGM240901', date: '2026-09-17', district: 'BM06', site: 'LBR1', pages: pdf.numPages, count: items.length, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n');
  console.log(JSON.stringify({ items: items.length, missingCodes: items.filter(item => !item.stock_code).map(item => item.source_no), category: [...new Set(items.map(item => item.category))] }));
} finally { await loading.destroy(); }
