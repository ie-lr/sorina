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
      return { success: false, message: 'Backend URL is not configured. No data can be read or saved.' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  }

  /**
   * Sends an action to backend with global loader and truthful status reporting.
   * @param {string} action
   * @param {Object} [payload={}]
   * @param {string} [loaderText='Processing...']
   * @return {Promise<Object>}
   */
  async function callBackend(action, payload = {}, loaderText = 'Processing...') {
    showLoader(loaderText);

    const isWriteAction = [
      'addStudent', 'updateStudent', 'deleteStudent', 'dropStudent', 'undropStudent', 'setGradeLock',
      'saveTeacher', 'deleteTeacher', 'submitGrades', 'teacherSubmitGrades',
      'recordPayment', 'saveFinance', 'clearFinance', 'saveClassFee', 'saveFeeItem', 'deleteFeeItem',
      'saveExpense', 'deleteExpense',
      'saveLessonPlan', 'reviewLessonPlan',
      'sendMessage', 'adminSendIeMessage', 'markMessagesRead',
      'createAdmin', 'updateAdminProfile', 'updateAdminPermissions', 'removeAdmin',
      'sendIdCardsToPrinting',
      'addSubject', 'updateSubject', 'deleteSubject', 'saveSubjects', 'saveCurriculumSubjects', 'savePermissions',
      'updateSettings', 'saveAnnouncement', 'deleteAnnouncement', 'changePassword'
    ].includes(action);

    // If completely offline and this is a write action, queue it and inform caller
    if (!navigator.onLine && isWriteAction) {
      queueOfflineAction(action, payload);
      hideLoader();
      return { success: false, offline: true, message: 'You are currently offline. Changes queued to sync when internet reconnects.' };
    }

    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    if (!url) {
      hideLoader();
      const msg = 'Backend URL is not configured, so nothing was ' + (isWriteAction ? 'saved' : 'loaded') + '. Set the Apps Script Web App URL first.';
      toastNotification(msg, true);
      return { success: false, message: msg };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData)
      });

      hideLoader();

      if (!res.ok) {
        console.error(`[API:HTTPError] Backend responded with HTTP ${res.status} for action "${action}".`);
        const msg = res.status === 404
          ? 'Backend endpoint returned 404 Not Found. Ensure your Google Apps Script Web App is deployed with "Who has access" set to "Anyone".'
          : `Backend server error (${res.status}). Database could not process this request.`;
        toastNotification(msg, true);
        return { success: false, message: msg };
      }

      const json = await res.json();

      // Check if system operation is suspended
      if (json && json.suspended) {
        toastNotification(json.message || 'System suspended by administration.', true);
      }

      return json;

    } catch (err) {
      hideLoader();
      console.error('[API:NetworkError]', err);

      // If network fails on a write action, alert the user and do NOT claim success
      if (isWriteAction) {
        const errorMsg = 'Failed to reach database: ' + (err.message || 'Network error') + '. Check your internet connection or Google Apps Script deployment URL.';
        toastNotification(errorMsg, true);
        return {
          success: false,
          offline: true,
          message: errorMsg
        };
      }

      // No local fallback: only real database results are ever shown.
      return {
        success: false,
        message: 'Could not reach the database: ' + (err.message || 'network error') + '.'
      };
    }
  }

  function getMockStudents() {
    const saved = localStorage.getItem('_sorina_mock_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(st => {
            if (!Array.isArray(st.curriculumSubjects)) {
              st.curriculumSubjects = Array.isArray(st.assignedSubjects)
                ? Array.from(new Set(st.assignedSubjects.map(x=>String(x||'').trim()).filter(Boolean)))
                : [];
            }
            delete st.assignedSubjects;
          });
          return parsed;
        }
      } catch (e) {}
    }
    const initial = [
      {
        id: 'SJSH001', name: 'Emmanuel Johnson', className: 'Grade 1', grade: 'Grade 1',
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
        id: 'SJSH002', name: 'Blessing Williams', className: 'Grade 1', grade: 'Grade 1',
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
        id: 'SJSH003', name: 'Faith Toe', className: 'ABC', grade: 'ABC',
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
        id: 'SJSH004', name: 'Prince Kollie', className: 'K1', grade: 'K1',
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
        id: 'SJSH001', name: 'Emmanuel Johnson', className: 'K2', grade: 'K2',
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
        id: 'SJSH005', name: 'Joseph Myers', className: 'Grade 2', grade: 'Grade 2',
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
        id: 'SJSH006', name: 'Cecelia Flomo', className: 'Daycare', grade: 'Daycare',
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
    initial.forEach(st => {
      st.curriculumSubjects = Array.isArray(st.curriculumSubjects)
        ? Array.from(new Set(st.curriculumSubjects.map(x=>String(x||'').trim()).filter(Boolean)))
        : (Array.isArray(st.assignedSubjects)
          ? Array.from(new Set(st.assignedSubjects.map(x=>String(x||'').trim()).filter(Boolean)))
          : []);
      delete st.assignedSubjects;
    });
    saveMockStudents(initial);
    return initial;
  }

  function saveMockStudents(arr) {
    try {
      localStorage.setItem('_sorina_mock_students', JSON.stringify(arr));
    } catch (e) {}
  }

  function getMockTeachers() {
    const DIRECTORY_VERSION = '2026-10-teaching-staff-v3-clean';
    try {
      if (localStorage.getItem('_sorina_teacher_directory_version') !== DIRECTORY_VERSION) {
        // Rebuild the directory cleanly as requested: all legacy teacher records are removed.
        localStorage.removeItem('_sorina_mock_teachers');
        localStorage.setItem('_sorina_teacher_directory_version', DIRECTORY_VERSION);
      }
      const saved = JSON.parse(localStorage.getItem('_sorina_mock_teachers') || 'null');
      if (Array.isArray(saved)) {
        saved.forEach(x=>{
          if(!x.password)x.password='teacher123';
          if(!Array.isArray(x.assignments))x.assignments=[];
          if(!x.academicYear)x.academicYear='2026-2027';
          if(!x.status)x.status='Active';
        });
        saveMockTeachers(saved); return saved;
      }
    } catch (e) {}
    const initial = [];
    localStorage.setItem('_sorina_mock_teachers', JSON.stringify(initial));
    return initial;
  }
  function saveMockTeachers(arr){ try{localStorage.setItem('_sorina_mock_teachers',JSON.stringify(arr));}catch(e){} }
  function getMockSubjects(){
    try{const s=JSON.parse(localStorage.getItem('_sorina_subject_catalog')||'null');if(Array.isArray(s)&&s.length)return s;}catch(e){}
    const initial=['English / Reading','Phonics','Spelling & Vocabulary','Handwriting','Composition / Grammar','General Mathematics','Mental Math','General Science','Health Education','Social Studies','Religious & Moral Education','Creative Arts / Music','Physical Education'];
    localStorage.setItem('_sorina_subject_catalog',JSON.stringify(initial)); return initial;
  }
  function saveMockSubjects(arr){try{localStorage.setItem('_sorina_subject_catalog',JSON.stringify(arr));}catch(e){}}
  function getMockPermissions(){try{const p=JSON.parse(localStorage.getItem('_sorina_grading_permissions')||'null');if(p&&typeof p==='object')return p;}catch(e){} return {p1:true,p2:true,p3:true,exam1:true,p4:true,p5:true,p6:true,exam2:true};}
  function saveMockPermissions(p){try{localStorage.setItem('_sorina_grading_permissions',JSON.stringify(p));}catch(e){}}
  function getMockClassFees(){try{const f=JSON.parse(localStorage.getItem('_sorina_class_fees')||'null');if(Array.isArray(f)&&f.length)return f;}catch(e){} return [];}
  function saveMockClassFees(f){try{localStorage.setItem('_sorina_class_fees',JSON.stringify(f));}catch(e){}}
  function getMockFeeItems(){try{const f=JSON.parse(localStorage.getItem('_sorina_fee_items')||'[]');return Array.isArray(f)?f:[];}catch(e){return [];}}
  function saveMockFeeItems(f){try{localStorage.setItem('_sorina_fee_items',JSON.stringify(f));}catch(e){}}
  function getPaymentNotifications(studentId){
    const st=getMockStudents().find(x=>String(x.id)===String(studentId))||{};
    const f=st.finance||{};
    const inst=Array.isArray(f.installments)?f.installments:[0,0,0,0,0];
    const schedules=getMockClassFees();
    const sched=schedules.find(x=>String(x.className||'')===String(st.className||st.grade||'') && String(x.studentCategory||'new')===String(st.studentCategory||'new'))||{};
    const deadlines=Array.isArray(f.deadlines)&&f.deadlines.length?f.deadlines:(Array.isArray(sched.deadlines)?sched.deadlines:[]);
    const now=new Date();
    const notifications=[];
    deadlines.forEach((deadline,i)=>{
      if(!deadline || i>=inst.length || Number(inst[i]||0)>0) return;
      const due=new Date(deadline);
      if(isNaN(due.getTime()) || due>=now) return;
      const n=i+1;
      const suffix=n===1?'st':n===2?'nd':n===3?'rd':'th';
      const key=`${st.id}::${st.academicYear||'2026-2027'}::${n}::${String(deadline).slice(0,10)}`;
      notifications.push({id:'PAY-'+btoa(key).replace(/[^a-zA-Z0-9]/g,'').slice(0,40),type:'payment-overdue',severity:'warning',unread:true,installment:n,deadline:String(deadline).slice(0,10),title:`${n}${suffix} Payment Overdue`,message:`Your ${n}${suffix} installment payment deadline has passed and this payment is still outstanding. Please contact the school business office and make the required payment.`});
    });
    return notifications;
  }
  function getMockAuditLog(){try{const a=JSON.parse(localStorage.getItem('_sorina_demo_audit_log')||'null');if(Array.isArray(a)&&a.length)return a;}catch(e){} const now=new Date().toISOString(); const demo=[{timestamp:now,actor:'System Administrator',action:'System initialized',target:'Sorina School System',outcome:'SUCCESS'},{timestamp:new Date(Date.now()-3600000).toISOString(),actor:'System Administrator',action:'Academic year configuration reviewed',target:'2026–2027',outcome:'SUCCESS'},{timestamp:new Date(Date.now()-7200000).toISOString(),actor:'Demo User',action:'Fee schedule viewed',target:'Class Fee Schedule',outcome:'SUCCESS'},{timestamp:new Date(Date.now()-10800000).toISOString(),actor:'System Administrator',action:'Teacher directory cleared',target:'Teaching Staff',outcome:'SUCCESS'}]; localStorage.setItem('_sorina_demo_audit_log',JSON.stringify(demo)); return demo;}
  function saveMockAuditLog(a){try{localStorage.setItem('_sorina_demo_audit_log',JSON.stringify(a));}catch(e){}}
  function getMockGrades(){try{const g=JSON.parse(localStorage.getItem('_sorina_grades')||'{}');return g&&typeof g==='object'?g:{};}catch(e){return {};}}
  function saveMockGrades(g){try{localStorage.setItem('_sorina_grades',JSON.stringify(g));}catch(e){}}
  function gradeKey(studentId, subject, year){return [studentId,year||'2026-2027',subject].join('::');}
  function isLetterClass(cls){return ['Daycare','Nursery','ABC'].includes(String(cls||''));}
  function averageGrades(g){
    const vals=['p1','p2','p3','exam1','p4','p5','p6','exam2'].map(k=>g[k]).filter(v=>v!==''&&v!==null&&v!==undefined&&!isNaN(Number(v))).map(Number);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100 : null;
  }
  function gradeRemark(avg){if(avg===null)return '';if(avg>=70)return 'PASS';if(avg>=60)return 'NEEDS IMPROVEMENT';return 'BELOW PASS';}

  /**
   * Local interactive mock data handler.
   */
  function handleLocalMock(action, data) {
  function getMockAdminAccounts(){
    try { const a=JSON.parse(localStorage.getItem('_sorina_admin_accounts')||'[]'); return Array.isArray(a)?a:[]; } catch(e){ return []; }
  }
  function saveMockAdminAccounts(a){ localStorage.setItem('_sorina_admin_accounts', JSON.stringify(a||[])); }
  function getMockSettings(){
    const defaults={schoolName:'Sorina Daycare & Primary School System',schoolMotto:'Excellence in Knowledge, Character & Integrity',logoUrl:'assets/images/school-logo.png',campusPhotoUrl:'assets/images/campus.jpeg',campusPhoto2Url:'assets/images/campus-2.jpeg',primaryColor:'#003366',secondaryColor:'#0055a5',accentColor:'#ffd000',currencyCode:'USD',currencySymbol:'$',academicYear:'2026-2027',timeZone:'Africa/Monrovia',contactEmail:'admin@ieschools.edu',contactPhone:'+231-770-123456',modules:{finance:true,lessonPlans:true,messaging:true,parentPortal:true,export:true}};
    try { const saved=JSON.parse(localStorage.getItem('_sorina_school_settings')||'null'); return Object.assign({},defaults,saved||{},{modules:Object.assign({},defaults.modules,(saved&&saved.modules)||{})}); } catch(e){ return defaults; }
  }
  function saveMockSettings(settings){ localStorage.setItem('_sorina_school_settings', JSON.stringify(settings||{})); }
  function adminPermissionMap(){
    return { 'summary:view':true,'students:view':true,'students:edit':true,'students:delete':true,'teachers:view':true,'teachers:edit':true,'teachers:delete':true,'finance:view':true,'finance:edit':true,'finance:delete':true,'expenses:view':true,'expenses:edit':true,'expenses:delete':true,'subjects:view':true,'subjects:edit':true,'subjects:delete':true,'scores:view':true,'scores:edit':true,'printing:view':true,'printing:send':true,'messaging:view':true,'messaging:send':true,'lesson_plans:view':true,'export:view':true,'settings:edit':true,'audit:view':true };
  }
    return new Promise(resolve => {
      setTimeout(() => {
        switch (action) {
          case 'getSettings':
            resolve({success:true,settings:getMockSettings()});
            break;

          case 'updateSettings': {
            const incoming=(data&&data.settings)||{}; const current=getMockSettings();
            const next=Object.assign({},current,incoming,{modules:Object.assign({},current.modules,incoming.modules||{})});
            saveMockSettings(next); resolve({success:true,message:'School settings updated successfully.',settings:next}); break;
          }

          case 'changePassword': {
            const username=String(data&&data.username||'').trim(), oldPassword=String(data&&data.currentPassword||''), newPassword=String(data&&data.newPassword||'');
            if(newPassword.length<6){resolve({success:false,message:'Password must be at least 6 characters.'});break;}
            if(username.toLowerCase()==='admin'){
              const stored=localStorage.getItem('_sorina_superadmin_password')||'12345';
              if(oldPassword!==stored){resolve({success:false,message:'Current password is incorrect.'});break;}
              localStorage.setItem('_sorina_superadmin_password',newPassword); resolve({success:true,message:'Administrator password updated successfully.'}); break;
            }
            const accounts=getMockAdminAccounts(),i=accounts.findIndex(a=>String(a.username||'').toLowerCase()===username.toLowerCase());
            if(i<0){resolve({success:false,message:'Administrator account not found.'});break;}
            if(String(accounts[i].password||'')!==oldPassword){resolve({success:false,message:'Current password is incorrect.'});break;}
            accounts[i].password=newPassword; saveMockAdminAccounts(accounts); resolve({success:true,message:'Administrator password updated successfully.'}); break;
          }

          case 'login': {
            const userType = String(data.userType || '').toLowerCase();
            const username = String(data.username || '').trim();
            const email = String(data.email || '').trim().toLowerCase();

            if (userType === 'admin') {
              const adminAccounts = getMockAdminAccounts();
              const requestedUsername = username.toLowerCase();
              const staffAdmin = adminAccounts.find(a => String(a.username||'').toLowerCase()===requestedUsername && String(a.email||'').toLowerCase()===email && String(a.password||'')===String(data.password||'') && a.active !== false);
              if (staffAdmin) {
                resolve({success:true,message:'Administrator login successful.',sessionToken:'mock_token_admin_staff_'+Date.now(),user:Object.assign({},staffAdmin,{role:'admin',userType:'admin',permissions:staffAdmin.permissions||{}})});
                return;
              }
              const adminPassword = String(data.password || '');
              const storedSuperAdminPassword = localStorage.getItem('_sorina_superadmin_password') || '12345';
              const adminEmail = String(data.email || '').trim().toLowerCase();
              if (username.toLowerCase() !== 'admin' || adminPassword !== storedSuperAdminPassword || adminEmail !== 'sorinadaycare2008@gmail.com') {
                resolve({ success: false, message: 'Invalid Super Admin credentials. Use Username: admin, Password: 12345 and Email: sorinadaycare2008@gmail.com.' });
                return;
              }
              resolve({
                success: true,
                message: 'Admin login successful.',
                sessionToken: 'mock_token_admin_' + Date.now(),
                user: {
                  id: 'ADMIN01',
                  username: 'admin',
                  name: 'Principal Administrator',
                  role: 'superadmin',
                  userType: 'admin',
                  email: 'sorinadaycare2008@gmail.com',
                  photo: localStorage.getItem('_sorina_superadmin_photo') || '',
                  permissions: {
                    'summary:view': true,
                    'students:view': true, 'students:edit': true, 'students:delete': true,
                    'teachers:view': true, 'teachers:edit': true, 'teachers:delete': true,
                    'finance:view': true, 'finance:edit': true, 'finance:delete': true,
                    'expenses:view': true, 'expenses:edit': true, 'expenses:delete': true,
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
              const teacher = getMockTeachers().find(t => String(t.id).toLowerCase() === username.toLowerCase() && String(t.password || '') === String(data.password || ''));
              if (!teacher) { resolve({success:false,message:'Invalid Teacher ID or password.'}); return; }
              resolve({success:true,sessionToken:'mock_token_teacher_'+Date.now(),user:Object.assign({},teacher,{role:'teacher',userType:'teacher'})});
              return;
            }

            const students = getMockStudents();
            const student = students.find(st => String(st.id).toLowerCase() === username.toLowerCase() && String(st.password || '') === String(data.password || ''));
            if (!student) { resolve({success:false,message:'Invalid Student ID or password.'}); return; }
            resolve({success:true,sessionToken:'mock_token_student_'+Date.now(),user:Object.assign({},student,{role:'student',userType:'student'})});
            break;
          }

          case 'getTeachers': {
            const ts=getMockTeachers();
            const year=String(data&&data.academicYear||'').trim();
            resolve({success:true,teachers:year?ts.filter(t=>String(t.academicYear||'')===year):ts});
            break;
          }
          case 'getNextTeacherId': {
            const ts=getMockTeachers();
            const n=ts.reduce((m,t)=>Math.max(m,parseInt(String(t.id).replace(/\D/g,'')||0,10)),0)+1;
            resolve({success:true,nextId:'SPST'+String(n).padStart(3,'0')});
            break;
          }
          case 'saveTeacher': {
            const t=Object.assign({},(data&&data.teacher)||{});
            const ts=getMockTeachers();
            t.id=String(t.id||'').trim();
            t.name=String(t.name||'').trim();
            t.academicYear=String(t.academicYear||'2026-2027');
            t.assignments=Array.isArray(t.assignments)?t.assignments:[];
            t.status=t.status||'Active';
            if(!t.id||!t.name){resolve({success:false,message:'Teacher ID and full name are required.'});break;}
            const duplicate=ts.find(x=>x.id===t.id && (!data.originalId || x.id!==data.originalId));
            if(duplicate && (!data.originalId || duplicate.id!==String(data.originalId))){resolve({success:false,message:'That Systematic Teacher ID is already in use. Each teacher must have a unique portal login ID.'});break;}
            const i=ts.findIndex(x=>x.id===t.id);
            if(i>=0)ts[i]=Object.assign({},ts[i],t);else ts.push(t);
            saveMockTeachers(ts);
            resolve({success:true,message:'Teacher saved successfully.',teachers:ts});
            break;
          }
          case 'deleteTeacher': {
            const id=String(data&&data.teacherId||'');
            const before=getMockTeachers();
            const after=before.filter(t=>String(t.id)!==id);
            saveMockTeachers(after);
            resolve({success:true,message:'Teacher removed successfully.',teachers:after});
            break;
          }
          case 'getSubjects': resolve({success:true,subjects:getMockSubjects()}); break;
          case 'addSubject': { const name=String((data&&((data.subject!==undefined)?data.subject:data.subjectName))||'').trim(); const ss=getMockSubjects(); if(name&&!ss.some(x=>x.toLowerCase()===name.toLowerCase()))ss.push(name); saveMockSubjects(ss); localStorage.setItem('_sorina_subject_catalog',JSON.stringify(ss)); resolve({success:true,subjects:ss}); break; }
          case 'updateSubject': { const oldName=String(data&&((data.oldName!==undefined)?data.oldName:data.oldSubjectName)||''); const newName=String(data&&((data.newName!==undefined)?data.newName:data.newSubjectName)||'').trim(); const ss=getMockSubjects().map(x=>x===oldName?newName:x); saveMockSubjects(ss); localStorage.setItem('_sorina_subject_catalog',JSON.stringify(ss)); const ts=getMockTeachers(); ts.forEach(t=>(t.assignments||[]).forEach(a=>a.subjects=(a.subjects||[]).map(x=>x===oldName?newName:x))); saveMockTeachers(ts); const all=getMockStudents(); all.forEach(st=>{if(Array.isArray(st.curriculumSubjects))st.curriculumSubjects=st.curriculumSubjects.map(x=>x===oldName?newName:x);}); saveMockStudents(all); const cm=JSON.parse(localStorage.getItem('_sorina_curriculum_map')||'{}'); Object.keys(cm).forEach(k=>cm[k]=(cm[k]||[]).map(x=>x===oldName?newName:x)); localStorage.setItem('_sorina_curriculum_map',JSON.stringify(cm)); const g=getMockGrades(), ng={}; Object.keys(g).forEach(k=>{const parts=k.split('::'); ng[parts.length===3&&parts[2]===oldName?[parts[0],parts[1],newName].join('::'):k]=g[k];}); saveMockGrades(ng); resolve({success:true,subjects:ss}); break; }
          case 'deleteSubject': { const name=String(data&&data.subject||''); const ss=getMockSubjects().filter(x=>x!==name); saveMockSubjects(ss); localStorage.setItem('_sorina_subject_catalog',JSON.stringify(ss)); const ts=getMockTeachers(); ts.forEach(t=>(t.assignments||[]).forEach(a=>a.subjects=(a.subjects||[]).filter(x=>x!==name))); saveMockTeachers(ts); const all=getMockStudents(); all.forEach(st=>{if(Array.isArray(st.curriculumSubjects))st.curriculumSubjects=st.curriculumSubjects.filter(x=>x!==name);}); saveMockStudents(all); const cm=JSON.parse(localStorage.getItem('_sorina_curriculum_map')||'{}'); Object.keys(cm).forEach(k=>cm[k]=(cm[k]||[]).filter(x=>x!==name)); localStorage.setItem('_sorina_curriculum_map',JSON.stringify(cm)); resolve({success:true,subjects:ss}); break; }
          case 'listAdmins': {
            const accounts=getMockAdminAccounts(); const superAdminPhoto=localStorage.getItem('_sorina_superadmin_photo')||'';
            resolve({success:true,admins:[{username:'admin',name:'Principal Administrator',email:'sorinadaycare2008@gmail.com',title:'Super Administrator',roleTier:'superadmin',isSuperAdmin:true,permissions:adminPermissionMap(),lastLogin:'',photo:superAdminPhoto}].concat(accounts.map(a=>Object.assign({},a,{isSuperAdmin:false,roleTier:a.roleTier||'administrator'}))) });
            break;
          }
          case 'updateAdminProfile': {
            const accounts=getMockAdminAccounts(), u=String(data&&data.username||'').trim();
            if(u.toLowerCase()==='admin'){
              if(data.photo!==undefined)localStorage.setItem('_sorina_superadmin_photo',String(data.photo||''));
              resolve({success:true,message:'Administrator profile updated successfully.',admin:{username:'admin',name:'Principal Administrator',email:'sorinadaycare2008@gmail.com',photo:localStorage.getItem('_sorina_superadmin_photo')||''}}); break;
            }
            const i=accounts.findIndex(a=>a.username===u);
            if(i<0){resolve({success:false,message:'Administrator account not found.'});break;}
            if(data.photo!==undefined) accounts[i].photo=String(data.photo||'');
            if(data.name!==undefined) accounts[i].name=String(data.name||accounts[i].name||'').trim();
            if(data.email!==undefined) accounts[i].email=String(data.email||accounts[i].email||'').trim();
            saveMockAdminAccounts(accounts); resolve({success:true,message:'Administrator profile updated successfully.',admin:Object.assign({},accounts[i],{password:undefined})}); break;
          }
          case 'createAdmin': {
            const d=data||{}, accounts=getMockAdminAccounts(); const u=String(d.username||'').trim();
            if(!u||!d.name||!d.email||!d.password){resolve({success:false,message:'Username, full name, email and password are required.'});break;}
            if(accounts.some(a=>String(a.username).toLowerCase()===u.toLowerCase()) || u.toLowerCase()==='admin'){resolve({success:false,message:'That username is already in use.'});break;}
            if(accounts.some(a=>String(a.email).toLowerCase()===String(d.email).toLowerCase())){resolve({success:false,message:'That email address is already assigned to an administrator.'});break;}
            const rec={id:'ADM-'+Date.now(),username:u,name:String(d.name).trim(),email:String(d.email).trim(),password:String(d.password),title:String(d.title||'Administrator').trim(),roleTier:'administrator',permissions:d.permissions||{},active:true,lastLogin:'',photo:String(d.photo||'')}; accounts.push(rec); saveMockAdminAccounts(accounts); resolve({success:true,message:'Administrator account created successfully.',admin:Object.assign({},rec,{password:undefined})}); break;
          }
          case 'updateAdminPermissions': {
            const accounts=getMockAdminAccounts(), u=String(data&&data.username||''); const i=accounts.findIndex(a=>a.username===u); if(i<0){resolve({success:false,message:'Administrator account not found.'});break;}
            accounts[i].title=String(data.title||accounts[i].title||'Administrator'); accounts[i].permissions=data.permissions||{}; if(data.newPassword)accounts[i].password=String(data.newPassword); saveMockAdminAccounts(accounts); resolve({success:true,message:'Administrator account updated successfully.'}); break;
          }
          case 'removeAdmin': {
            const accounts=getMockAdminAccounts(), u=String(data&&data.username||''); const i=accounts.findIndex(a=>a.username===u); if(i<0){resolve({success:false,message:'Administrator account not found.'});break;} accounts[i].active=false; saveMockAdminAccounts(accounts); resolve({success:true,message:'Administrator access revoked.'}); break;
          }
          case 'getPermissions': resolve({success:true,permissions:getMockPermissions()}); break;
          case 'savePermissions': { const p=(data&&data.permissions)||{}; saveMockPermissions(p); resolve({success:true,permissions:p}); break; }
          case 'getClassFees': { const stored=getMockClassFees(); if(stored.length) resolve({success:true,classFees:stored}); else resolve({success:true,classFees:[]}); break; }
          case 'getFeeItems': { const items=getMockFeeItems(); const f=data||{}; const filtered=items.filter(x=>(!f.className||x.className===f.className)&&(!f.studentCategory||x.studentCategory===f.studentCategory)&&(!f.academicYear||x.academicYear===f.academicYear)); resolve({success:true,feeItems:filtered}); break; }
          case 'saveFeeItem': { const f=data||{}; const desc=String(f.description||'').trim(); const amount=Number(f.amount); if(!desc||!isFinite(amount)||amount<0){resolve({success:false,message:'Description and a valid amount are required.'});break;} const arr=getMockFeeItems(); const item={id:f.id||('FEE-'+Date.now()),description:desc,amount, currency:f.currency||'USD',className:f.className||'',studentCategory:f.studentCategory||'new',academicYear:f.academicYear||'2026-2027',createdAt:f.createdAt||new Date().toISOString()}; const i=arr.findIndex(x=>x.id===item.id); if(i>=0)arr[i]=Object.assign({},arr[i],item); else arr.unshift(item); saveMockFeeItems(arr); resolve({success:true,message:'Payment item saved successfully.',feeItems:arr}); break; }
          case 'deleteFeeItem': { const id=String(data&&data.id||''); const arr=getMockFeeItems().filter(x=>x.id!==id); saveMockFeeItems(arr); resolve({success:true,feeItems:arr}); break; }
          case 'getAuditLog': { resolve({success:true,entries:getMockAuditLog()}); break; }
          case 'saveClassFee': { const f=(data&&data)||{}; const arr=getMockClassFees(); const i=arr.findIndex(x=>x.className===f.className&&x.studentCategory===f.studentCategory); if(i>=0)arr[i]=Object.assign({},arr[i],f);else arr.push(f); saveMockClassFees(arr); resolve({success:true,message:'Class fee schedule saved successfully.',classFees:arr}); break; }
          case 'getStudentsByClass': { const cls=String(data&&data.className||''); const teacherId=data&&data.teacherId; const academicYear=data&&data.academicYear; if(teacherId){const t=getMockTeachers().find(x=>x.id===teacherId); if(!t || (academicYear && String(t.academicYear||'')!==String(academicYear)) || !(t.assignments||[]).some(a=>a.class===cls)){resolve({success:false,message:'You are not assigned to this class for the selected academic year.',students:[]});break;}} const st=getMockStudents().filter(s=>String(s.className||s.grade)===cls && (s.status||'Active')==='Active' && (!academicYear || !s.academicYear || String(s.academicYear)===String(academicYear))); resolve({success:true,students:st}); break; }
          case 'teacherSubmitGrades': { const p=data||{}; const perms=getMockPermissions(); const grades=getMockGrades(); const year=p.academicYear||'2026-2027'; const ts=getMockTeachers(); const teacher=ts.find(t=>t.id===p.teacherId); const adminMode=['superadmin','admin'].includes(String(p.actorRole||'').toLowerCase()); const teacherYear=String(teacher&&teacher.academicYear||''); if(!adminMode && teacher && String(p.academicYear||'')!==teacherYear){resolve({success:false,message:'This teacher account belongs to '+teacherYear+'.'});break;} const asn=(teacher&&teacher.assignments||[]).find(a=>a.class===p.className); if(!adminMode && (!teacher||!asn||!(asn.subjects||[]).includes(p.subject))){resolve({success:false,message:'You are not assigned to this class and subject.'});break;} const status=String(p.gradeStatus||'submitted').toLowerCase()==='draft'?'draft':'submitted'; const now=new Date().toISOString(); const changed=[]; const keyBase=p.subject; (p.grades||[]).forEach(g=>{const key=gradeKey(g.studentId,keyBase,year); const old=grades[key]||{}; const clean=Object.assign({},old); ['p1','p2','p3','exam1','p4','p5','p6','exam2'].forEach(k=>{if(g[k]!==undefined && (adminMode || perms[k]!==false))clean[k]=g[k];}); clean.teacherId=adminMode?(p.teacherId||'ADMIN01'):(teacher&&teacher.id); clean.teacherName=adminMode?((p.actorName||'Principal Administrator')):(teacher&&teacher.name); clean.updatedAt=now; clean.updatedByRole=adminMode?'admin':'teacher'; clean.status=status; clean.average=averageGrades(clean); clean.remark=gradeRemark(clean.average); grades[key]=clean; changed.push(g.studentId);}); saveMockGrades(grades); const all=getMockStudents(); all.forEach(s=>{if(!s.years)s.years={}; if(!s.years[year])s.years[year]=[]; const k=gradeKey(s.id,p.subject,year), gg=grades[k]; if(gg){const idx=s.years[year].findIndex(x=>String(x.subject).toLowerCase()===String(p.subject).toLowerCase()); const rec=Object.assign({subject:p.subject},gg); if(idx>=0)s.years[year][idx]=rec; else s.years[year].push(rec);}}); saveMockStudents(all); let logs=[]; try{logs=JSON.parse(localStorage.getItem('sorina_grade_activity_log')||'[]');}catch(e){} logs=Array.isArray(logs)?logs:[]; logs.unshift({id:'GA-'+Date.now(),academicYear:year,className:p.className,subject:p.subject,studentCount:changed.length,status:status,actorId:p.teacherId||'ADMIN01',actorName:p.actorName||'Administrator',actorRole:adminMode?'admin':'teacher',timestamp:now,action:adminMode?(status==='submitted'?'Admin submitted/finalized grades':'Admin saved grade draft'):'Teacher submitted grades'}); localStorage.setItem('sorina_grade_activity_log',JSON.stringify(logs.slice(0,200))); resolve({success:true,message:status==='submitted'?'Grades submitted successfully.':'Grade draft saved successfully.',updatedCount:changed.length}); break; }
          case 'getStudentGrades': { const grades=getMockGrades(); const studentId=data&&data.studentId; const year=data&&data.academicYear||'2026-2027'; const out=[]; Object.keys(grades).forEach(k=>{if(k.startsWith(studentId+'::'+year+'::'))out.push(Object.assign({subject:k.split('::')[2]},grades[k]));}); resolve({success:true,grades:out}); break; }
          case 'getGradeActivityLog': { let logs=[]; try{logs=JSON.parse(localStorage.getItem('sorina_grade_activity_log')||'[]');}catch(e){} const year=String(data&&data.academicYear||''); const filtered=Array.isArray(logs)?logs.filter(x=>!year||String(x.academicYear||'')===year):[]; resolve({success:true,logs:filtered.slice(0,100)}); break; }
          case 'getLessonPlans': { let plans=[]; try{plans=JSON.parse(localStorage.getItem('sorina_lesson_plans')||'[]');}catch(e){} plans=Array.isArray(plans)?plans:[]; const f=(data&&data.filters)||{}; if(f.teacherId)plans=plans.filter(p=>String(p.teacherId)===String(f.teacherId)); if(f.academicYear)plans=plans.filter(p=>String(p.academicYear||'')===String(f.academicYear)); if(f.status&&f.status!=='all')plans=plans.filter(p=>String(p.status||'pending')===String(f.status)); resolve({success:true,plans:plans.sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')))}); break; }
          case 'saveLessonPlan': { const plan=Object.assign({},(data&&data.plan)||{}); let plans=[]; try{plans=JSON.parse(localStorage.getItem('sorina_lesson_plans')||'[]');}catch(e){} if(!Array.isArray(plans))plans=[]; const now=new Date().toISOString(); plan.id=plan.id||('LP-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)); plan.academicYear=plan.academicYear||'2026-2027'; plan.status='pending'; plan.submittedAt=plan.submittedAt||now; plan.updatedAt=now; plan.reviewedAt=''; plan.reviewedBy=''; plan.reviewComment=''; plans.unshift(plan); localStorage.setItem('sorina_lesson_plans',JSON.stringify(plans)); resolve({success:true,message:'Lesson plan submitted to administration.',plan:plan}); break; }
          case 'reviewLessonPlan': { let plans=[]; try{plans=JSON.parse(localStorage.getItem('sorina_lesson_plans')||'[]');}catch(e){} const id=String(data&&data.id||''); const idx=plans.findIndex(p=>String(p.id)===id); if(idx<0){resolve({success:false,message:'Lesson plan not found.'});break;} const status=String(data&&data.status||'').toLowerCase(); if(!['approved','revision'].includes(status)){resolve({success:false,message:'Invalid lesson plan review status.'});break;} plans[idx].status=status; plans[idx].reviewedAt=new Date().toISOString(); plans[idx].reviewedBy=(data&&data.reviewedBy)||'Administrator'; plans[idx].reviewComment=(data&&data.comment)||''; plans[idx].updatedAt=new Date().toISOString(); localStorage.setItem('sorina_lesson_plans',JSON.stringify(plans)); resolve({success:true,message:status==='approved'?'Lesson plan approved.':'Lesson plan returned for revision.',plan:plans[idx]}); break; }
          case 'saveStudentCurriculum': {
             const sId=data&&data.studentId, cls=data&&data.className;
             const subs=Array.isArray(data&&data.subjects)
               ? Array.from(new Set(data.subjects.map(x=>String(x||'').trim()).filter(Boolean)))
               : [];
             const all=getMockStudents();
             const st=all.find(x=>x.id===sId);
             if(st){
               st.curriculumSubjects=subs;
               st.assignedSubjects=undefined;
               saveMockStudents(all);
             }
             resolve({success:true, assignedSubjects:subs});
             break;
           }
          case 'getCurriculumSubjects': { const map=JSON.parse(localStorage.getItem('_sorina_curriculum_map')||'{}'); resolve({success:true,curriculum:map}); break; }
          case 'saveCurriculumSubjects': { const map=(data&&data.curriculum)||{}; localStorage.setItem('_sorina_curriculum_map',JSON.stringify(map)); resolve({success:true,curriculum:map}); break; }

          case 'getNextStudentId': {
            const allSt = getMockStudents();
            let maxNum = 0;
            allSt.forEach(s => {
              const m = String(s.id).match(/SJSH(\d+)/i);
              if (m) {
                const num = parseInt(m[1], 10);
                if (num > maxNum) maxNum = num;
              }
            });
            const nextNum = maxNum + 1;
            resolve({ success: true, nextId: 'SJSH' + String(nextNum).padStart(3, '0') });
            break;
          }


          case 'getAllStudents': {
            const allSt = getMockStudents();
            const yr = data && data.academicYear;
            const students = yr ? allSt.filter(s => String(s.academicYear || '').trim() === String(yr).trim()) : allSt;
            resolve({ success: true, students: students });
            break;
          }

          case 'getOldStudentsByClass': {
            const allSt = getMockStudents();
            const cls = String(data && data.className || '').trim();
            const prevYear = String(data && data.academicYear || '').trim();
            const currentYear = String(data && data.currentAcademicYear || '').trim();
            const students = allSt.filter(s => {
              const sameClass = String(s.className || s.grade || '').trim() === cls;
              const sameYear = prevYear ? String(s.academicYear || '').trim() === prevYear : false;
              const active = String(s.status || 'Active').toLowerCase() === 'active';
              const alreadyAdvanced = currentYear ? allSt.some(c => String(c.id) === String(s.id) && String(c.academicYear || '').trim() === currentYear) : false;
              return sameClass && sameYear && active && !alreadyAdvanced;
            });
            resolve({ success: true, students: students });
            break;
          }

          case 'addStudent': {
            const newS = (data && data.student) || {};
            const allSt = getMockStudents();
            const idx = allSt.findIndex(s => s.id === newS.id && String(s.academicYear || '') === String(newS.academicYear || ''));
            if (idx >= 0) allSt[idx] = Object.assign({}, allSt[idx], newS);
            else allSt.push(newS);
            saveMockStudents(allSt);
            resolve({ success: true, message: 'Student registered successfully.' });
            break;
          }

          case 'updateStudent': {
            const updS = (data && data.student) || {};
            const allSt = getMockStudents();
            const targetYear = String(updS.academicYear || '').trim();
            const idx = allSt.findIndex(s => s.id === updS.id && (!targetYear || String(s.academicYear || '').trim() === targetYear));
            if (idx >= 0) {
              allSt[idx] = Object.assign({}, allSt[idx], updS);
              saveMockStudents(allSt);
            } else if (updS.id) {
              allSt.push(updS);
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

            let totalExpenses = 0;
            try { const expenses = JSON.parse(localStorage.getItem('sorina_expenses') || '[]'); totalExpenses = (Array.isArray(expenses) ? expenses : []).reduce((sum, e) => sum + (Number(e.total) || 0), 0); } catch (e) {}
            resolve({
              success: true,
              summary: {
                totalStudents: yearSt.length,
                totalTeachers: 0,
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

          case 'getAnnouncements': {
            let announcements = [];
            try { announcements = JSON.parse(localStorage.getItem('sorina_announcements') || '[]'); } catch (e) {}
            resolve({ success: true, announcements: Array.isArray(announcements) ? announcements : [] });
            break;
          }

          case 'saveAnnouncement': {
            let announcements = [];
            try { announcements = JSON.parse(localStorage.getItem('sorina_announcements') || '[]'); } catch (e) {}
            const item = (data && data.announcement) || {};
            announcements.unshift(item);
            localStorage.setItem('sorina_announcements', JSON.stringify(announcements));
            resolve({ success: true, message: 'Announcement published successfully.', announcements: announcements });
            break;
          }

          case 'deleteAnnouncement': {
            let announcements = [];
            try { announcements = JSON.parse(localStorage.getItem('sorina_announcements') || '[]'); } catch (e) {}
            announcements = announcements.filter(a => String(a.id) !== String(data && data.id));
            localStorage.setItem('sorina_announcements', JSON.stringify(announcements));
            resolve({ success: true, message: 'Announcement deleted.', announcements: announcements });
            break;
          }

          case 'getExpenses': {
            let expenses = [];
            try { expenses = JSON.parse(localStorage.getItem('sorina_expenses') || '[]'); } catch (e) {}
            resolve({ success: true, expenses: Array.isArray(expenses) ? expenses : [] });
            break;
          }

          case 'saveExpense': {
            let expenses = [];
            try { expenses = JSON.parse(localStorage.getItem('sorina_expenses') || '[]'); } catch (e) {}
            const item = (data && data.expense) || {};
            expenses.push(item);
            localStorage.setItem('sorina_expenses', JSON.stringify(expenses));
            resolve({ success: true, message: 'Expense saved successfully.', expenses: expenses });
            break;
          }

          case 'getStudentPaymentNotifications': { const ns=getPaymentNotifications(data&&data.studentId); resolve({success:true,notifications:ns,unreadCount:ns.filter(n=>n.unread).length}); break; }
          case 'getStudentById': { const st=getMockStudents().find(x=>x.id===data.studentId); resolve(st?{success:true,student:st}:{success:false,message:'Student not found.'}); break; }
          case 'getStudentFinance': {
            const st=getMockStudents().find(x=>x.id===data.studentId)||{}; const f=st.finance||{}; const inst=f.installments||[0,0,0,0,0];
            const paid=(f.registrationPaid?Number(f.registrationFee)||0:0)+(f.entranceFeePaid?Number(f.entranceFee)||0:0)+(f.requirementsFeePaid?Number(f.requirementsFee)||0:0)+(f.peSuitFeePaid?Number(f.peSuitFee)||0:0)+(f.portalFeePaid?Number(f.portalFee)||0:0)+inst.reduce((a,b)=>a+(Number(b)||0),0)+(Number(f.otherPayments)||0);
            const billed=(Number(f.tuitionTotal)||0)+(Number(f.registrationFee)||0)+(Number(f.entranceFee)||0)+(Number(f.requirementsFee)||0)+(Number(f.peSuitFee)||0)+(Number(f.portalFee)||0);
            const schedules=getMockClassFees(); const sched=schedules.find(x=>x.className===(st.className||st.grade)&&x.studentCategory===(st.studentCategory||'new'))||{}; resolve({success:true,finance:Object.assign({},f,{totalPaid:paid,balance:Math.max(0,billed-paid),installments:inst,currency:f.currency||sched.currency||'USD',deadlines:sched.deadlines||[]})}); break;
          }
          case 'getMessages': { let aa=[]; try{aa=JSON.parse(localStorage.getItem('sorina_announcements')||'[]');}catch(e){} const uId=data.studentId||data.teacherId||((data.user||{}).id)||''; const role=String(data.role||'').toLowerCase(); const visible=aa.filter(a=>{if(a.recipientId&&a.recipientId!==uId)return false;if(!a.recipientId){const aud=String(a.audience||'Both').toLowerCase();if(role==='teacher'&&aud==='students')return false;if(role==='student'&&aud==='teachers')return false;}return true;}); resolve({success:true,messages:visible}); break; }
          case 'changePassword': { const id=data.userId, role=String(data.userType||'').toLowerCase(), pass=String(data.password||''); if(role==='teacher'){const ts=getMockTeachers();const t=ts.find(x=>x.id===id);if(t){t.password=pass;saveMockTeachers(ts);resolve({success:true});}else resolve({success:false,message:'Teacher not found.'});} else {const all=getMockStudents();const st=all.find(x=>x.id===id);if(st){st.password=pass;saveMockStudents(all);resolve({success:true});}else resolve({success:false,message:'Student not found.'});} break; }

          case 'getReportCard': {
            const studentId=data.studentId||''; const year=data.academicYear||'2026-2027';
            const st=getMockStudents().find(x=>x.id===studentId) || getMockStudents()[0] || {};
            const cls=st.className||st.grade||'Grade 1'; const letter=isLetterClass(cls);
            // IMPORTANT: Report cards must contain ONLY subjects assigned to this specific student.
             // Never fall back to the class curriculum or the full subject catalog.
             const subjects=Array.isArray(st.curriculumSubjects)
               ? Array.from(new Set(st.curriculumSubjects.map(x=>String(x||'').trim()).filter(Boolean)))
               : [];
            const grades=getMockGrades();
            const rows=subjects.map(sub=>{const g=grades[gradeKey(st.id,sub,year)]||((st.years&&st.years[year]||[]).find(x=>String(x.subject).toLowerCase()===String(sub).toLowerCase()))||{}; const avg=letter?null:averageGrades(g); return {subject:sub,p1:g.p1||'',p2:g.p2||'',p3:g.p3||'',exam1:g.exam1||'',sem1Avg:letter?'':averageGrades({p1:g.p1,p2:g.p2,p3:g.p3,exam1:g.exam1}),p4:g.p4||'',p5:g.p5||'',p6:g.p6||'',exam2:g.exam2||'',sem2Avg:letter?'':averageGrades({p4:g.p4,p5:g.p5,p6:g.p6,exam2:g.exam2}),yearlyAvg:letter?'':avg,gradeLetter:letter?([g.exam2,g.p6,g.p5,g.p4,g.exam1,g.p3,g.p2,g.p1].find(Boolean)||''): (avg===null?'':(avg>=70?'PASS':'FAIL')),remark:letter?(g.remark||''):(avg===null?'':gradeRemark(avg))};});
            const nums=rows.map(r=>Number(r.yearlyAvg)).filter(n=>!isNaN(n)); const overall=nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100:null;
            const brand=getMockSettings(); resolve({success:true,gradeLocked:!!st.gradeLocked,reportCard:{school:{name:brand.schoolName,motto:brand.schoolMotto,logo:brand.logoUrl,contact:brand.contactEmail,phone:brand.contactPhone},student:{id:st.id,name:st.name,className:cls,grade:cls,academicYear:year,guardian:st.guardian||'',phone:st.phone||''},isNursery:letter,columns:['Subject','1st Period','2nd Period','3rd Period','1st Sem Exam','1st Sem Avg','4th Period','5th Period','6th Period','2nd Sem Exam','2nd Sem Avg','Yearly Avg','Grade','Remark'],rows:rows,summary:{totalSubjects:rows.length,gradedSubjects:rows.filter(r=>r.yearlyAvg!==''||r.gradeLetter).length,overallAverage:letter?'':overall,overallGrade:letter?'':(overall===null?'':(overall>=70?'PASS':'FAIL')),status:st.status||'Active'}}});
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
                { className: 'Grade 1', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 200, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 7', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 270, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 7', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 250, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 8', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 280, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 8', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 260, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 9', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 290, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 9', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 270, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 10', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 300, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 10', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 280, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 11', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 310, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 11', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 290, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 12', studentCategory: 'new', entranceFee: 25, registrationFee: 40, tuitionTotal: 320, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
                { className: 'Grade 12', studentCategory: 'old', entranceFee: 0, registrationFee: 35, tuitionTotal: 300, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
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
