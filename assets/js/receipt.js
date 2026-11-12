/**
 * receipt.js
 * -----------------------------------------------------------------------
 * Structured payment receipt with the school logo.
 * Self-contained: the receipt carries its own stylesheet, so the on-screen
 * view and the printed copy are identical and never depend on styles.css
 * loading inside a print window.
 *
 * Receipt.cardHtml(model)  -> HTML for one receipt
 * Receipt.ensureStyles()   -> injects the stylesheet into the current page
 * Receipt.print(html)      -> prints one or more receipts (3 per A4 landscape)
 *
 * model = {
 *   school: { name, motto, logo, phone, email },
 *   student: { id, name, className, academicYear, photo },
 *   rows: [{ label, amount, date }],
 *   currency, totalPaid, totalBilled, balance,
 *   format: (amount, currency) => string
 * }
 * -----------------------------------------------------------------------
 */
const Receipt = (function () {

  const SCHOOL_NAME = 'Sorina Daycare, Elementary and Junior High School';
  const SCHOOL_ADDRESS = 'Upper Paynesville, Bernard Farm, Doe Estate, Montserrado County - Liberia';

  const CSS = `
    .rcptGrid, .rcptGrid *, .rcpt, .rcpt * { box-sizing: border-box; }
    .rcptGrid { display: flex; flex-wrap: wrap; gap: 6mm; justify-content: center; align-items: flex-start; }
    .rcpt { font-family: 'Courier New', Courier, monospace; width: 80mm; background: #fbfbfa; color: #222; padding: 7mm 6mm 8mm; position: relative; break-inside: avoid; page-break-inside: avoid; border: 0.2mm solid #d8d8d4; }
    @media screen { .rcpt { border: 0; box-shadow: 0 2px 10px rgba(0,0,0,.25); filter: none; } }
    .rcpt-c { text-align: center; }
    .rcpt-logo { width: 17mm; height: 17mm; object-fit: contain; display: block; margin: 0 auto 2mm; }
    .rcpt-school { font-weight: 700; font-size: 12.5px; line-height: 1.25; text-transform: uppercase; }
    .rcpt-addr { font-size: 9.5px; line-height: 1.3; margin-top: 1mm; }
    .rcpt-title { font-size: 16px; font-weight: 700; letter-spacing: 1.5px; margin: 3.5mm 0 2mm; }
    .rcpt-dash { border: 0; border-top: 0.35mm dashed #444; margin: 2.5mm 0; }
    .rcpt-solid { border: 0; border-top: 0.35mm solid #444; margin: 2mm 0; }
    .rcpt-line { display: flex; justify-content: space-between; gap: 3mm; font-size: 11px; line-height: 1.5; }
    .rcpt-line span:last-child { text-align: right; }
    .rcpt-items .rcpt-line { font-size: 11.5px; padding: 0.4mm 0; }
    .rcpt-items .rcpt-sub { display: block; font-size: 8.5px; color: #666; }
    .rcpt-items .rcpt-line span:last-child { white-space: nowrap; }
    .rcpt-empty { text-align: center; font-size: 10.5px; color: #666; padding: 3mm 0; }
    .rcpt-total { display: flex; justify-content: space-between; align-items: baseline; font-size: 17px; font-weight: 700; margin: 1mm 0; }
    .rcpt-bal-due { color: #b42318; }
    .rcpt-bal-ok { color: #067647; }
    .rcpt-status { text-align: center; font-weight: 700; font-size: 11px; letter-spacing: 1px; margin: 2.5mm 0 0; }
    .rcpt-thanks { text-align: center; font-size: 19px; letter-spacing: 1px; margin: 5mm 0 3mm; }
    .rcpt-barcode { display: block; margin: 0 auto; width: 100%; height: 13mm; }
    .rcpt-no { text-align: center; font-size: 9px; letter-spacing: 2px; margin-top: 1mm; }
    .rcpt-foot { text-align: center; font-size: 8px; color: #777; margin-top: 3mm; line-height: 1.3; }
  `;

  const PRINT_CSS = `
    @page { size: A4 landscape; margin: 6mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .rcptGrid { justify-content: flex-start; gap: 6mm; }
    .rcpt { border: 0.2mm solid #bbb; }
    .rcpt:nth-child(3n+1) { break-before: page; page-break-before: always; }
    .rcpt:first-child { break-before: auto; page-break-before: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function receiptNo(student) {
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'RCP-' + String(student.id || '').toUpperCase() + '-' + stamp;
  }

  /** Deterministic barcode (Code-39-like bars) drawn as inline SVG from the receipt number. */
  function barcodeSvg(text) {
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    let x = 0, bars = '';
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 46; i++) {
      const w = 1 + Math.floor(rnd() * 3);
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="40" fill="#111"/>`;
      x += w + (rnd() > 0.6 ? 2 : 1);
    }
    return `<svg class="rcpt-barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  }

  function cardHtml(model) {
    const school = model.school || {};
    const s = model.student || {};
    const fmt = model.format || ((n, c) => (c || '') + ' ' + n);
    const cur = model.currency;
    const rows = model.rows || [];
    const balance = Number(model.balance) || 0;
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const no = receiptNo(s);
    const tel = school.phone ? `Tel: ${school.phone}` : '';

    const items = rows.length
      ? rows.map(r => `<div class="rcpt-line"><span>${esc(r.label)}${r.date ? `<span class="rcpt-sub">${esc(r.date)}</span>` : ''}</span><span>${esc(fmt(r.amount, cur))}</span></div>`).join('')
      : '<div class="rcpt-empty">No payments recorded yet.</div>';

    return `
      <div class="rcpt">
        <div class="rcpt-c">
          <img class="rcpt-logo" src="${esc(school.logo || 'assets/images/school-logo.png')}" alt="" onerror="this.style.display='none'">
          <div class="rcpt-school">${esc(SCHOOL_NAME)}</div>
          <div class="rcpt-addr">${esc(SCHOOL_ADDRESS)}${tel ? '<br>' + esc(tel) : ''}</div>
          <div class="rcpt-title">PAYMENT RECEIPT</div>
        </div>
        <hr class="rcpt-dash">
        <div class="rcpt-line"><span>Date: ${esc(date)}</span><span>${esc(time)}</span></div>
        <div class="rcpt-line"><span>Student:</span><span>${esc(s.name)}</span></div>
        <div class="rcpt-line"><span>ID:</span><span>${esc(s.id)}</span></div>
        <div class="rcpt-line"><span>Class:</span><span>${esc(s.className)}</span></div>
        <hr class="rcpt-dash">
        <div class="rcpt-items">${items}</div>
        <hr class="rcpt-dash">
        ${model.totalBilled !== undefined ? `<div class="rcpt-line"><span>Total Billed</span><span>${esc(fmt(model.totalBilled, cur))}</span></div>` : ''}
        <div class="rcpt-total"><span>Total Paid</span><span>${esc(fmt(model.totalPaid, cur))}</span></div>
        <hr class="rcpt-solid">
        <div class="rcpt-line"><span>Balance</span><span class="${balance > 0 ? 'rcpt-bal-due' : 'rcpt-bal-ok'}"><b>${esc(fmt(balance, cur))}</b></span></div>
        <div class="rcpt-status">${balance > 0 ? '* BALANCE OUTSTANDING *' : '* PAID IN FULL *'}</div>
        <hr class="rcpt-dash">
        <div class="rcpt-thanks">THANK YOU</div>
        ${barcodeSvg(no)}
        <div class="rcpt-no">${esc(no)}</div>
        <div class="rcpt-foot">Payments are record-only; no payment is processed online on this website.</div>
      </div>`;
  }

  function ensureStyles() {
    if (document.getElementById('rcptStyles')) return;
    const st = document.createElement('style');
    st.id = 'rcptStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /** Wraps receipt cards in the grid container (used for the on-screen view). */
  function gridHtml(cardsHtml) {
    ensureStyles();
    return `<div class="rcptGrid">${cardsHtml}</div>`;
  }

  function print(cardsHtml, title) {
    const old = document.getElementById('rcptPrintFrame');
    if (old) old.remove();
    const frame = document.createElement('iframe');
    frame.id = 'rcptPrintFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${esc(document.baseURI)}">
      <title>${esc(title || 'Payment Receipt')}</title><style>${CSS}${PRINT_CSS}</style></head>
      <body><div class="rcptGrid">${cardsHtml}</div></body></html>`);
    doc.close();

    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { console.error('[Receipt] print failed', e); }
    };
    const pending = Array.from(doc.images).filter(i => !i.complete);
    if (!pending.length) { setTimeout(go, 150); return; }
    let left = pending.length;
    const done = () => { if (--left <= 0) setTimeout(go, 100); };
    pending.forEach(i => { i.onload = done; i.onerror = done; });
    setTimeout(go, 2500);
  }

  return { cardHtml: cardHtml, gridHtml: gridHtml, ensureStyles: ensureStyles, print: print };
})();

window.Receipt = Receipt;
