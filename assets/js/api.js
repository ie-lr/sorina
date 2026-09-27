/**
 * api.js
 * -----------------------------------------------------------------------
 * Fetch wrapper for communicating with the Apps Script Web App backend.
 * Automatically attaches session tokens and normalizes errors.
 * -----------------------------------------------------------------------
 */

const API = (function () {
  // Configured Web App endpoint URL
  // Can be configured in localStorage or defaults to window.APP_CONFIG.backendUrl
  function getBackendUrl() {
    return localStorage.getItem('sorina_backend_url') || (window.APP_CONFIG && window.APP_CONFIG.backendUrl) || '';
  }

  function setBackendUrl(url) {
    if (url) localStorage.setItem('sorina_backend_url', url.trim());
  }

  /**
   * Attaches the current session token to outgoing request payload.
   * @param {Object} payload
   * @return {Object}
   */
  function withSession(payload) {
    const token = sessionStorage.getItem('sorina_session_token');
    const out = Object.assign({}, payload);
    if (token) out.sessionToken = token;
    return out;
  }

  /**
   * Sends an action and payload to the Google Apps Script Web App.
   * @param {string} action
   * @param {Object} [payload={}]
   * @return {Promise<Object>}
   */
  async function callBackend(action, payload = {}) {
    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    // If no Web App URL is configured, use built-in local demo mock data
    if (!url) {
      console.info(`[API:MockMode] No backend URL configured. Handling '${action}' via local mock handler.`);
      return handleLocalMock(action, bodyData);
    }

    try {
      // Apps Script Web Apps require POST with JSON text or urlencoded params
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // avoids CORS preflight OPTIONS in GAS
        },
        body: JSON.stringify(bodyData)
      });

      if (!res.ok) {
        return { success: false, message: `HTTP Error: ${res.status} ${res.statusText}` };
      }

      const json = await res.json();
      return json;
    } catch (err) {
      console.warn('[API:Error]', err);
      // Fallback to mock if fetch fails on local file:// or connection refused
      if (window.location.protocol === 'file:' || err.message.includes('Failed to fetch')) {
        console.info(`[API:FallbackMock] Falling back to local mock data for '${action}'.`);
        return handleLocalMock(action, bodyData);
      }
      return {
        success: false,
        message: 'Could not connect to backend server. Please check network connection.'
      };
    }
  }

  /**
   * Local interactive mock data handler for zero-config testing & offline preview.
   */
  function handleLocalMock(action, data) {
    return new Promise(resolve => {
      setTimeout(() => {
        switch (action) {
          case 'getSettings':
            resolve({
              success: true,
              settings: {
                schoolName: 'Sorina School System',
                schoolMotto: 'Excellence in Knowledge, Character & Integrity',
                logoUrl: 'assets/images/school-logo.jpeg',
                campusPhotoUrl: 'assets/images/campus.jpeg',
                campusPhoto2Url: 'assets/images/campus-2.jpeg',
                primaryColor: '#082f50',
                secondaryColor: '#0d47a1',
                accentColor: '#ffd000',
                currencyCode: 'USD',
                currencySymbol: '$',
                academicYear: '2026-2027',
                timeZone: 'Africa/Monrovia',
                contactEmail: 'admin@sorinaschool.edu',
                contactPhone: '+231-770-123456',
                modules: { finance: true, lessonPlans: true, messaging: true, parentPortal: true, export: true }
              }
            });
            break;

          case 'login': {
            const userType = String(data.userType || '').toLowerCase();
            const username = String(data.username || '').trim();
            const email = String(data.email || '').trim().toLowerCase();

            if (userType === 'admin') {
              if (email !== 'admin@sorinaschool.edu' && email !== 'principal@sorinaschool.edu') {
                resolve({ success: false, message: 'Invalid admin credentials or unverified email.' });
                return;
              }
              resolve({
                success: true,
                message: 'Admin login successful.',
                sessionToken: 'mock_token_admin_123',
                user: {
                  id: 'admin',
                  username: username || 'admin',
                  name: 'Nelson S. Suah (Principal)',
                  role: 'superadmin',
                  roleTier: 'Super Administrator',
                  email: email,
                  permissions: {
                    'students:view': true, 'students:edit': true,
                    'teachers:view': true, 'teachers:edit': true,
                    'finance:view': true, 'finance:edit': true,
                    'scores:view': true, 'scores:edit': true,
                    'messaging': true, 'lesson_plans': true,
                    'export:data': true, 'settings:edit': true,
                    'backups': true, 'manage_admins': true,
                    'audit:view': true
                  }
                }
              });
            } else if (userType === 'teacher') {
              resolve({
                success: true,
                message: 'Teacher login successful.',
                sessionToken: 'mock_token_teacher_123',
                user: {
                  id: 'TCH-101',
                  name: 'Mr. David Kollie',
                  role: 'teacher',
                  phone: '+231-770-111222',
                  assignments: [
                    { class: 'Grade 1', subjects: ['Mathematics', 'General Science'] },
                    { class: 'Grade 2', subjects: ['Mathematics'] }
                  ],
                  classes: ['Grade 1', 'Grade 2']
                }
              });
            } else {
              // Student
              resolve({
                success: true,
                message: 'Student login successful.',
                sessionToken: 'mock_token_student_123',
                user: {
                  id: username || 'STU-2026-001',
                  name: 'Emmanuel Johnson',
                  role: 'student',
                  grade: 'Grade 1',
                  className: 'Grade 1',
                  academicYear: '2026-2027',
                  photo: '',
                  gradeLocked: false,
                  studentCategory: 'new',
                  guardian: 'Mary Johnson',
                  phone: '+231-886-000111'
                }
              });
            }
            break;
          }

          case 'getSubjects':
            resolve({
              success: true,
              subjects: [
                'English Language', 'Mathematics', 'General Science',
                'Social Studies', 'Computer Studies', 'Bible / Religious Education',
                'Literature', 'Physical Education'
              ]
            });
            break;

          case 'getPermissions':
            resolve({
              success: true,
              permissions: {
                p1: true, p2: true, p3: false, exam1: false,
                p4: false, p5: false, p6: false, exam2: false
              }
            });
            break;

          case 'getAllStudents':
            resolve({
              success: true,
              students: [
                {
                  id: 'STU-2026-001', name: 'Emmanuel Johnson', className: 'Grade 1', grade: 'Grade 1',
                  academicYear: '2026-2027', status: 'Active', studentCategory: 'new', gradeLocked: false,
                  guardian: 'Mary Johnson', phone: '+231-886-000111',
                  finance: { tuitionTotal: 250, totalPaid: 150, balance: 100, currency: 'USD' }
                },
                {
                  id: 'STU-2026-002', name: 'Blessing Williams', className: 'Grade 1', grade: 'Grade 1',
                  academicYear: '2026-2027', status: 'Active', studentCategory: 'old', gradeLocked: false,
                  guardian: 'James Williams', phone: '+231-770-555444',
                  finance: { tuitionTotal: 200, totalPaid: 200, balance: 0, currency: 'USD' }
                },
                {
                  id: 'STU-2026-003', name: 'Faith Toe', className: 'Nursery', grade: 'Nursery',
                  academicYear: '2026-2027', status: 'Active', studentCategory: 'new', gradeLocked: false,
                  guardian: 'Sarah Toe', phone: '+231-886-333222',
                  finance: { tuitionTotal: 180, totalPaid: 100, balance: 80, currency: 'USD' }
                }
              ]
            });
            break;

          case 'getReportCard': {
            const isNursery = String(data.studentId || '').includes('003') || String(data.className || '').toLowerCase().includes('nursery');
            const subjects = [
              'English Language', 'Mathematics', 'General Science',
              'Social Studies', 'Computer Studies', 'Bible / Religious Education'
            ];
            const rows = subjects.map((sub, idx) => ({
              subject: sub,
              p1: isNursery ? 'A' : 88 + (idx % 8),
              p2: isNursery ? 'B' : 84 + (idx % 6),
              p3: '',
              exam1: '',
              sem1Avg: isNursery ? 'A' : 86,
              p4: '', p5: '', p6: '', exam2: '', sem2Avg: '',
              yearlyAvg: isNursery ? 'A' : 86,
              gradeLetter: isNursery ? 'A' : 'B',
              remark: isNursery ? 'EXCELLENT' : 'VERY GOOD'
            }));

            resolve({
              success: true,
              gradeLocked: false,
              reportCard: {
                school: {
                  name: 'Sorina School System',
                  motto: 'Excellence in Knowledge, Character & Integrity',
                  logo: 'assets/images/school-logo.jpeg',
                  contact: '+231-770-123456 | admin@sorinaschool.edu'
                },
                student: {
                  id: data.studentId || 'STU-2026-001',
                  name: data.studentId === 'STU-2026-003' ? 'Faith Toe' : 'Emmanuel Johnson',
                  className: isNursery ? 'Nursery' : 'Grade 1',
                  grade: isNursery ? 'Nursery' : 'Grade 1',
                  academicYear: '2026-2027',
                  guardian: 'Mary Johnson',
                  phone: '+231-886-000111',
                  behaviour: 'Excellent'
                },
                isNursery: isNursery,
                columns: [
                  'Subject',
                  '1st Period', '2nd Period', '3rd Period', '1st Sem Exam', '1st Sem Avg',
                  '4th Period', '5th Period', '6th Period', '2nd Sem Exam', '2nd Sem Avg',
                  'Yearly Avg', 'Grade', 'Remark'
                ],
                rows: rows,
                summary: {
                  totalSubjects: rows.length,
                  gradedSubjects: rows.length,
                  overallAverage: isNursery ? 'A' : 86.5,
                  overallGrade: isNursery ? 'A' : 'B',
                  conduct: 'Excellent',
                  status: 'Active'
                }
              }
            });
            break;
          }

          default:
            resolve({ success: true, message: 'Action executed (local mode).' });
            break;
        }
      }, 150);
    });
  }

  return {
    callBackend: callBackend,
    withSession: withSession,
    getBackendUrl: getBackendUrl,
    setBackendUrl: setBackendUrl
  };
})();
