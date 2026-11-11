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
    .rcSheetFrame { margin: 0 auto 20px; position: relative; }
    .rcSheetScale { transform-origin: top left; }
    .rcSheet {
      width: ${SHEET_W_MM}mm; height: ${SHEET_H_MM}mm;
      background: #ffffff; border: 2px solid #1c1c1c;
      padding: 8mm 9mm; overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
    .rcPageLabel { text-align: right; font-size: 10px; color: #6b7280; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif; }

    /* FRONT — two semester tables side by side */
    .rcSemesterGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
    .rcSemTableWrap { border: 2px solid #1c1c1c; border-radius: 4px; overflow: hidden; }
    .rcSemTitle { text-align: center; font-style: italic; font-weight: 700; font-size: 15px; padding: 8px; border-bottom: 2px solid #1c1c1c; background: #ffffff; }
    .rcSemTable { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--rcFont, 11.5px); }
    .rcSemTable th, .rcSemTable td { border: 1px solid #1c1c1c; height: var(--rcRow, 28px); padding: 0 4px; text-align: center; vertical-align: middle; overflow: hidden; white-space: nowrap; }
    .rcSemTable td.rcSubjectCell { text-align: left; padding-left: 8px; font-weight: 600; white-space: normal; line-height: 1.15; }
    .rcSemTable col.rcColSub { width: 34%; }
    .rcSemTable tr.rcSummaryRow td { font-weight: 800; background: rgba(0, 0, 0, 0.05); }
    .rcGradeKey { text-align: center; margin-top: 6px; }
    .rcGradeKey b.rcGradeKeyTitle { display: block; font-style: italic; margin-bottom: 6px; }
    .rcGradeKeyGrid { display: flex; justify-content: center; gap: 50px; flex-wrap: wrap; font-size: 12.5px; }

    .gradeRed { color: #c0392b; font-weight: 800; }
    .gradeBlue { color: #1d4ed8; font-weight: 800; }
    .gradeGreen { color: #065f46; font-weight: 800; }

    /* BACK — promotion statement + school header / signature table */
    .rcBackGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid #1c1c1c; }
    .rcPromoBox { padding: 20px 22px; border-right: 2px solid #1c1c1c; }
    .rcPromoBox h3 { text-decoration: underline; margin: 0 0 14px; font-size: 17px; }
    .rcPromoLine { margin: 10px 0; font-size: 13px; }
    .rcPromoLine .fillIn { display: inline-block; min-width: 180px; border-bottom: 1px solid #1c1c1c; font-weight: 700; padding: 0 4px; }
    .rcPromoOption { margin: 8px 0; font-size: 12.5px; }
    .rcSignBlock { margin-top: 26px; }
    .rcSignLine { display: block; border-bottom: 1px solid #1c1c1c; min-height: 26px; margin-bottom: 2px; }
    .rcSignLabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .rcHeaderBox { padding: 20px 22px; }
    .rcSchoolHead { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
    .rcSchoolHead img { width: 56px; height: 56px; object-fit: contain; }
    .rcSchoolHead .rcSchoolName { font-weight: 900; font-size: 15px; line-height: 1.25; text-transform: uppercase; }
    .rcSchoolHead .rcSchoolSub { font-size: 10.5px; color: #333; }
    .rcCardTitleBar { text-align: center; background: #1c1c1c; color: #fff; font-weight: 800; padding: 6px; margin: 10px 0 14px; letter-spacing: 1px; font-size: 13px; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcStudentMetaLine { font-size: 13.5px; margin: 6px 0; }
    .rcStudentMetaLine b { border-bottom: 1px solid #1c1c1c; padding: 0 6px; }
    .rcSignoffNote { text-align: center; font-weight: 700; font-size: 12px; margin: 14px 0 8px; }
    .rcSignoffTable { width: 100%; border-collapse: collapse; font-size: 12px; }
    .rcSignoffTable th, .rcSignoffTable td { border: 1px solid #1c1c1c; padding: 8px; text-align: center; }
    .rcSignoffTable th { background: #1c1c1c; color: #fff; font-style: italic; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcFootnote { font-size: 10.5px; color: #333; margin-top: 14px; line-height: 1.5; }

    .rcPreviewBar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-family: Arial, sans-serif; }
  `;

  const PRINT_CSS = `
    @page { size: A4 landscape; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .rcSheetFrame { margin: 0 !important; width: ${SHEET_W_MM}mm !important; height: ${SHEET_H_MM}mm !important; break-after: page; page-break-after: always; }
    .rcSheetFrame:last-child { break-after: auto; page-break-after: auto; }
    .rcSheetScale { transform: none !important; }
    .rcSheet { box-shadow: none; }
    .rcPageLabel, .no-print { display: none !important; }
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
    let items;
    if (m === 'NUMERIC_1_5') {
      items = '<span class="gradeBlue">5 — Excellent</span><span class="gradeBlue">4 — Very Good</span><span class="gradeBlue">3 — Good</span><span class="gradeBlue">2 — Fair</span><span class="gradeBlue">1 — Needs Support</span>';
    } else if (m === 'LETTER_ABC') {
      items = '<span class="gradeGreen">A — Excellent</span><span class="gradeBlue">B — Good</span><span class="gradeBlue">C — Fair</span>';
    } else {
      items = '<span class="gradeGreen">70 – 100 — Passing</span><span class="gradeBlue">60 – 69 — Needs Improvement</span><span class="gradeRed">Below 60 — Below Passing</span>';
    }
    return `<b class="rcGradeKeyTitle">Method of Grading</b><div class="rcGradeKeyGrid">${items}</div>`;
  }

  function dims(n) {
    // Rows to fit on the front sheet: subjects + header + conduct + rank + average
    const total = n + 5;
    const row = Math.max(14, Math.min(28, Math.floor(430 / total)));
    const font = row >= 24 ? 11.5 : row >= 20 ? 10.5 : row >= 17 ? 9.5 : 8.5;
    return { row: row, font: font };
  }

  function sheetsHtml(rcData) {
    const school = rcData.school || {};
    const student = rcData.student || {};
    const summary = rcData.summary || {};
    const rows = Array.isArray(rcData.rows) ? rcData.rows : [];
    const m = mode(rcData);
    const f = s => formatScore(s, m);

    const schoolName = 'Sorina Daycare & Primary School System';
    const schoolMotto = school.motto || 'Excellence in Knowledge, Character & Integrity';
    const logoSrc = school.logo || 'assets/images/school-logo.png';

    const studentName = student.name || '—';
    const studentId = student.id || '—';
    const className = student.className || student.grade || '—';
    const academicYear = student.academicYear || '2026/2027';
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
          <div class="rcSheet rcFrontPage" style="${sty}">
            <div class="rcPageLabel">Front — Academic Record</div>
            <div class="rcSemesterGrid">
              <div class="rcSemTableWrap">
                <div class="rcSemTitle">FIRST SEMESTER</div>
                <table class="rcSemTable">
                  <colgroup><col class="rcColSub"><col><col><col><col><col></colgroup>
                  <thead><tr><th>SUBJECTS</th><th>1st</th><th>2nd</th><th>3rd</th><th>Exam</th><th>S.Ave</th></tr></thead>
                  <tbody>
                    ${rows.map(r => `<tr><td class="rcSubjectCell">${escapeHtml(r.subject)}</td><td>${f(r.p1)}</td><td>${f(r.p2)}</td><td>${f(r.p3)}</td><td>${f(r.exam1)}</td><td>${f(r.sem1Avg)}</td></tr>`).join('')}
                    <tr class="rcSummaryRow"><td class="rcSubjectCell">Conduct</td><td colspan="4"></td><td>${escapeHtml(conduct1)}</td></tr>
                    <tr class="rcSummaryRow"><td class="rcSubjectCell">Rank</td><td colspan="4"></td><td>${escapeHtml(rank1)}</td></tr>
                    <tr class="rcSummaryRow"><td class="rcSubjectCell">Average</td><td>${f(avg('p1'))}</td><td>${f(avg('p2'))}</td><td>${f(avg('p3'))}</td><td>${f(avg('exam1'))}</td><td>${f(avg('sem1Avg'))}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="rcSemTableWrap">
                <div class="rcSemTitle">SECOND SEMESTER</div>
                <table class="rcSemTable">
                  <thead><tr><th>4th</th><th>5th</th><th>6th</th><th>Exam</th><th>S.Ave</th><th>Yr.</th></tr></thead>
                  <tbody>
                    ${rows.map(r => `<tr><td>${f(r.p4)}</td><td>${f(r.p5)}</td><td>${f(r.p6)}</td><td>${f(r.exam2)}</td><td>${f(r.sem2Avg)}</td><td>${f(r.yearlyAvg)}</td></tr>`).join('')}
                    <tr class="rcSummaryRow"><td colspan="5"></td><td>${escapeHtml(conduct2)}</td></tr>
                    <tr class="rcSummaryRow"><td colspan="5"></td><td>${escapeHtml(rank2)}</td></tr>
                    <tr class="rcSummaryRow"><td>${f(avg('p4'))}</td><td>${f(avg('p5'))}</td><td>${f(avg('p6'))}</td><td>${f(avg('exam2'))}</td><td>${f(avg('sem2Avg'))}</td><td>${f(avg('yearlyAvg'))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="rcGradeKey">${gradeKey(m)}</div>
          </div>
        </div>
      </div>`;

    const footnote = m === 'NUMERIC_1_5'
      ? 'Note: A grade of 1 or 2 means the child needs extra support. Parents or Guardians are encouraged to work with the class teacher.'
      : "Note: When a student's mark is below 70 in any subject, the Parent or Guardian should give special attention to see that the student does well in all required work; otherwise the student will probably fail.";

    const back = `
      <div class="rcSheetFrame" data-rc-sheet>
        <div class="rcSheetScale">
          <div class="rcSheet rcBackPage">
            <div class="rcPageLabel">Back — Promotion &amp; Sign-Off</div>
            <div class="rcBackGrid">
              <div class="rcPromoBox">
                <h3>Promotion Statement</h3>
                <p class="rcPromoLine">This certifies that <span class="fillIn">${escapeHtml(studentName)}</span></p>
                <p class="rcPromoLine">Has satisfactorily completed the work of Grade <span class="fillIn">${escapeHtml(className)}</span> and is:</p>
                <div class="rcPromoOption">A. Promoted to Grade _____________________</div>
                <div class="rcPromoOption">B. Condition in _____________________</div>
                <div class="rcPromoOption">C. Required to repeat the grade</div>
                <div class="rcPromoOption">D. Asked not to return (NTR)</div>
                <div class="rcSignBlock"><span class="rcSignLine"></span><div class="rcSignLabel">Class Sponsor</div></div>
                <div class="rcSignBlock"><span class="rcSignLine"></span><div class="rcSignLabel">Principal</div></div>
                <div class="rcSignBlock"><span class="rcSignLine">Date: ______________________</span></div>
              </div>
              <div class="rcHeaderBox">
                <div class="rcSchoolHead">
                  <img src="${escapeHtml(logoSrc)}" alt="Logo" onerror="${logoOnErr}">
                  <div>
                    <div class="rcSchoolName">${escapeHtml(schoolName)}</div>
                    <div class="rcSchoolSub">${escapeHtml(schoolMotto)}</div>
                  </div>
                </div>
                <div class="rcCardTitleBar">Student Report Card</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                  <div>
                    <p class="rcStudentMetaLine">Student's Name: <b>${escapeHtml(studentName)}</b></p>
                    <p class="rcStudentMetaLine">Grade: <b>${escapeHtml(className)}</b> &nbsp; School Year: <b>${escapeHtml(academicYear)}</b></p>
                    <p class="rcStudentMetaLine">Student ID: <b>${escapeHtml(studentId)}</b></p>
                  </div>
                  ${student.photo ? `<div style="width: 58px; height: 70px; border: 1.5px solid #1c1c1c; border-radius: 4px; overflow: hidden; margin-top: 4px;"><img src="${escapeHtml(student.photo)}" alt="" style="width: 100%; height: 100%; object-fit: cover;"></div>` : ''}
                </div>
                <p class="rcSignoffNote">Parents or Guardian must sign each period as evidence they have seen the periodic report.</p>
                <table class="rcSignoffTable">
                  <thead><tr><th>Period</th><th>Class Teacher</th><th>Parent/Guardian</th></tr></thead>
                  <tbody>${['I', 'II', 'III', 'IV', 'V', 'VI'].map(p => `<tr><td>${p}</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody>
                </table>
                <p class="rcFootnote">${escapeHtml(footnote)}</p>
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
