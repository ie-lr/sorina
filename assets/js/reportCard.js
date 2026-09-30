/**
 * reportCard.js
 * -----------------------------------------------------------------------
 * Two-Page (Front & Back) Report Card Template
 * Customized with:
 * - School Name: Sorina Daycare & Primary School System
 * - Logo: assets/images/school-logo.png
 * - Student details: Name, ID, Class, Academic Year, Conduct, Rank, Averages
 * -----------------------------------------------------------------------
 */

const ReportCard = (function () {

  const DEFAULT_SUBJECTS = [
    'English Language',
    'Mathematics',
    'General Science',
    'Social Studies',
    'Biology',
    'Chemistry',
    'Physics',
    'History',
    'Geography',
    'Civics'
  ];

  function formatScore(val) {
    if (val === null || val === undefined || val === '' || val === '—' || val === '-') {
      return '-';
    }
    const num = Number(val);
    if (isNaN(num)) {
      const str = String(val).trim();
      const upper = str.toUpperCase();
      if (upper === 'A' || upper === 'A+') return `<span class="gradeGreen">${escapeHtml(str)}</span>`;
      if (upper === 'B' || upper === 'C') return `<span class="gradeBlue">${escapeHtml(str)}</span>`;
      if (upper === 'D' || upper === 'F') return `<span class="gradeRed">${escapeHtml(str)}</span>`;
      return escapeHtml(str);
    }
    if (num >= 91) return `<span class="gradeGreen">${num}</span>`;
    if (num >= 70) return `<span class="gradeBlue">${num}</span>`;
    return `<span class="gradeRed">${num}</span>`;
  }

  function render(rcData, target) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;

    if (!rcData) {
      container.innerHTML = '<div class="alert alert-danger">No report card records available for this student.</div>';
      return;
    }

    const school = rcData.school || {};
    const student = rcData.student || {};
    const summary = rcData.summary || {};
    const rows = Array.isArray(rcData.rows) && rcData.rows.length > 0 ? rcData.rows : DEFAULT_SUBJECTS.map(s => ({
      subject: s,
      p1: '-', p2: '-', p3: '-', exam1: '-', sem1Avg: '-',
      p4: '-', p5: '-', p6: '-', exam2: '-', sem2Avg: '-', yearlyAvg: '-'
    }));

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
    const ave1 = summary.sem1Avg || summary.sem1Average || summary.sem1 || '-';
    const aveYr = summary.overallAverage || summary.yearlyAverage || summary.average || '-';

    const html = `
      <div class="report-booklet-container">

        <!-- Top Action Bar (Hidden in Print) -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;" class="no-print">
          <div>
            <span style="font-weight:700; color:var(--color-primary); font-size:15px;">Student Report Card</span>
            <span style="font-size:12px; color:var(--color-text-muted); margin-left:8px;">(Two-Page Front &amp; Back Template)</span>
          </div>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="display:flex; align-items:center; gap:6px;">
            <img src="assets/icons/download (2).png" style="width:16px; height:16px; filter:brightness(0) invert(1);" alt="">
            Print / Save Two-Page Report Card
          </button>
        </div>

        <!-- ============ FRONT PAGE — ACADEMIC RECORD ============ -->
        <div class="reportCardPage rcFrontPage">
          <div class="rcPageLabel">Front — Academic Record</div>
          <div class="rcSemesterGrid">

            <!-- First Semester Table -->
            <div class="rcSemTableWrap">
              <div class="rcSemTitle">FIRST SEMESTER</div>
              <table class="rcSemTable">
                <thead>
                  <tr>
                    <th>SUBJECTS</th>
                    <th>1st</th>
                    <th>2nd</th>
                    <th>3rd</th>
                    <th>Exam</th>
                    <th>S.Ave</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      <td class="rcSubjectCell">${escapeHtml(r.subject)}</td>
                      <td>${formatScore(r.p1)}</td>
                      <td>${formatScore(r.p2)}</td>
                      <td>${formatScore(r.p3)}</td>
                      <td>${formatScore(r.exam1)}</td>
                      <td>${formatScore(r.sem1Avg)}</td>
                    </tr>
                  `).join('')}
                  <tr class="rcSummaryRow">
                    <td class="rcSubjectCell">Conduct</td>
                    <td colspan="4"></td>
                    <td>${escapeHtml(conduct1)}</td>
                  </tr>
                  <tr class="rcSummaryRow">
                    <td class="rcSubjectCell">Rank</td>
                    <td colspan="4"></td>
                    <td>${escapeHtml(rank1)}</td>
                  </tr>
                  <tr class="rcSummaryRow">
                    <td class="rcSubjectCell">Average</td>
                    <td colspan="4"></td>
                    <td>${formatScore(ave1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Second Semester Table -->
            <div class="rcSemTableWrap">
              <div class="rcSemTitle">SECOND SEMESTER</div>
              <table class="rcSemTable">
                <thead>
                  <tr>
                    <th>4th</th>
                    <th>5th</th>
                    <th>6th</th>
                    <th>Exam</th>
                    <th>S.Ave</th>
                    <th>Yr.</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      <td>${formatScore(r.p4)}</td>
                      <td>${formatScore(r.p5)}</td>
                      <td>${formatScore(r.p6)}</td>
                      <td>${formatScore(r.exam2)}</td>
                      <td>${formatScore(r.sem2Avg)}</td>
                      <td>${formatScore(r.yearlyAvg)}</td>
                    </tr>
                  `).join('')}
                  <tr class="rcSummaryRow">
                    <td colspan="5"></td>
                    <td>${escapeHtml(conduct2)}</td>
                  </tr>
                  <tr class="rcSummaryRow">
                    <td colspan="5"></td>
                    <td>${escapeHtml(rank2)}</td>
                  </tr>
                  <tr class="rcSummaryRow">
                    <td colspan="5"></td>
                    <td>${formatScore(aveYr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          <div class="rcGradeKey">
            <b>Method of Grading</b>
            <div class="rcGradeKeyGrid">
              <span class="gradeGreen">91 &amp; above — Excellent</span>
              <span class="gradeBlue">70 – 90 — Passing</span>
              <span class="gradeRed">Below 70 — Failing</span>
            </div>
          </div>
        </div>

        <!-- ============ BACK PAGE — PROMOTION & SIGN-OFF ============ -->
        <div class="reportCardPage rcBackPage">
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
                <img src="${logoSrc}" alt="Logo" onerror="this.style.display='none'">
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
                ${student.photo ? `<div style="width: 58px; height: 70px; border: 1.5px solid #1c1c1c; border-radius: 4px; overflow: hidden; margin-top: 4px;"><img src="${escapeHtml(student.photo)}" style="width: 100%; height: 100%; object-fit: cover;"></div>` : ''}
              </div>
              <p class="rcSignoffNote">Parents or Guardian must sign each period as evidence they have seen the periodic report.</p>
              <table class="rcSignoffTable">
                <thead><tr><th>Period</th><th>Class Teacher</th><th>Parent/Guardian</th></tr></thead>
                <tbody>
                  <tr><td>I</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                  <tr><td>II</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                  <tr><td>III</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                  <tr><td>IV</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                  <tr><td>V</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                  <tr><td>VI</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                </tbody>
              </table>
              <p class="rcFootnote">Note: When a student's mark is below 70 in any subject, the Parent or Guardian should give special attention to see that the student does well in all required work; otherwise the student will probably fail.</p>
            </div>

          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    render: render
  };
})();
