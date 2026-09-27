/**
 * reportCard.js
 * -----------------------------------------------------------------------
 * Two-sided booklet report card renderer matching official school templates.
 * 
 * Side 1 (Front Cover):
 * - School Header, Transparent Logo, Motto
 * - Student Biographical Grid (Name, Class, Year, Student ID, DOB, Guardian)
 * - Parent / Guardian Signature Acknowledgment Grid (Periods 1-6)
 * 
 * Side 2 (Inside / Back Spread):
 * - Categorized subjects: Literacy, Numeracy, Natural Sciences, Social Studies
 * - Full 13-period × semester column matrix
 * - Dynamic score color coding:
 *   Standard: <70% Red, 70-90% Blue, 91-100% Deep Green
 *   Nursery: A Green, B/C Blue, D/F Red
 * - Attendance, Promotion Status, Grading Scale, and Official Signatures
 * -----------------------------------------------------------------------
 */

const ReportCard = (function () {

  const SUBJECT_CATEGORIES = [
    {
      category: 'LITERACY & LANGUAGE ARTS',
      subjects: ['Reading', 'Phonics', 'Spelling & Vocabulary', 'Handwriting', 'Composition/Grammar', 'English Language', 'Literature']
    },
    {
      category: 'NUMERACY & MATHEMATICS',
      subjects: ['General Mathematics', 'Mental Math', 'Geometry', 'Algebra']
    },
    {
      category: 'NATURAL & PHYSICAL SCIENCES',
      subjects: ['General Science', 'Health Education', 'Biology', 'Chemistry', 'Physics']
    },
    {
      category: 'SOCIAL STUDIES & MORAL CITIZENSHIP',
      subjects: ['Social Studies', 'Religious & Moral Education', 'Creative Arts / Music', 'Physical Education', 'Civics', 'History', 'Geography']
    }
  ];

  /**
   * Evaluates score class based on grade scale.
   */
  function getScoreColorClass(val, isNursery) {
    if (val === null || val === undefined || val === '' || val === '—') return '';
    if (isNursery) {
      const letter = String(val).trim().toUpperCase();
      if (letter === 'A' || letter === 'A+') return 'score-green';
      if (letter === 'B' || letter === 'C') return 'score-blue';
      if (letter === 'D' || letter === 'F') return 'score-red';
      return '';
    }

    const num = Number(val);
    if (isNaN(num)) return '';
    if (num < 70) return 'score-red';
    if (num <= 90) return 'score-blue';
    return 'score-green';
  }

  function formatScore(val, isNursery) {
    if (val === null || val === undefined || val === '' || val === '—') {
      return '<span style="color:#94a3b8;">—</span>';
    }
    const colorClass = getScoreColorClass(val, isNursery);
    return `<span class="${colorClass}">${escapeHtml(String(val))}</span>`;
  }

  /**
   * Groups rows into standardized categories.
   */
  function categorizeRows(rows) {
    const grouped = [];
    const usedSubjects = new Set();

    SUBJECT_CATEGORIES.forEach(cat => {
      const matched = rows.filter(r => {
        const subName = String(r.subject || '').trim().toLowerCase();
        return cat.subjects.some(cs => cs.toLowerCase() === subName || subName.includes(cs.toLowerCase()));
      });

      if (matched.length > 0) {
        matched.forEach(m => usedSubjects.add(m.subject));
        grouped.push({
          categoryName: cat.category,
          rows: matched
        });
      }
    });

    // Remainder subjects
    const uncat = rows.filter(r => !usedSubjects.has(r.subject));
    if (uncat.length > 0) {
      grouped.push({
        categoryName: 'GENERAL & ELECTIVE SUBJECTS',
        rows: uncat
      });
    }

    return grouped.length > 0 ? grouped : [{ categoryName: 'ALL SUBJECTS', rows: rows }];
  }

  /**
   * Renders the two-sided booklet report card into target container.
   */
  function render(rcData, target) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;

    if (!rcData || !rcData.rows) {
      container.innerHTML = '<div class="alert alert-danger">No report card records available for this student and academic year.</div>';
      return;
    }

    const school = rcData.school || {};
    const student = rcData.student || {};
    const summary = rcData.summary || {};
    const isNursery = rcData.isNursery === true;
    const groupedData = categorizeRows(rcData.rows);

    const logoSrc = school.logo || 'assets/images/school-logo.png';
    const schoolName = school.name || 'SORINA PRIMARY & SECONDARY SCHOOL';
    const motto = school.motto || 'Work and Pray';

    const html = `
      <div class="report-booklet-container">

        <!-- Controls (Hidden in Print) -->
        <div style="display: flex; justify-content: space-between; align-items: center;" class="no-print">
          <div>
            <span style="font-weight: 700; color: var(--color-primary); font-size: 15px;">Official Student Booklet Report Card</span>
            <span style="font-size: 12px; color: var(--color-text-muted); margin-left: 8px;">(Two-Sided Academic Record)</span>
          </div>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/download (2).png" style="width: 16px; height: 16px; filter: brightness(0) invert(1);" alt="">
            Print / Save Two-Sided PDF
          </button>
        </div>

        <!-- ========================================== -->
        <!-- SIDE 1: FRONT COVER                       -->
        <!-- ========================================== -->
        <div class="booklet-side-card">
          <div class="booklet-side-header">
            <img src="${logoSrc}" alt="School Logo" style="width: 76px; height: 76px; object-fit: contain; margin-bottom: 6px; background: transparent;">
            <div class="booklet-side-title">REPUBLIC OF LIBERIA &bull; MINISTRY OF EDUCATION</div>
            <h1 class="booklet-school-name">${escapeHtml(schoolName)}</h1>
            <div class="booklet-motto">&ldquo;${escapeHtml(motto)}&rdquo;</div>
            <div class="booklet-report-type">${isNursery ? 'EARLY CHILDHOOD / NURSERY PROGRESS REPORT' : 'OFFICIAL ELEMENTARY &amp; SECONDARY REPORT CARD'}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f2d59; margin-top: 4px;">
              ACADEMIC YEAR: ${escapeHtml(student.academicYear || '2026–2027')}
            </div>
          </div>

          <!-- Student Biographical Data -->
          <div class="booklet-student-meta-grid">
            <div class="booklet-meta-item">
              <strong>Student Name:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.name || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Student ID:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.id || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Class / Grade:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.className || student.grade || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Date of Birth:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.dob || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Parent / Guardian:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.guardian || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Emergency Phone:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.phone || '—')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Student Conduct:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.behaviour || 'Good')}</div>
            </div>
            <div class="booklet-meta-item">
              <strong>Status:</strong>
              <div class="booklet-meta-value">${escapeHtml(student.status || 'Active Enrolled')}</div>
            </div>
          </div>

          <!-- Parent / Guardian Acknowledgment Table -->
          <h3 style="font-size: 13px; text-transform: uppercase; color: #0f2d59; margin: 24px 0 8px; font-weight: 800;">
            Parent / Guardian Report Card Examination &amp; Signature
          </h3>
          <p style="font-size: 12px; color: #475569; margin: 0 0 12px;">
            Parents/Guardians are requested to examine this report card carefully at each evaluation period, append signature, and return promptly.
          </p>

          <table class="booklet-parent-table">
            <thead>
              <tr>
                <th style="width: 25%;">Evaluation Period</th>
                <th style="width: 50%;">Parent / Guardian Signature</th>
                <th style="width: 25%;">Date Signed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>1st Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td><b>2nd Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td><b>3rd Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td><b>4th Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td><b>5th Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td><b>6th Marking Period</b></td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 36px; text-align: center; font-size: 11.5px; color: #64748b;">
            Side 1 of 2 &bull; Official Student Cumulative Academic Record Booklet
          </div>
        </div>

        <!-- ========================================== -->
        <!-- SIDE 2: INSIDE / BACK SPREAD              -->
        <!-- ========================================== -->
        <div class="booklet-side-card">
          <div class="booklet-side-header">
            <div class="booklet-side-title">PERFORMANCE RECORD &bull; SEMESTERS 1 &amp; 2</div>
            <h2 class="booklet-school-name" style="font-size: 18px;">${escapeHtml(schoolName)}</h2>
            <div style="font-size: 13px; font-weight: 700; color: #0f2d59;">
              Student: ${escapeHtml(student.name)} &bull; ID: [${escapeHtml(student.id)}] &bull; Class: ${escapeHtml(student.className || student.grade)}
            </div>
          </div>

          <!-- Academic Table -->
          <div class="table-responsive" style="border: 1px solid #0f2d59; border-radius: 4px; overflow: hidden;">
            <table class="rc-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th class="subject-col" style="min-width: 170px; text-align: left;">SUBJECT</th>
                  <th>1st P</th>
                  <th>2nd P</th>
                  <th>3rd P</th>
                  <th>Exam 1</th>
                  <th style="background-color: #0b3c8a;">Sem 1</th>
                  <th>4th P</th>
                  <th>5th P</th>
                  <th>6th P</th>
                  <th>Exam 2</th>
                  <th style="background-color: #0b3c8a;">Sem 2</th>
                  <th style="background-color: #0d47a1;">Yearly</th>
                  <th>Grade</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                ${groupedData.map(group => `
                  <tr class="category-header-row">
                    <td colspan="14">${escapeHtml(group.categoryName)}</td>
                  </tr>
                  ${group.rows.map(row => renderBookletRow(row, isNursery)).join('')}
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Booklet Footer: Promotion, Summary, Legend, and Signatures -->
          <div class="booklet-footer-summary">
            
            <div class="promotion-block">
              <div style="margin-bottom: 8px;">
                <strong>Attendance Summary:</strong> Total Days: <b>180</b> &nbsp;|&nbsp; Days Present: <b>176</b> &nbsp;|&nbsp; Days Absent: <b>4</b>
              </div>
              <div style="margin-bottom: 8px;">
                <strong>Overall Yearly Average:</strong> 
                <b style="font-size: 16px; margin-left: 4px;" class="${getScoreColorClass(summary.overallAverage, isNursery)}">
                  ${summary.overallAverage || '—'}
                </b>
                &nbsp;|&nbsp; <strong>Grade:</strong> <span class="${getScoreColorClass(summary.overallGrade, isNursery)}">${summary.overallGrade || '—'}</span>
              </div>
              <div style="margin-top: 14px; padding: 10px; border: 1px solid #0f2d59; border-radius: 4px; background: #fdfdfe;">
                <div style="font-weight: 800; color: #0f2d59; margin-bottom: 4px;">PROMOTION DECISION:</div>
                <div>&bull; Promoted to Grade / Class: <b>${summary.overallGrade === 'F' ? '—' : (summary.promotedTo || getNextClass(student.className || student.grade))}</b></div>
                <div>&bull; Retained in Grade / Class: <b>${summary.overallGrade === 'F' ? (student.className || student.grade) : '—'}</b></div>
              </div>
            </div>

            <!-- Grading Scale Legend -->
            <div class="grading-legend-box">
              <h4>${isNursery ? 'Nursery Scale' : 'Standard Grading Scale'}</h4>
              ${isNursery ? `
                <div style="color: #15803d; font-weight: 700;">A &bull; 85–100% (Excellent)</div>
                <div style="color: #2563eb; font-weight: 700;">B/C &bull; 70–84% (Good / Satisfactory)</div>
                <div style="color: #dc2626; font-weight: 700;">D/F &bull; Below 70% (Poor / Retained)</div>
              ` : `
                <div style="color: #15803d; font-weight: 700;">91–100% &bull; A (Deep Green: Honored)</div>
                <div style="color: #2563eb; font-weight: 700;">70–90% &bull; B/C (Blue: Satisfactory)</div>
                <div style="color: #dc2626; font-weight: 700;">&lt; 70% &bull; D/F (Red: Retained)</div>
              `}
            </div>

          </div>

          <!-- Signatures -->
          <div class="booklet-signature-row">
            <div class="booklet-sign-item">
              Homeroom Teacher
            </div>
            <div class="booklet-sign-item" style="border-top: none; text-align: center;">
              <div style="font-size: 11px; color: #64748b;">[ OFFICIAL SCHOOL STAMP ]</div>
            </div>
            <div class="booklet-sign-item">
              Principal / Registrar
            </div>
          </div>

          <div style="margin-top: 24px; text-align: center; font-size: 11.5px; color: #64748b;">
            Side 2 of 2 &bull; End of Cumulative Academic Record
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;
  }

  function renderBookletRow(row, isNursery) {
    return `
      <tr>
        <td class="subject-col" style="text-align: left; font-weight: 600;">${escapeHtml(row.subject)}</td>
        <td>${formatScore(row.p1, isNursery)}</td>
        <td>${formatScore(row.p2, isNursery)}</td>
        <td>${formatScore(row.p3, isNursery)}</td>
        <td>${formatScore(row.exam1, isNursery)}</td>
        <td style="font-weight: 700; background: #f8fafc;">${formatScore(row.sem1Avg, isNursery)}</td>
        <td>${formatScore(row.p4, isNursery)}</td>
        <td>${formatScore(row.p5, isNursery)}</td>
        <td>${formatScore(row.p6, isNursery)}</td>
        <td>${formatScore(row.exam2, isNursery)}</td>
        <td style="font-weight: 700; background: #f8fafc;">${formatScore(row.sem2Avg, isNursery)}</td>
        <td style="font-weight: 800; background: #eff6ff;">${formatScore(row.yearlyAvg, isNursery)}</td>
        <td style="font-weight: 700;">${formatScore(row.gradeLetter, isNursery)}</td>
        <td style="font-size: 10.5px; color: #475569;">${escapeHtml(row.remark || '—')}</td>
      </tr>
    `;
  }

  function getNextClass(currentClass) {
    if (!currentClass) return 'Next Grade Level';
    const c = String(currentClass).trim();
    if (c.toLowerCase().includes('nursery')) return 'Kindergarten';
    if (c.toLowerCase().includes('k-2') || c.toLowerCase().includes('kg-2')) return 'Grade 1';
    const m = c.match(/Grade\s*(\d+)/i);
    if (m) {
      const nextGrade = parseInt(m[1], 10) + 1;
      return nextGrade <= 12 ? `Grade ${nextGrade}` : 'Graduated (Senior High Diploma)';
    }
    return 'Promoted to Next Level';
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
