/**
 * reportCard.js
 * -----------------------------------------------------------------------
 * Two-sheet (Front & Back) report card.
 *  - Front: academic record, with an Average row giving the average of every
 *    period/exam/semester column.
 *  - Back: promotion statement, school header and sign-off table.
 * Both sheets are laid out on A4 landscape with a fixed print margin, so
 * nothing is cut off. Printing goes through a hidden frame with its own
 * stylesheet, so it prints identically from the admin, teacher and student
 * portals.
 *
 * Grading modes (rcData.gradingScaleType):
 *   NUMERIC_100  – 0-100, red below 70
 *   LETTER_ABC   – Daycare / Nursery 1 style A, B, C
 *   NUMERIC_1_5  – Nursery 2: grades 1-5 (5 = best), never red
 * -----------------------------------------------------------------------
 */

const ReportCard = (function () {

  // A4 landscape, 8mm print margin -> 281mm x 194mm printable area
  const SHEET_W_MM = 281;
  const SHEET_H_MM = 192;
  const MM_PX = 96 / 25.4;

  const CSS = `
    .rcRoot, .rcRoot * { box-sizing: border-box; }
    .rcRoot { font-family: Georgia, 'Times New Roman', serif; color: #1c1c1c; }
    .rcSheetFrame { margin: 0 auto 18px; position: relative; }
    .rcSheetScale { transform-origin: top left; }
    .rcSheet {
      width: ${SHEET_W_MM}mm; height: ${SHEET_H_MM}mm;
      background: #fff; border: 0.5mm solid #1c1c1c;
      padding: 5mm 6mm; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 3px 14px rgba(0,0,0,.12);
    }
    .rcSheetLabel { text-align: right; font: 700 9px/1 Arial, sans-serif; letter-spacing: 1px; color: #6b7280; text-transform: uppercase; margin-bottom: 2mm; }

    .rcFrontHead { display: flex; align-items: center; gap: 4mm; border-bottom: 0.4mm solid #1c1c1c; padding-bottom: 2mm; margin-bottom: 3mm; }
    .rcFrontHead img { width: 13mm; height: 13mm; object-fit: contain; }
    .rcFrontHead .rcHN { font-weight: 800; font-size: 15px; line-height: 1.15; }
    .rcFrontHead .rcHS { font-size: 10px; font-style: italic; color: #444; }
    .rcFrontMeta { margin-left: auto; text-align: right; font-size: 11px; line-height: 1.5; }
    .rcFrontMeta b { font-weight: 800; }

    .rcTables { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; flex: 1 1 auto; min-height: 0; }
    .rcTableWrap { border: 0.4mm solid #1c1c1c; display: flex; flex-direction: column; min-height: 0; }
    .rcSemTitle { text-align: center; font-style: italic; font-weight: 700; font-size: 13px; padding: 1.5mm; border-bottom: 0.4mm solid #1c1c1c; }
    .rcTable { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--rcFont, 11px); }
    .rcTable th, .rcTable td { border: 0.25mm solid #1c1c1c; height: var(--rcRow, 24px); padding: 0 2px; text-align: center; vertical-align: middle; overflow: hidden; white-space: nowrap; }
    .rcTable th { font-weight: 800; background: #f3f4f6; }
    .rcTable td.rcSub { text-align: left; padding-left: 2mm; font-weight: 700; white-space: normal; line-height: 1.1; }
    .rcTable col.rcColSub { width: 34%; }
    .rcTable tr.rcSum td { font-weight: 800; background: #f3f4f6; }
    .rcTable tr.rcAvg td { font-weight: 900; background: #e8edf5; border-top: 0.5mm solid #1c1c1c; }

    .rcKey { text-align: center; margin-top: 3mm; font-size: 11px; }
    .rcKey b { font-style: italic; margin-right: 4mm; }
    .rcKey span { margin: 0 4mm; }

    .gradeRed { color: #c0392b; font-weight: 800; }
    .gradeBlue { color: #1d4ed8; font-weight: 800; }
    .gradeGreen { color: #065f46; font-weight: 800; }

    .rcBack { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; flex: 1 1 auto; min-height: 0; }
    .rcPromo { border: 0.4mm solid #1c1c1c; padding: 5mm 6mm; display: flex; flex-direction: column; gap: 3mm; font-size: 13px; }
    .rcPromo h3 { margin: 0 0 1mm; text-align: center; font-style: italic; font-size: 17px; }
    .rcPromo p { margin: 0; line-height: 1.5; }
    .rcFill { display: inline-block; min-width: 40mm; border-bottom: 0.3mm solid #1c1c1c; font-weight: 800; padding: 0 2mm; }
    .rcOpt { padding-left: 4mm; line-height: 1.6; }
    .rcSign { margin-top: auto; display: grid; gap: 7mm; }
    .rcSignLine { border-top: 0.3mm solid #1c1c1c; padding-top: 1mm; font-size: 11px; }

    .rcHeadBox { border: 0.4mm solid #1c1c1c; padding: 5mm 6mm; display: flex; flex-direction: column; min-height: 0; }
    .rcSchool { display: flex; align-items: center; gap: 4mm; margin-bottom: 3mm; }
    .rcSchool img { width: 20mm; height: 20mm; object-fit: contain; }
    .rcSchool .rcSN { font-weight: 800; font-size: 17px; line-height: 1.15; }
    .rcSchool .rcSS { font-size: 11px; font-style: italic; color: #444; margin-top: 1mm; }
    .rcTitleBar { background: #1c1c1c; color: #fff; text-align: center; font-weight: 800; letter-spacing: 1px; padding: 1.5mm; margin-bottom: 3mm; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcStudent { display: flex; justify-content: space-between; gap: 4mm; margin-bottom: 3mm; }
    .rcStudent p { margin: 0 0 1.2mm; font-size: 12.5px; }
    .rcPhoto { width: 22mm; height: 27mm; border: 0.4mm solid #1c1c1c; overflow: hidden; flex-shrink: 0; }
    .rcPhoto img { width: 100%; height: 100%; object-fit: cover; }
    .rcNote { font-size: 11px; margin: 0 0 2mm; line-height: 1.4; }
    .rcSignTable { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .rcSignTable th, .rcSignTable td { border: 0.25mm solid #1c1c1c; height: 8mm; text-align: center; }
    .rcSignTable th { background: #f3f4f6; height: 7mm; }
    .rcFoot { font-size: 10.5px; margin: 3mm 0 0; line-height: 1.4; }

    .rcPreviewBar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-family: Arial, sans-serif; }
  `;

  const PRINT_CSS = `
    @page { size: A4 landscape; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .rcSheetFrame { margin: 0 !important; width: ${SHEET_W_MM}mm !important; height: ${SHEET_H_MM}mm !important; break-after: page; page-break-after: always; }
    .rcSheetFrame:last-child { break-after: auto; page-break-after: auto; }
    .rcSheetScale { transform: none !important; }
    .rcSheet { box-shadow: none; border-width: 0.4mm; }
    .rcSheetLabel, .no-print { display: none !important; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;

  let lastData = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mode(rcData) {
    if (rcData.gradingScaleType) return rcData.gradingScaleType;
    return rcData.isNursery ? 'LETTER_ABC' : 'NUMERIC_100';
  }

  function isBlank(v) {
    return v === null || v === undefined || v === '' || v === '—' || v === '-';
  }

  function formatScore(val, m) {
    if (isBlank(val)) return '-';
    const str = String(val).trim();
    const num = Number(val);

    if (m === 'NUMERIC_1_5') {
      // Nursery 2: blue only, never red
      return isNaN(num) ? escapeHtml(str) : `<span class="gradeBlue">${escapeHtml(str)}</span>`;
    }
    if (isNaN(num)) {
      const upper = str.toUpperCase();
      if (upper === 'A' || upper === 'A+') return `<span class="gradeGreen">${escapeHtml(str)}</span>`;
      if (upper === 'B' || upper === 'C') return `<span class="gradeBlue">${escapeHtml(str)}</span>`;
      if (upper === 'D' || upper === 'F') return `<span class="gradeRed">${escapeHtml(str)}</span>`;
      return escapeHtml(str);
    }
    return num >= 70 ? `<span class="gradeBlue">${num}</span>` : `<span class="gradeRed">${num}</span>`;
  }

  /** Average of one column across all subject rows, in the grading mode's own format. */
  function columnAverage(rows, key, m) {
    const vals = [];
    rows.forEach(r => {
      const v = r[key];
      if (isBlank(v)) return;
      if (m === 'LETTER_ABC') {
        const map = { A: 95, B: 80, C: 65 };
        const n = map[String(v).trim().toUpperCase()];
        if (n !== undefined) vals.push(n);
      } else {
        const n = Number(v);
        if (!isNaN(n)) vals.push(n);
      }
    });
    if (!vals.length) return '';
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (m === 'NUMERIC_1_5') return Math.min(5, Math.max(1, Math.round(avg)));
    if (m === 'LETTER_ABC') return avg >= 85 ? 'A' : avg >= 70 ? 'B' : 'C';
    return Number(avg.toFixed(2));
  }

  function gradeKey(m) {
    if (m === 'NUMERIC_1_5') {
      return '<b>Method of Grading</b>' +
        '<span><b class="gradeBlue">5</b> Excellent</span><span><b class="gradeBlue">4</b> Very Good</span>' +
        '<span><b class="gradeBlue">3</b> Good</span><span><b class="gradeBlue">2</b> Fair</span>' +
        '<span><b class="gradeBlue">1</b> Needs Support</span>';
    }
    if (m === 'LETTER_ABC') {
      return '<b>Method of Grading</b>' +
        '<span><b class="gradeGreen">A</b> Excellent</span><span><b class="gradeBlue">B</b> Good</span><span><b class="gradeBlue">C</b> Fair</span>';
    }
    return '<b>Method of Grading</b>' +
      '<span class="gradeBlue">70 – 100 — Passing</span><span class="gradeRed">Below 70 — Needs Improvement</span>';
  }

  function dims(n) {
    // Rows to fit on the front sheet: subjects + header + conduct + rank + average
    const total = n + 5;
    const row = Math.max(14, Math.min(36, Math.floor(500 / total)));
    const font = row >= 30 ? 13 : row >= 26 ? 12 : row >= 22 ? 11 : row >= 18 ? 10 : 9;
    return { row: row, font: font };
  }

  function sheetsHtml(rcData) {
    const school = rcData.school || {};
    const student = rcData.student || {};
    const summary = rcData.summary || {};
    const rows = Array.isArray(rcData.rows) ? rcData.rows : [];
    const m = mode(rcData);
    const f = s => formatScore(s, m);

    const schoolName = school.name || 'Sorina Daycare & Primary School System';
    const schoolMotto = school.motto || 'Excellence in Knowledge, Character & Integrity';
    const logoSrc = school.logo || 'assets/images/school-logo.png';

    const studentName = student.name || '—';
    const studentId = student.id || '—';
    const className = student.className || student.grade || '—';
    const academicYear = student.academicYear || '';
    const conduct1 = student.behaviour || summary.conduct1 || '-';
    const conduct2 = student.behaviour || summary.conduct2 || '-';
    const rank1 = summary.rankSem1 || summary.rank1 || '-';
    const rank2 = summary.rankSem2 || summary.rank2 || '-';

    const avg = k => columnAverage(rows, k, m);
    const d = dims(rows.length);
    const sty = `--rcRow:${d.row}px;--rcFont:${d.font}px`;
    const logoOnErr = "this.style.display='none'";

    const front = `
      <div class="rcSheetFrame" data-rc-sheet>
        <div class="rcSheetScale">
          <div class="rcSheet rcFront" style="${sty}">
            <div class="rcSheetLabel">Front — Academic Record</div>
            <div class="rcFrontHead">
              <img src="${escapeHtml(logoSrc)}" alt="" onerror="${logoOnErr}">
              <div><div class="rcHN">${escapeHtml(schoolName)}</div><div class="rcHS">${escapeHtml(schoolMotto)}</div></div>
              <div class="rcFrontMeta">
                <div><b>${escapeHtml(studentName)}</b> &nbsp;[${escapeHtml(studentId)}]</div>
                <div>Class: <b>${escapeHtml(className)}</b> &nbsp; Year: <b>${escapeHtml(academicYear)}</b></div>
              </div>
            </div>
            <div class="rcTables">
              <div class="rcTableWrap">
                <div class="rcSemTitle">FIRST SEMESTER</div>
                <table class="rcTable">
                  <colgroup><col class="rcColSub"><col><col><col><col><col></colgroup>
                  <thead><tr><th style="text-align:left;padding-left:2mm">SUBJECTS</th><th>1st</th><th>2nd</th><th>3rd</th><th>Exam</th><th>S.Ave</th></tr></thead>
                  <tbody>
                    ${rows.map(r => `<tr><td class="rcSub">${escapeHtml(r.subject)}</td><td>${f(r.p1)}</td><td>${f(r.p2)}</td><td>${f(r.p3)}</td><td>${f(r.exam1)}</td><td>${f(r.sem1Avg)}</td></tr>`).join('')}
                    <tr class="rcSum"><td class="rcSub">Conduct</td><td colspan="4"></td><td>${escapeHtml(conduct1)}</td></tr>
                    <tr class="rcSum"><td class="rcSub">Rank</td><td colspan="4"></td><td>${escapeHtml(rank1)}</td></tr>
                    <tr class="rcAvg"><td class="rcSub">Average</td><td>${f(avg('p1'))}</td><td>${f(avg('p2'))}</td><td>${f(avg('p3'))}</td><td>${f(avg('exam1'))}</td><td>${f(avg('sem1Avg'))}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="rcTableWrap">
                <div class="rcSemTitle">SECOND SEMESTER</div>
                <table class="rcTable">
                  <thead><tr><th>4th</th><th>5th</th><th>6th</th><th>Exam</th><th>S.Ave</th><th>Yr.</th></tr></thead>
                  <tbody>
                    ${rows.map(r => `<tr><td>${f(r.p4)}</td><td>${f(r.p5)}</td><td>${f(r.p6)}</td><td>${f(r.exam2)}</td><td>${f(r.sem2Avg)}</td><td>${f(r.yearlyAvg)}</td></tr>`).join('')}
                    <tr class="rcSum"><td colspan="5"></td><td>${escapeHtml(conduct2)}</td></tr>
                    <tr class="rcSum"><td colspan="5"></td><td>${escapeHtml(rank2)}</td></tr>
                    <tr class="rcAvg"><td>${f(avg('p4'))}</td><td>${f(avg('p5'))}</td><td>${f(avg('p6'))}</td><td>${f(avg('exam2'))}</td><td>${f(avg('sem2Avg'))}</td><td>${f(avg('yearlyAvg'))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="rcKey">${gradeKey(m)}</div>
          </div>
        </div>
      </div>`;

    const footnote = m === 'NUMERIC_1_5'
      ? 'Note: A grade of 1 or 2 means the child needs extra support. Parents or Guardians are encouraged to work with the class teacher.'
      : "Note: When a student's mark is below 70 in any subject, the Parent or Guardian should give special attention to see that the student does well in all required work; otherwise the student will probably fail.";

    const back = `
      <div class="rcSheetFrame" data-rc-sheet>
        <div class="rcSheetScale">
          <div class="rcSheet rcBackSheet">
            <div class="rcSheetLabel">Back — Promotion &amp; Sign-Off</div>
            <div class="rcBack">
              <div class="rcPromo">
                <h3>Promotion Statement</h3>
                <p>This certifies that <span class="rcFill">${escapeHtml(studentName)}</span></p>
                <p>Has satisfactorily completed the work of <span class="rcFill" style="min-width:25mm">${escapeHtml(className)}</span> and is:</p>
                <div class="rcOpt">A. Promoted to _____________________</div>
                <div class="rcOpt">B. Condition in _____________________</div>
                <div class="rcOpt">C. Required to repeat the grade</div>
                <div class="rcOpt">D. Asked not to return (NTR)</div>
                <div class="rcSign">
                  <div class="rcSignLine">Class Sponsor</div>
                  <div class="rcSignLine">Principal</div>
                  <div class="rcSignLine">Date: ______________________</div>
                </div>
              </div>
              <div class="rcHeadBox">
                <div class="rcSchool">
                  <img src="${escapeHtml(logoSrc)}" alt="" onerror="${logoOnErr}">
                  <div><div class="rcSN">${escapeHtml(schoolName)}</div><div class="rcSS">${escapeHtml(schoolMotto)}</div></div>
                </div>
                <div class="rcTitleBar">STUDENT REPORT CARD</div>
                <div class="rcStudent">
                  <div>
                    <p>Student's Name: <b>${escapeHtml(studentName)}</b></p>
                    <p>Class: <b>${escapeHtml(className)}</b> &nbsp; School Year: <b>${escapeHtml(academicYear)}</b></p>
                    <p>Student ID: <b>${escapeHtml(studentId)}</b></p>
                  </div>
                  ${student.photo ? `<div class="rcPhoto"><img src="${escapeHtml(student.photo)}" alt=""></div>` : ''}
                </div>
                <p class="rcNote">Parents or Guardian must sign each period as evidence they have seen the periodic report.</p>
                <table class="rcSignTable">
                  <thead><tr><th style="width:18%">Period</th><th>Class Teacher</th><th>Parent/Guardian</th></tr></thead>
                  <tbody>${['I', 'II', 'III', 'IV', 'V', 'VI'].map(p => `<tr><td>${p}</td><td></td><td></td></tr>`).join('')}</tbody>
                </table>
                <p class="rcFoot">${escapeHtml(footnote)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    return front + back;
  }

  /** Scales each fixed-size sheet down to fit the width of its container (screen preview only). */
  function fitSheets(container) {
    const frames = container.querySelectorAll('[data-rc-sheet]');
    const cs = getComputedStyle(container);
    const avail = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4;
    const natural = SHEET_W_MM * MM_PX;
    const scale = avail > 0 ? Math.min(1, avail / natural) : 1;
    frames.forEach(fr => {
      const inner = fr.querySelector('.rcSheetScale');
      inner.style.transform = `scale(${scale})`;
      fr.style.width = (natural * scale) + 'px';
      fr.style.height = (SHEET_H_MM * MM_PX * scale + 4) + 'px';
    });
  }

  function ensureStyles() {
    if (document.getElementById('rcStyles')) return;
    const st = document.createElement('style');
    st.id = 'rcStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function render(rcData, target) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;

    if (!rcData) {
      container.innerHTML = '<div class="alert alert-danger">No report card records available for this student.</div>';
      return;
    }
    lastData = rcData;
    ensureStyles();

    const student = rcData.student || {};
    const className = student.className || student.grade || '—';

    container.innerHTML = `
      <div class="rcRoot">
        ${rcData.isPartial ? `
          <div class="no-print" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin-bottom:12px;font:12.5px Arial,sans-serif;color:#1e40af;">
            <b>Teacher Preview:</b> Showing your assigned subjects only in ${escapeHtml(className)}. The complete report card with all subjects is available to administrators.
          </div>` : ''}
        <div class="rcPreviewBar no-print">
          <div><b style="color:var(--color-primary);font-size:15px;">Student Report Card</b>
            <span style="font-size:12px;color:#6b7280;margin-left:8px;">Front &amp; Back — prints on 2 A4 landscape sheets</span></div>
          <button type="button" class="btn btn-primary" data-rc-print>Print / Save Report Card (2 sheets)</button>
        </div>
        <div data-rc-sheets>${sheetsHtml(rcData)}</div>
      </div>`;

    const btn = container.querySelector('[data-rc-print]');
    if (btn) btn.onclick = () => print(rcData);

    const refit = () => fitSheets(container);
    refit();
    setTimeout(refit, 60);
    setTimeout(refit, 300);
    if (container._rcResize) window.removeEventListener('resize', container._rcResize);
    container._rcResize = refit;
    window.addEventListener('resize', refit);
  }

  /** Prints the two sheets from a hidden frame so no page chrome can be cut or mixed in. */
  function print(rcData) {
    const data = rcData || lastData;
    if (!data) return;

    const old = document.getElementById('rcPrintFrame');
    if (old) old.remove();
    const frame = document.createElement('iframe');
    frame.id = 'rcPrintFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const baseHref = document.baseURI;
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${escapeHtml(baseHref)}">
      <title>Report Card - ${escapeHtml((data.student || {}).name || '')}</title>
      <style>${CSS}${PRINT_CSS}</style></head><body><div class="rcRoot">${sheetsHtml(data)}</div></body></html>`);
    doc.close();

    const go = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { console.error('[ReportCard] print failed', e); }
    };
    const imgs = Array.from(doc.images);
    let pending = imgs.filter(i => !i.complete).length;
    if (!pending) { setTimeout(go, 150); return; }
    let fired = false;
    const done = () => { if (!fired && --pending <= 0) { fired = true; setTimeout(go, 100); } };
    imgs.filter(i => !i.complete).forEach(i => { i.onload = done; i.onerror = done; });
    setTimeout(() => { if (!fired) { fired = true; go(); } }, 2500);
  }

  return { render: render, print: print };
})();

window.ReportCard = ReportCard;
