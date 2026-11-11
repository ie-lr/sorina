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

  const CSS = `
    .rcptGrid, .rcptGrid *, .rcpt, .rcpt * { box-sizing: border-box; }
    .rcptGrid { display: flex; flex-wrap: wrap; gap: 4mm; justify-content: center; align-items: flex-start; font-family: Arial, Helvetica, sans-serif; }
    .rcpt { font-family: Arial, Helvetica, sans-serif; width: 91mm; background: #fff; border: 0.4mm solid #0b2a4a; color: #172536; position: relative; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .rcpt-head { display: flex; align-items: center; gap: 3mm; padding: 3.5mm 4mm; background: #0b2a4a; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt-logo { width: 15mm; height: 15mm; object-fit: contain; background: #fff; border-radius: 50%; padding: 0.8mm; flex-shrink: 0; }
    .rcpt-school { font-weight: 800; font-size: 11.5px; line-height: 1.2; }
    .rcpt-motto { font-size: 8px; font-style: italic; opacity: .85; margin-top: .8mm; }
    .rcpt-contact { font-size: 7.5px; opacity: .8; margin-top: .6mm; }
    .rcpt-titlebar { display: flex; justify-content: space-between; align-items: center; padding: 2mm 4mm; background: #e8eef7; border-bottom: 0.3mm solid #0b2a4a; font-size: 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt-titlebar b { font-size: 12px; letter-spacing: 1.2px; color: #0b2a4a; }
    .rcpt-titlebar span { color: #475569; }
    .rcpt-body { padding: 3mm 4mm 3.5mm; }
    .rcpt-student { display: flex; gap: 3mm; align-items: stretch; margin-bottom: 3mm; }
    .rcpt-photo { width: 17mm; height: 21mm; border: 0.3mm solid #0b2a4a; background: #eef4fb; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #94a3b8; overflow: hidden; flex-shrink: 0; }
    .rcpt-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .rcpt-info { flex: 1; border-collapse: collapse; font-size: 9.5px; }
    .rcpt-info td { border-bottom: 0.2mm solid #cbd5e1; padding: 1mm 0; vertical-align: top; }
    .rcpt-info td:first-child { width: 23mm; color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: .3px; padding-top: 1.3mm; }
    .rcpt-info td:last-child { font-weight: 700; }
    .rcpt-table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 2.5mm; }
    .rcpt-table th { background: #0b2a4a; color: #fff; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .4px; padding: 1.2mm 1.5mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt-table td { padding: 1.4mm 1.5mm; border-bottom: 0.2mm solid #d5dde8; }
    .rcpt-table tbody tr:nth-child(even) td { background: #f5f8fc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt-table .n { width: 5mm; color: #64748b; }
    .rcpt-table .d { width: 20mm; color: #475569; font-size: 8.5px; }
    .rcpt-table .a { text-align: right; font-weight: 700; white-space: nowrap; }
    .rcpt-empty { text-align: center; color: #64748b; padding: 4mm 0 !important; font-style: italic; }
    .rcpt-totals { border: 0.3mm solid #0b2a4a; font-size: 10px; }
    .rcpt-totals div { display: flex; justify-content: space-between; padding: 1.3mm 2mm; }
    .rcpt-totals div + div { border-top: 0.2mm solid #cbd5e1; }
    .rcpt-totals .paid { font-weight: 800; background: #ecfdf3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt-totals .bal { font-weight: 900; font-size: 11px; }
    .rcpt-bal-due { color: #b42318; }
    .rcpt-bal-ok { color: #067647; }
    .rcpt-stamp { text-align: center; margin: 2.5mm 0 0; }
    .rcpt-stamp span { display: inline-block; padding: .8mm 4mm; border: 0.4mm solid; border-radius: 1mm; font-size: 9px; font-weight: 900; letter-spacing: 1.2px; transform: rotate(-3deg); }
    .rcpt-stamp .ok { color: #067647; border-color: #067647; }
    .rcpt-stamp .due { color: #b42318; border-color: #b42318; }
    .rcpt-sign { display: flex; justify-content: space-between; gap: 6mm; margin-top: 7mm; font-size: 8px; color: #475569; }
    .rcpt-sign div { flex: 1; border-top: 0.25mm solid #475569; padding-top: 1mm; text-align: center; }
    .rcpt-foot { text-align: center; font-size: 7.5px; color: #94a3b8; padding: 0 4mm 3mm; }
  `;

  const PRINT_CSS = `
    @page { size: A4 landscape; margin: 6mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .rcptGrid { justify-content: flex-start; }
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

  function cardHtml(model) {
    const school = model.school || {};
    const s = model.student || {};
    const fmt = model.format || ((n, c) => (c || '') + ' ' + n);
    const cur = model.currency;
    const rows = model.rows || [];
    const balance = Number(model.balance) || 0;
    const contact = [school.phone, school.email].filter(Boolean).join('  |  ');

    const body = rows.length
      ? rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.label)}</td><td class="d">${esc(r.date) || '—'}</td><td class="a">${esc(fmt(r.amount, cur))}</td></tr>`).join('')
      : '<tr><td colspan="4" class="rcpt-empty">No payments recorded yet.</td></tr>';

    return `
      <div class="rcpt">
        <div class="rcpt-head">
          <img class="rcpt-logo" src="${esc(school.logo || 'assets/images/school-logo.png')}" alt="" onerror="this.style.display='none'">
          <div>
            <div class="rcpt-school">${esc(school.name || 'Sorina Daycare & Primary School System')}</div>
            <div class="rcpt-motto">${esc(school.motto || '')}</div>
            ${contact ? `<div class="rcpt-contact">${esc(contact)}</div>` : ''}
          </div>
        </div>
        <div class="rcpt-titlebar"><b>PAYMENT RECEIPT</b><span>No. ${esc(receiptNo(s))}</span></div>
        <div class="rcpt-body">
          <div class="rcpt-student">
            <div class="rcpt-photo">${s.photo ? `<img src="${esc(s.photo)}" alt="">` : '&#128100;'}</div>
            <table class="rcpt-info">
              <tr><td>Student</td><td>${esc(s.name)}</td></tr>
              <tr><td>Student ID</td><td>${esc(s.id)}</td></tr>
              <tr><td>Class</td><td>${esc(s.className)}</td></tr>
              <tr><td>Date</td><td>${esc(new Date().toLocaleDateString())}</td></tr>
            </table>
          </div>
          <table class="rcpt-table">
            <thead><tr><th>#</th><th>Description</th><th>Date</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
          <div class="rcpt-totals">
            ${model.totalBilled !== undefined ? `<div><span>Total Billed</span><span>${esc(fmt(model.totalBilled, cur))}</span></div>` : ''}
            <div class="paid"><span>Total Paid</span><span>${esc(fmt(model.totalPaid, cur))}</span></div>
            <div class="bal"><span>Balance Due</span><span class="${balance > 0 ? 'rcpt-bal-due' : 'rcpt-bal-ok'}">${esc(fmt(balance, cur))}</span></div>
          </div>
          <div class="rcpt-stamp"><span class="${balance > 0 ? 'due' : 'ok'}">${balance > 0 ? 'BALANCE OUTSTANDING' : 'PAID IN FULL'}</span></div>
          <div class="rcpt-sign"><div>Received by (Bursar)</div><div>Parent / Guardian</div></div>
        </div>
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
