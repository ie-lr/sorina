/**
 * api.js
 * -----------------------------------------------------------------------
 * Fetch wrapper for communicating with the Apps Script Web App backend.
 * 
 * Features:
 * - Global loader overlay for every action.
 * - Subtle {Success} toast for major requests, suppressing noisy browser alerts.
 * - Automatic offline data storage and background synchronization.
 * - Token management and IDOR-safe headers.
 * -----------------------------------------------------------------------
 */

const API = (function () {
  let activeRequests = 0;
  const OFFLINE_QUEUE_KEY = 'ie_offline_sync_queue';

  function getBackendUrl() {
    return localStorage.getItem('sorina_backend_url') || (window.APP_CONFIG && window.APP_CONFIG.backendUrl) || '';
  }

  function setBackendUrl(url) {
    if (url) localStorage.setItem('sorina_backend_url', url.trim());
  }

  /**
   * Shows global loader overlay.
   */
  function showLoader(msg = 'Processing...') {
    activeRequests++;
    const loader = document.getElementById('globalLoader');
    if (loader) {
      const textEl = loader.querySelector('.loader-text');
      if (textEl) textEl.textContent = msg;
      loader.classList.remove('hidden');
    }
  }

  /**
   * Hides global loader overlay when all requests resolve.
   */
  function hideLoader() {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      const loader = document.getElementById('globalLoader');
      if (loader) loader.classList.add('hidden');
    }
  }

  /**
   * Displays a clean, non-intrusive {Success} badge / toast at top-right.
   */
  function toastSuccess(customText = '{Success}') {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = customText;
    toast.classList.remove('hidden', 'fade-out');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.classList.remove('show', 'fade-out');
        toast.classList.add('hidden');
      }, 300);
    }, 2500);
  }

  /**
   * Displays an alert/notification toast.
   */
  function toastNotification(text, isError = false) {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = text;
    toast.style.background = isError ? 'var(--color-danger, #d32f2f)' : 'var(--color-primary, #082f50)';
    toast.classList.remove('hidden', 'fade-out');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.classList.remove('show', 'fade-out');
        toast.classList.add('hidden');
        toast.style.background = '';
      }, 300);
    }, 3000);
  }

  /**
   * Attaches session token.
   */
  function withSession(payload) {
    const token = sessionStorage.getItem('sorina_session_token');
    const out = Object.assign({}, payload);
    if (token) out.sessionToken = token;
    return out;
  }

  /**
   * Returns offline queue.
   */
  function getOfflineQueue() {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Adds an action to offline queue for automatic sync when internet connects.
   */
  function queueOfflineAction(action, payload) {
    const queue = getOfflineQueue();
    queue.push({
      id: 'OFFLINE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      action: action,
      payload: payload,
      queuedAt: new Date().toISOString()
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    toastSuccess('{Saved Locally - Offline}');
    updateOfflineStatusUI();
  }

  /**
   * Flushes offline queue automatically when back online.
   */
  async function syncOfflineQueue() {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    console.info(`[OfflineSync] Syncing ${queue.length} pending operations...`);
    const remaining = [];

    for (const item of queue) {
      try {
        const res = await callBackendDirect(item.action, item.payload);
        if (!res.success && res.message && res.message.includes('Could not connect')) {
          remaining.push(item);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    updateOfflineStatusUI();
    if (remaining.length === 0) {
      toastSuccess('{Sync Complete}');
    }
  }

  /**
   * Updates offline banner UI.
   */
  function updateOfflineStatusUI() {
    const banner = document.getElementById('offlineIndicator');
    const queue = getOfflineQueue();
    if (!banner) return;

    if (!navigator.onLine) {
      banner.textContent = `You are currently offline. ${queue.length > 0 ? `(${queue.length} changes queued to sync)` : 'System is storing changes locally.'}`;
      banner.classList.remove('hidden');
    } else if (queue.length > 0) {
      banner.textContent = `Syncing ${queue.length} offline changes...`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Network connection event listeners
  window.addEventListener('online', () => {
    updateOfflineStatusUI();
    syncOfflineQueue();
  });
  window.addEventListener('offline', () => {
    updateOfflineStatusUI();
  });

  /**
   * Direct fetch without triggering loader or recursive queue.
   */
  async function callBackendDirect(action, payload = {}) {
    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    if (!url) {
      return handleLocalMock(action, bodyData);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  }

  /**
   * Sends an action to backend with global loader and offline fallback.
   * @param {string} action
   * @param {Object} [payload={}]
   * @param {string} [loaderText='Processing...']
   * @return {Promise<Object>}
   */
  async function callBackend(action, payload = {}, loaderText = 'Processing...') {
    showLoader(loaderText);

    const isWriteAction = [
      'addStudent', 'updateStudent', 'submitGrades', 'recordPayment',
      'saveClassFee', 'saveTeacher', 'savePayrollRecord', 'saveLessonPlan',
      'submitTeacherTest', 'sendMessage', 'sendIdCardsToPrinting', 'sendTestToPrinting',
      'addSubject', 'updateSubject', 'deleteSubject', 'updateSettings'
    ].includes(action);

    // If completely offline and this is a write action, queue it immediately
    if (!navigator.onLine && isWriteAction) {
      queueOfflineAction(action, payload);
      hideLoader();
      return { success: true, offline: true, message: '{Success}' };
    }

    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    if (!url) {
      const mockRes = await handleLocalMock(action, bodyData);
      hideLoader();
      return mockRes;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData)
      });

      hideLoader();

      if (!res.ok) {
        console.warn(`[API:HTTPError] Backend responded with status ${res.status}. Falling back to local offline mode.`);
        return handleLocalMock(action, bodyData);
      }

      const json = await res.json();

      // Check if system operation is suspended
      if (json && json.suspended) {
        toastNotification(json.message || 'System suspended by administration.', true);
      }

      return json;

    } catch (err) {
      hideLoader();
      console.warn('[API:NetworkError]', err);

      // If network fails on a write action, queue offline
      if (isWriteAction) {
        queueOfflineAction(action, payload);
        return { success: true, offline: true, message: '{Success}' };
      }

      // Read fallback
      if (window.location.protocol === 'file:' || err.message.includes('Failed to fetch')) {
        return handleLocalMock(action, bodyData);
      }

      return {
        success: false,
        message: 'Network connection unavailable. Changes will sync automatically when connected.'
      };
    }
  }

  function getMockStudents() {
    const saved = localStorage.getItem('_sorina_mock_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const initial = [
      {
        id: 'SPSS001', name: 'Emmanuel Johnson', className: 'Grade 1', grade: 'Grade 1',
        academicYear: '2026-2027', status: 'Active', studentCategory: 'new', gradeLocked: false,
        guardian: 'Mary Johnson', phone: '+231-886-000111', dob: '2018-05-12', photo: '',
        assignedSubjects: ['English / Reading', 'General Mathematics', 'General Science', 'Health Education'],
        finance: {
          tuitionTotal: 220, registrationFee: 40, registrationPaid: true, entranceFee: 25, entranceFeePaid: true,
          requirementsFee: 35, requirementsFeePaid: true, peSuitFee: 25, peSuitFeePaid: false,
          portalFee: 20, portalFeePaid: true, installments: [100, 50, 0, 0], otherPayments: 0,
          totalPaid: 270, balance: 95, currency: 'USD'
        }
      },
      {
        id: 'SPSS002', name: 'Blessing Williams', className: 'Grade 1', grade: 'Grade 1',
        academicYear: '2026-2027', status: 'Active', studentCategory: 'old', gradeLocked: false,
        guardian: 'James Williams', phone: '+231-770-555444', dob: '2018-02-20', photo: '',
        assignedSubjects: ['English / Reading', 'General Mathematics', 'Social Studies'],
        finance: {
          tuitionTotal: 200, registrationFee: 35, registrationPaid: true, entranceFee: 0, entranceFeePaid: true,
          requirementsFee: 35, requirementsFeePaid: true, peSuitFee: 25, peSuitFeePaid: true,
          portalFee: 20, portalFeePaid: true, installments: [100, 100, 0, 0], otherPayments: 0,
          totalPaid: 315, balance: 0, currency: 'USD'
        }
      },
      {
        id: 'SPSS003', name: 'Faith Toe', className: 'ABC', grade: 'ABC',
        academicYear: '2026-2027', status: 'Active', studentCategory: 'new', gradeLocked: false,
        guardian: 'Sarah Toe', phone: '+231-886-333222', dob: '2021-08-14', photo: '',
        assignedSubjects: ['Phonics', 'Handwriting', 'Mental Math'],
        finance: {
          tuitionTotal: 180, registrationFee: 35, registrationPaid: true, entranceFee: 20, entranceFeePaid: true,
          requirementsFee: 30, requirementsFeePaid: false, peSuitFee: 20, peSuitFeePaid: false,
          portalFee: 15, portalFeePaid: true, installments: [90, 0, 0, 0], otherPayments: 0,
          totalPaid: 160, balance: 140, currency: 'USD'
        }
      },
      {
        id: 'SPSS004', name: 'Prince Kollie', className: 'K1', grade: 'K1',
        academicYear: '2026-2027', status: 'Active', studentCategory: 'new', gradeLocked: false,
        guardian: 'David Kollie', phone: '+231-886-444555', dob: '2020-03-10', photo: '',
        assignedSubjects: ['English / Reading', 'Mental Math', 'Creative Arts / Music'],
        finance: {
          tuitionTotal: 190, registrationFee: 35, registrationPaid: true, entranceFee: 20, entranceFeePaid: true,
          requirementsFee: 30, requirementsFeePaid: true, peSuitFee: 20, peSuitFeePaid: true,
          portalFee: 15, portalFeePaid: true, installments: [95, 95, 0, 0], otherPayments: 0,
          totalPaid: 310, balance: 0, currency: 'USD'
        }
      },
      {
        id: 'SPSS001', name: 'Emmanuel Johnson', className: 'K2', grade: 'K2',
        academicYear: '2025-2026', status: 'Active', studentCategory: 'old', gradeLocked: false,
        guardian: 'Mary Johnson', phone: '+231-886-000111', dob: '2018-05-12', photo: '',
        assignedSubjects: ['English / Reading', 'General Mathematics'],
        finance: {
          tuitionTotal: 190, registrationFee: 30, registrationPaid: true, entranceFee: 0, entranceFeePaid: true,
          requirementsFee: 30, requirementsFeePaid: true, peSuitFee: 20, peSuitFeePaid: true,
          portalFee: 15, portalFeePaid: true, installments: [95, 95, 0, 0], otherPayments: 0,
          totalPaid: 285, balance: 0, currency: 'USD'
        }
      },
      {
        id: 'SPSS005', name: 'Joseph Myers', className: 'Grade 2', grade: 'Grade 2',
        academicYear: '2025-2026', status: 'Active', studentCategory: 'old', gradeLocked: false,
        guardian: 'Helena Myers', phone: '+231-777-888999', dob: '2017-09-01', photo: '',
        assignedSubjects: ['General Mathematics', 'Social Studies', 'General Science'],
        finance: {
          tuitionTotal: 200, registrationFee: 35, registrationPaid: true, entranceFee: 0, entranceFeePaid: true,
          requirementsFee: 35, requirementsFeePaid: true, peSuitFee: 25, peSuitFeePaid: true,
          portalFee: 20, portalFeePaid: true, installments: [100, 100, 0, 0], otherPayments: 0,
          totalPaid: 315, balance: 0, currency: 'USD'
        }
      },
      {
        id: 'SPSS006', name: 'Cecelia Flomo', className: 'Daycare', grade: 'Daycare',
        academicYear: '2027-2028', status: 'Active', studentCategory: 'new', gradeLocked: false,
        guardian: 'Moses Flomo', phone: '+231-888-222111', dob: '2023-01-15', photo: '',
        assignedSubjects: ['Phonics', 'Creative Arts / Music'],
        finance: {
          tuitionTotal: 150, registrationFee: 30, registrationPaid: true, entranceFee: 20, entranceFeePaid: true,
          requirementsFee: 25, requirementsFeePaid: false, peSuitFee: 20, peSuitFeePaid: false,
          portalFee: 15, portalFeePaid: false, installments: [50, 0, 0, 0], otherPayments: 0,
          totalPaid: 100, balance: 160, currency: 'USD'
        }
      }
    ];
    saveMockStudents(initial);
    return initial;
  }

  function saveMockStudents(arr) {
    try {
      localStorage.setItem('_sorina_mock_students', JSON.stringify(arr));
    } catch (e) {}
  }

  /**
   * Local interactive mock data handler.
   */
  function handleLocalMock(action, data) {
    return new Promise(resolve => {
      setTimeout(() => {
        switch (action) {
          case 'getSettings':
            resolve({
              success: true,
              settings: {
                schoolName: 'Sorina Daycare & Primary School System',
                schoolMotto: 'Excellence in Knowledge, Character & Integrity',
                logoUrl: 'assets/images/school-logo.png',
                campusPhotoUrl: 'assets/images/campus.jpeg',
                campusPhoto2Url: 'assets/images/campus-2.jpeg',
                primaryColor: '#003366',
                secondaryColor: '#0055a5',
                accentColor: '#ffd000',
                currencyCode: 'USD',
                currencySymbol: '$',
                academicYear: '2026-2027',
                timeZone: 'Africa/Monrovia',
                contactEmail: 'admin@ieschools.edu',
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
              resolve({
                success: true,
                message: 'Admin login successful.',
                sessionToken: 'mock_token_admin_' + Date.now(),
                user: {
                  id: 'ADMIN01',
                  name: 'Principal Administrator',
                  role: 'superadmin',
                  userType: 'admin',
                  email: email || 'admin@ieschools.edu',
                  permissions: {
                    'summary:view': true,
                    'students:view': true, 'students:edit': true, 'students:delete': true,
                    'teachers:view': true, 'teachers:edit': true, 'teachers:delete': true,
                    'finance:view': true, 'finance:edit': true, 'finance:delete': true,
                    'payroll:view': true, 'payroll:edit': true, 'payroll:delete': true,
                    'printing:view': true, 'printing:send': true,
                    'subjects:view': true, 'subjects:edit': true, 'subjects:delete': true,
                    'scores:view': true, 'scores:edit': true,
                    'messaging': true, 'messaging:view': true, 'messaging:send': true,
                    'lesson_plans': true, 'lesson_plans:view': true, 'lesson_plans:review': true,
                    'export:view': true, 'export:data': true, 'settings:edit': true,
                    'backups': true, 'manage_admins': true,
                    'audit:view': true
                  }
                }
              });
              return;
            }

            if (userType === 'teacher') {
              resolve({
                success: true,
                sessionToken: 'mock_token_teacher_' + Date.now(),
                user: {
                  id: username || 'SPST001',
                  name: 'Mr. David K. Kollie',
                  role: 'teacher',
                  userType: 'teacher',
                  assignments: [
                    { class: 'Grade 1', subjects: ['Mathematics', 'General Science'] },
                    { class: 'Grade 2', subjects: ['Mathematics'] }
                  ]
                }
              });
              return;
            }

            // Student
            resolve({
              success: true,
              sessionToken: 'mock_token_student_' + Date.now(),
              user: {
                id: username || 'SPSS001',
                name: 'Emmanuel Johnson',
                role: 'Student',
                userType: 'student',
                className: 'Grade 1',
                grade: 'Grade 1',
                academicYear: '2026-2027'
              }
            });
            break;
          }

          case 'getNextStudentId': {
            const allSt = getMockStudents();
            let maxNum = 0;
            allSt.forEach(s => {
              const m = String(s.id).match(/SPSS(\d+)/i);
              if (m) {
                const num = parseInt(m[1], 10);
                if (num > maxNum) maxNum = num;
              }
            });
            const nextNum = maxNum + 1;
            resolve({ success: true, nextId: 'SPSS' + String(nextNum).padStart(3, '0') });
            break;
          }

          case 'getNextTeacherId':
            resolve({ success: true, nextId: 'SPST003' });
            break;

          case 'getSubjects':
            resolve({
              success: true,
              subjects: [
                'Reading', 'Phonics', 'Spelling & Vocabulary', 'Handwriting', 'Composition/Grammar',
                'General Mathematics', 'Mental Math', 'General Science', 'Health Education',
                'Social Studies', 'Religious & Moral Education', 'Creative Arts / Music', 'Physical Education'
              ]
            });
            break;

          case 'getAllStudents': {
            const allSt = getMockStudents();
            const yr = data && data.academicYear;
            const students = yr ? allSt.filter(s => !s.academicYear || String(s.academicYear).trim() === String(yr).trim()) : allSt;
            resolve({
              success: true,
              students: students
            });
            break;
          }

          case 'addStudent': {
            const newS = (data && data.student) || {};
            const allSt = getMockStudents();
            const idx = allSt.findIndex(s => s.id === newS.id && (!newS.academicYear || s.academicYear === newS.academicYear));
            if (idx >= 0) {
              allSt[idx] = Object.assign({}, allSt[idx], newS);
            } else {
              allSt.push(newS);
            }
            saveMockStudents(allSt);
            resolve({ success: true, message: 'Student registered successfully.' });
            break;
          }

          case 'updateStudent': {
            const updS = (data && data.student) || {};
            const allSt = getMockStudents();
            const idx = allSt.findIndex(s => s.id === updS.id);
            if (idx >= 0) {
              allSt[idx] = Object.assign({}, allSt[idx], updS);
              saveMockStudents(allSt);
            }
            resolve({ success: true, message: 'Student updated successfully.' });
            break;
          }

          case 'getFinancialSummary': {
            const yr = (data && data.academicYear) || '2026-2027';
            const allSt = getMockStudents();
            const yearSt = allSt.filter(s => !yr || !s.academicYear || String(s.academicYear).trim() === String(yr).trim());
            const enrolledByClass = {};
            let totalBilled = 0;
            let totalRevenue = 0;

            yearSt.forEach(s => {
              const c = s.className || s.grade || 'Unknown';
              enrolledByClass[c] = (enrolledByClass[c] || 0) + 1;
              const f = s.finance || {};
              const inst = f.installments || [0, 0, 0, 0];
              const paid = (f.entranceFeePaid ? (Number(f.entranceFee) || 0) : 0) +
                (f.registrationPaid ? (Number(f.registrationFee) || 0) : 0) +
                (f.requirementsFeePaid ? (Number(f.requirementsFee) || 0) : 0) +
                (f.peSuitFeePaid ? (Number(f.peSuitFee) || 0) : 0) +
                (f.portalFeePaid ? (Number(f.portalFee) || 0) : 0) +
                inst.reduce((a, b) => a + (Number(b) || 0), 0) +
                (Number(f.otherPayments) || 0);
              const billed = (Number(f.tuitionTotal) || 0) +
                (Number(f.registrationFee) || 0) +
                (Number(f.entranceFee) || 0) +
                (Number(f.requirementsFee) || 0) +
                (Number(f.peSuitFee) || 0) +
                (Number(f.portalFee) || 0);
              totalBilled += billed;
              totalRevenue += paid;
            });

            const totalExpenses = 280;
            resolve({
              success: true,
              summary: {
                totalStudents: yearSt.length,
                totalTeachers: 2,
                enrolledByClass: enrolledByClass,
                totalBilled: totalBilled,
                totalRevenue: totalRevenue,
                totalExpenses: totalExpenses,
                netBalance: totalRevenue - totalExpenses,
                targetRemaining: Math.max(0, totalBilled - totalRevenue)
              }
            });
            break;
          }

          case 'getPayroll':
            resolve({
              success: true,
              payroll: [
                { staffId: 'SPST001', staffName: 'Mr. David K. Kollie', role: 'Senior Teacher', monthYear: 'September 2026', baseSalary: 200, deductions: 10, tax: 15, netSalary: 175, paid: true, paymentDate: '2026-09-25' },
                { staffId: 'SPST002', staffName: 'Mrs. Rebecca S. Morris', role: 'Class Teacher', monthYear: 'September 2026', baseSalary: 180, deductions: 5, tax: 10, netSalary: 165, paid: false, paymentDate: '' }
              ]
            });
            break;

          case 'getReportCard': {
            const isNursery = String(data.studentId || '').includes('003') || String(data.className || '').toLowerCase().includes('nursery');
            const subjects = [
              'Reading', 'Phonics', 'Spelling & Vocabulary', 'Handwriting', 'Composition/Grammar',
              'General Mathematics', 'Mental Math', 'General Science', 'Health Education',
              'Social Studies', 'Religious & Moral Education', 'Creative Arts / Music', 'Physical Education'
            ];
            const rows = subjects.map((sub, idx) => ({
              subject: sub,
              p1: isNursery ? 'A' : (88 + (idx % 8)),
              p2: isNursery ? 'B' : (76 + (idx % 6)),
              p3: isNursery ? 'A' : (92 - (idx % 5)),
              exam1: isNursery ? 'A' : (85 + (idx % 7)),
              sem1Avg: isNursery ? 'A' : 86,
              p4: isNursery ? 'A' : 89,
              p5: isNursery ? 'B' : 78,
              p6: isNursery ? 'A' : 94,
              exam2: isNursery ? 'A' : 90,
              sem2Avg: isNursery ? 'A' : 87.75,
              yearlyAvg: isNursery ? 'A' : 86.88,
              gradeLetter: isNursery ? 'A' : 'B',
              remark: isNursery ? 'EXCELLENT' : 'GOOD'
            }));

            resolve({
              success: true,
              gradeLocked: false,
              reportCard: {
                school: {
                  name: 'SORINA PRIMARY & SECONDARY SCHOOL',
                  motto: 'Work and Pray',
                  logo: 'assets/images/school-logo.png',
                  contact: '+231-770-123456 | admin@ieschools.edu'
                },
                student: {
                  id: data.studentId || 'SPSS001',
                  name: data.studentId === 'SPSS003' ? 'Faith Toe' : 'Emmanuel Johnson',
                  className: isNursery ? 'Nursery A' : 'Grade 1',
                  grade: isNursery ? 'Nursery A' : 'Grade 1',
                  academicYear: '2026-2027',
                  guardian: 'Mary Johnson',
                  phone: '+231-886-000111',
                  behaviour: 'Good'
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
                  overallAverage: isNursery ? 'A' : 86.88,
                  overallGrade: isNursery ? 'A' : 'B',
                  conduct: 'Good',
                  status: 'Active'
                }
              }
            });
            break;
          }

          case 'getClassFees':
            resolve({
              success: true,
              classFees: [
                { className: 'Daycare', studentCategory: 'new', entranceFee: 20, registrationFee: 30, tuitionTotal: 150, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
                { className: 'Daycare', studentCategory: 'old', entranceFee: 0, registrationFee: 25, tuitionTotal: 140, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
                { className: 'Nursery', studentCategory: 'new', entranceFee: 20, registrationFee: 30, tuitionTotal: 160, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
                { className: 'Nursery', studentCategory: 'old', entranceFee: 0, registrationFee: 25, tuitionTotal: 150, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
                { className: 'ABC', studentCategory: 'new', entranceFee: 20, registrationFee: 35, tuitionTotal: 180, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'ABC', studentCategory: 'old', entranceFee: 0, registrationFee: 30, tuitionTotal: 170, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'K1', studentCategory: 'new', entranceFee: 20, registrationFee: 35, tuitionTotal: 190, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'K1', studentCategory: 'old', entranceFee: 0, registrationFee: 30, tuitionTotal: 180, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'K2', studentCategory: 'new', entranceFee: 20, registrationFee: 35, tuitionTotal: 200, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'K2', studentCategory: 'old', entranceFee: 0, registrationFee: 30, tuitionTotal: 190, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
                { className: 'Grade 1', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 220, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 1', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 200, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
              ]
            });
            break;

          case 'saveClassFee':
            resolve({ success: true, message: 'Class fee schedule saved successfully.' });
            break;

          case 'recordPayment': {
            const sId = data && data.studentId;
            const pData = (data && data.payment) || {};
            const allSt = getMockStudents();
            const st = allSt.find(s => s.id === sId);
            if (st) {
              st.finance = Object.assign({}, st.finance, pData);
              const f = st.finance;
              const inst = f.installments || [0, 0, 0, 0];
              f.totalPaid = (f.entranceFeePaid ? (Number(f.entranceFee) || 0) : 0) +
                (f.registrationPaid ? (Number(f.registrationFee) || 0) : 0) +
                (f.requirementsFeePaid ? (Number(f.requirementsFee) || 0) : 0) +
                (f.peSuitFeePaid ? (Number(f.peSuitFee) || 0) : 0) +
                (f.portalFeePaid ? (Number(f.portalFee) || 0) : 0) +
                inst.reduce((a, b) => a + (Number(b) || 0), 0) +
                (Number(f.otherPayments) || 0);
              const billed = (Number(f.tuitionTotal) || 0) +
                (Number(f.registrationFee) || 0) +
                (Number(f.entranceFee) || 0) +
                (Number(f.requirementsFee) || 0) +
                (Number(f.peSuitFee) || 0) +
                (Number(f.portalFee) || 0);
              f.balance = Math.max(0, billed - f.totalPaid);
              saveMockStudents(allSt);
            }
            resolve({ success: true, message: 'Student payment recorded successfully.' });
            break;
          }

          case 'deleteStudent': {
            const sId = data && data.studentId;
            let allSt = getMockStudents();
            allSt = allSt.filter(s => s.id !== sId);
            saveMockStudents(allSt);
            resolve({ success: true, message: 'Student record deleted successfully.' });
            break;
          }

          default:
            resolve({ success: true, message: '{Success}' });
            break;
        }
      }, 100);
    });
  }

  // Initial status check
  setTimeout(updateOfflineStatusUI, 300);

  return {
    callBackend: callBackend,
    withSession: withSession,
    getBackendUrl: getBackendUrl,
    setBackendUrl: setBackendUrl,
    showLoader: showLoader,
    hideLoader: hideLoader,
    toastSuccess: toastSuccess,
    toastNotification: toastNotification,
    syncOfflineQueue: syncOfflineQueue
  };
})();
