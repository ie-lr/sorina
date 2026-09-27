/**
 * reportCard.js
 * -----------------------------------------------------------------------
 * Full-template report card renderer (Section 6 & 10).
 * Guarantees every subject row and period column is rendered.
 * Nursery section renders A/B/C letter format with nominated letter average.
 * Standard section renders numeric (0-100) format.
 * -----------------------------------------------------------------------
 */

const ReportCard = (function () {
  /**
   * Renders a complete report card into the target DOM element.
   * @param {Object} rcData Full report card object from backend
   * @param {HTMLElement|string} target Container element or selector
   */
  function render(rcData, target) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;

    if (!rcData || !rcData.rows) {
      container.innerHTML = '<div class="alert alert-danger">No report card data available.</div>';
      return;
    }

    const school = rcData.school || {};
    const student = rcData.student || {};
    const summary = rcData.summary || {};
    const isNursery = rcData.isNursery === true;

    const html = `
      <div class="report-card-container">
        <!-- School Header -->
        <div class="rc-header">
          ${school.logo ? `<img src="${school.logo}" alt="School Logo" class="rc-logo">` : ''}
          <h2 class="rc-school-name">${escapeHtml(school.name || 'Sorina School System')}</h2>
          <div class="rc-motto">${escapeHtml(school.motto || 'Excellence in Knowledge, Character & Integrity')}</div>
          ${school.contact ? `<div style="font-size: 11.5px; color: #64748b;">${escapeHtml(school.contact)}</div>` : ''}
          <div class="rc-title">OFFICIAL STUDENT REPORT CARD</div>
          <div style="font-size: 13px; font-weight: bold; margin-top: 4px; color: #082f50;">
            Academic Year: ${escapeHtml(student.academicYear || '2026-2027')}
          </div>
        </div>

        <!-- Student Information Grid -->
        <div class="rc-student-grid">
          <div><b>Student Name:</b> ${escapeHtml(student.name || '—')}</div>
          <div><b>Student ID:</b> ${escapeHtml(student.id || '—')}</div>
          <div><b>Grade / Class:</b> ${escapeHtml(student.className || student.grade || '—')}</div>
          <div><b>Guardian:</b> ${escapeHtml(student.guardian || '—')}</div>
          <div><b>Contact:</b> ${escapeHtml(student.phone || '—')}</div>
          <div><b>Grading Mode:</b> ${isNursery ? 'Nursery (Letter Scale A/B/C)' : 'Standard (Numeric 0–100)'}</div>
        </div>

        <!-- Full Subject × Period Table (Never Collapsed) -->
        <div class="table-responsive" style="border: none;">
          <table class="rc-table">
            <thead>
              <tr>
                <th class="subject-col" style="min-width: 160px;">Subject</th>
                <th>1st P.</th>
                <th>2nd P.</th>
                <th>3rd P.</th>
                <th>Sem 1 Exam</th>
                <th style="background-color: #0b3c8a;">Sem 1 Avg</th>
                <th>4th P.</th>
                <th>5th P.</th>
                <th>6th P.</th>
                <th>Sem 2 Exam</th>
                <th style="background-color: #0b3c8a;">Sem 2 Avg</th>
                <th style="background-color: #0d47a1;">Yearly Avg</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              ${rcData.rows.map(row => renderRow(row, isNursery)).join('')}
            </tbody>
          </table>
        </div>

        <!-- Report Card Summary Box -->
        <div class="rc-summary-row">
          <div>Total Subjects: <b>${rcData.rows.length}</b></div>
          <div>Graded Subjects: <b>${summary.gradedSubjects || rcData.rows.filter(r => r.yearlyAvg).length}</b></div>
          <div>Overall Average: <b style="color: #082f50; font-size: 15px;">${summary.overallAverage || '—'}</b></div>
          <div>Overall Grade: <span class="badge ${getGradeBadgeClass(summary.overallGrade)}">${summary.overallGrade || '—'}</span></div>
          <div>Conduct: <b>${escapeHtml(summary.conduct || 'Satisfactory')}</b></div>
        </div>

        <!-- Official Signatures -->
        <div class="rc-signatures">
          <div class="rc-sign-box">
            Class Teacher Signature
          </div>
          <div class="rc-sign-box" style="border-top: none; text-align: center;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 5px;">[ OFFICIAL SCHOOL STAMP ]</div>
          </div>
          <div class="rc-sign-box">
            Principal / Registrar Signature
          </div>
        </div>

        <!-- Action Buttons (hidden in print) -->
        <div style="margin-top: 25px; text-align: right;" class="no-print">
          <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  function renderRow(row, isNursery) {
    const formatCell = val => {
      if (val === null || val === undefined || val === '') {
        return '<span class="pending-cell">—</span>';
      }
      return escapeHtml(String(val));
    };

    return `
      <tr>
        <td class="subject-col">${escapeHtml(row.subject)}</td>
        <td>${formatCell(row.p1)}</td>
        <td>${formatCell(row.p2)}</td>
        <td>${formatCell(row.p3)}</td>
        <td>${formatCell(row.exam1)}</td>
        <td style="font-weight: bold; background-color: #f1f5f9;">${formatCell(row.sem1Avg)}</td>
        <td>${formatCell(row.p4)}</td>
        <td>${formatCell(row.p5)}</td>
        <td>${formatCell(row.p6)}</td>
        <td>${formatCell(row.exam2)}</td>
        <td style="font-weight: bold; background-color: #f1f5f9;">${formatCell(row.sem2Avg)}</td>
        <td style="font-weight: 800; color: #082f50; background-color: #e2e8f0;">${formatCell(row.yearlyAvg)}</td>
        <td style="font-weight: bold;">${formatCell(row.gradeLetter)}</td>
        <td style="font-size: 11px;">${formatCell(row.remark)}</td>
      </tr>
    `;
  }

  function getGradeBadgeClass(grade) {
    const g = String(grade || '').toUpperCase();
    if (g === 'A' || g === 'A+') return 'badge-success';
    if (g === 'B') return 'badge-info';
    if (g === 'C') return 'badge-warning';
    return 'badge-danger';
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
