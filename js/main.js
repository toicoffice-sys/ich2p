/* ============================================================
   DLSL ICH2P — Main JS
   ============================================================ */

/* Auto-init everything on DOMContentLoaded (CSP-safe — no inline handlers) */
document.addEventListener('DOMContentLoaded', () => {
  /* Countdown timer — index.html */
  if (document.getElementById('countdown')) {
    initCountdown('2026-12-17T08:00:00');
  }

  /* Schedule day tabs — programme.html */
  if (document.querySelector('.day-tab-btn')) {
    initScheduleTabs();
  }

  /* Abstract submission form */
  const abstractForm = document.getElementById('abstractForm');
  if (abstractForm) {
    abstractForm.addEventListener('submit', submitAbstract);
    initCharCount();
    initFileDropZone('abstractPdfDropZone', 'abstractPdfFile', 'abstractPdfFileName');
    initEmailVerificationGate({
      revealId:    'abstractFormFields',
      alertAreaId: 'form-alert-area',
    });
  }

  /* Registration form */
  const regForm = document.getElementById('registrationForm');
  if (regForm) {
    regForm.addEventListener('submit', submitRegistration);
    initFeeCalculator();
    initEmailVerificationGate({
      revealId:    'registrationFormFields',
      alertAreaId: 'reg-alert-area',
    });
  }

  /* Checkout page */
  if (document.getElementById('checkoutMain')) {
    initCheckoutPage();
  }

  /* News / announcements page */
  if (document.getElementById('newsGrid')) {
    loadAnnouncements();
  }
});

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzRkw0T0gNuD8JKpngWl3gVnAP7Z_9Jpo4Js_OxibEZCTER4C5dnl0dHZj18TDjGxUGJQ/exec';

/* reCAPTCHA v3 — placeholder until registered at google.com/recaptcha/admin
   (see Code.gs setup step 10). Harmless no-op until replaced: getRecaptchaToken()
   below skips silently, and the Apps Script backend fails open until its
   matching secret key is configured, so submissions keep working either way. */
const RECAPTCHA_SITE_KEY = '6Ld4l2ItAAAAAPKyCxmt4VoEh4W1amhLowHMgH3E';

function getRecaptchaToken(action) {
  return new Promise((resolve) => {
    if (typeof grecaptcha === 'undefined' || RECAPTCHA_SITE_KEY.indexOf('REPLACE_WITH') === 0) {
      resolve('');
      return;
    }
    grecaptcha.ready(() => {
      grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve).catch(() => resolve(''));
    });
  });
}

/* --- Page scroll progress bar --- */
(function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;

  let ticking = false;
  function update() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    bar.style.width = pct + '%';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
})();

/* --- Navbar scroll + mobile toggle --- */
(function initNav() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');

  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('open');
      links.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    /* Close on outside click */
    document.addEventListener('click', (e) => {
      if (!navbar.contains(e.target) && links.classList.contains('open')) {
        toggle.classList.remove('open');
        links.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* Mobile dropdown toggles */
  document.querySelectorAll('.dropdown > a').forEach(a => {
    a.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        a.closest('.dropdown').classList.toggle('open');
      }
    });
  });

  /* Active nav link */
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* --- Scroll reveal --- */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
})();

/* --- Hero parallax (background grid) --- */
(function initParallax() {
  const heroGrid = document.querySelector('.hero .hero-grid');
  if (!heroGrid) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      heroGrid.style.transform = `translateY(${window.scrollY * 0.5}px)`;
      ticking = false;
    });
  }, { passive: true });
})();

/* --- Hero poster mouse-tilt --- */
(function initHeroTilt() {
  const hero = document.getElementById('heroSection');
  const poster = document.getElementById('heroPoster');
  if (!hero || !poster) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return; // skip on touch devices

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    poster.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
  });
  hero.addEventListener('mouseleave', () => {
    poster.style.transform = '';
  });
})();

/* --- Countdown timer --- */
function initCountdown(targetDate) {
  const el = document.getElementById('countdown');
  if (!el) return;

  function update() {
    const diff = new Date(targetDate) - new Date();
    if (diff <= 0) {
      el.innerHTML = '<span class="countdown-unit"><span class="countdown-num">0</span><span class="countdown-label">Days</span></span>';
      return;
    }
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `
      <div class="countdown-unit"><span class="countdown-num" id="cd-days">${String(days).padStart(2,'0')}</span><span class="countdown-label">Days</span></div>
      <div class="countdown-unit"><span class="countdown-num" id="cd-hours">${String(hours).padStart(2,'0')}</span><span class="countdown-label">Hours</span></div>
      <div class="countdown-unit"><span class="countdown-num" id="cd-mins">${String(mins).padStart(2,'0')}</span><span class="countdown-label">Mins</span></div>
      <div class="countdown-unit"><span class="countdown-num" id="cd-secs">${String(secs).padStart(2,'0')}</span><span class="countdown-label">Secs</span></div>`;
  }

  update();
  setInterval(update, 1000);
}

/* --- Modal system --- */
const Modal = {
  open(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },
  close(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  },
  init() {
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
      });
    });
  }
};
document.addEventListener('DOMContentLoaded', () => Modal.init());

/* --- Schedule day tabs --- */
function initScheduleTabs() {
  const tabs = document.querySelectorAll('.day-tab-btn');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.schedule-day').forEach(d => {
        d.style.display = d.dataset.day === tab.dataset.day ? '' : 'none';
      });
    });
  });

  /* Show first day by default */
  if (tabs[0]) tabs[0].click();
}

/* --- Form validation helper --- */
function validateForm(form) {
  let valid = true;
  const missing = [];

  form.querySelectorAll('[required]').forEach(input => {
    if (input.type === 'checkbox') {
      const group = input.closest('.form-check-group');
      if (!input.checked) {
        if (group) group.classList.add('form-check-error');
        missing.push('Data Privacy Act consent');
        valid = false;
      } else if (group) {
        group.classList.remove('form-check-error');
      }
      return;
    }
    const empty = !input.value || !input.value.trim();
    if (empty) {
      input.style.borderColor = '#DC2626';
      input.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)';
      const label = form.querySelector(`label[for="${input.id}"]`);
      if (label) missing.push(label.textContent.replace('*','').trim());
      valid = false;
    } else {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }
  });

  form.querySelectorAll('[type="email"]').forEach(inp => {
    if (inp.value && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(inp.value)) {
      inp.style.borderColor = '#DC2626';
      inp.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)';
      missing.push('valid email address');
      valid = false;
    }
  });

  if (!valid) {
    const msg = missing.length
      ? `Please fill in: ${missing.join(', ')}.`
      : 'Please fill in all required fields.';
    /* find nearest alert area and show message */
    const alertEl = document.querySelector('.form-alert[id]');
    if (alertEl) showAlert(alertEl.id, 'error', msg);
  }

  return valid;
}

/* --- Reusable click-to-upload drop zone --- */
function initFileDropZone(dropZoneId, fileInputId, labelId) {
  const dropZone  = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(fileInputId);
  const fileLabel = document.getElementById(labelId);
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileLabel.textContent = file ? file.name : '';
  });
}

/* --- Abstract character count --- */
function initCharCount() {
  const textarea = document.getElementById('abstractText');
  const counter  = document.getElementById('abstractCount');
  if (!textarea || !counter) return;
  const max = 500;
  function update() {
    const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    counter.textContent = `${words}/${max} words`;
    counter.style.color = words > max ? '#DC2626' : '';
  }
  textarea.addEventListener('input', update);
  update();
}

/* --- Fee calculator --- */
function initFeeCalculator() {
  const regTypeSelect = document.getElementById('regType');
  const feeDisplay    = document.getElementById('selectedFee');
  if (!regTypeSelect || !feeDisplay) return;

  const fees = {
    'ug_ph':             'Php6,000 (Regular) / Php6,500 (Late) — Undergraduate Student (PH)',
    'grad_ph':           'Php7,500 (Regular) / Php8,000 (Late) — Graduate Student (PH)',
    'prof_ph':           'Php8,000 (Regular) / Php9,000 (Late) — Professional (PH)',
    'nonpaper_ph':       'Php9,000 (Regular) / Php9,500 (Late) — Non-Paper Presenter (PH)',
    'student_foreign':   'USD125 (Regular) / USD175 (Late) — Student (Foreign)',
    'prof_foreign':      'USD150 (Regular) / USD200 (Late) — Professional (Foreign)',
    'nonpaper_foreign':  'USD175 (Regular) / USD215 (Late) — Non-Paper Presenter (Foreign)',
  };

  regTypeSelect.addEventListener('change', () => {
    const val = regTypeSelect.value;
    feeDisplay.textContent = fees[val] || '—';
    document.querySelectorAll('.fee-table tr').forEach(tr => {
      tr.classList.remove('selected');
      if (tr.dataset.fee === val) tr.classList.add('selected');
    });
  });
}

/* --- Abstract submission form --- */
const ABSTRACT_PDF_MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function submitAbstract(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const pdfInput = document.getElementById('abstractPdfFile');
  const pdfFile = pdfInput && pdfInput.files[0];
  if (!pdfFile) {
    showAlert('form-alert-area', 'error', 'Please attach your abstract as a PDF file.');
    return;
  }
  if (pdfFile.type !== 'application/pdf') {
    showAlert('form-alert-area', 'error', 'The attached file must be a PDF.');
    return;
  }
  if (pdfFile.size > ABSTRACT_PDF_MAX_BYTES) {
    showAlert('form-alert-area', 'error', 'The PDF exceeds the 10MB limit. Please upload a smaller file.');
    return;
  }

  const btn = form.querySelector('[type="submit"]');
  setLoading(btn, true);

  const data = {
    form_type:         'abstract',
    token:             'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
    name:              form.name.value.trim(),
    affiliation:       form.affiliation.value.trim(),
    email:             form.email.value.trim(),
    presentationType:  form.presentationType.value,
    title:             form.title.value.trim(),
    abstractText:      form.abstractText.value.trim(),
  };

  try {
    data.pdfBase64      = await readFileAsBase64(pdfFile);
    data.pdfFileName    = pdfFile.name;
    data.pdfMimeType    = pdfFile.type;
    data.recaptchaToken = await getRecaptchaToken('abstract');

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (result.status === 'ok') {
      form.reset();
      const pdfLabel = document.getElementById('abstractPdfFileName');
      if (pdfLabel) pdfLabel.textContent = '';
      showAlert('form-alert-area', 'success',
        'Your abstract and PDF file (' + data.pdfFileName + ') were uploaded and saved successfully! A confirmation email has been sent to ' + data.email);
    } else {
      throw new Error(result.message || 'Submission failed.');
    }
  } catch (err) {
    showAlert('form-alert-area', 'error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

/*
 * Generic "verify email, then reveal the rest of the form" gate — shared by
 * the Registration and Abstract Submission forms. Both pages use the same
 * element IDs (email, sendEmailCodeBtn, emailCodeRow, emailVerifyCode,
 * verifyEmailBtn, resendEmailCodeBtn) since each page only has one such form;
 * only the reveal target and alert area differ per page.
 */
function initEmailVerificationGate(opts) {
  const emailInput = document.getElementById('email');
  const sendBtn    = document.getElementById('sendEmailCodeBtn');
  const codeRow    = document.getElementById('emailCodeRow');
  const codeInput  = document.getElementById('emailVerifyCode');
  const verifyBtn  = document.getElementById('verifyEmailBtn');
  const resendBtn  = document.getElementById('resendEmailCodeBtn');
  const reveal     = document.getElementById(opts.revealId);
  if (!emailInput || !sendBtn || !reveal) return;

  async function sendCode() {
    const email = emailInput.value.trim();
    if (!email) {
      showAlert(opts.alertAreaId, 'error', 'Please enter your email address first.');
      return;
    }
    setLoading(sendBtn, true);
    try {
      const recaptchaToken = await getRecaptchaToken('request_email_code');
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          form_type:      'request_email_code',
          token:          'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
          email:          email,
          recaptchaToken: recaptchaToken,
        }),
      });
      const result = await resp.json();
      if (result.status === 'ok') {
        codeRow.style.display = 'block';
        codeInput.focus();
        showAlert(opts.alertAreaId, 'success', result.message);
      } else {
        throw new Error(result.message || 'Could not send verification code.');
      }
    } catch (err) {
      showAlert(opts.alertAreaId, 'error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(sendBtn, false);
    }
  }

  async function verifyCode() {
    const email = emailInput.value.trim();
    const code = codeInput.value.trim();
    if (!code) {
      showAlert(opts.alertAreaId, 'error', 'Please enter the code we emailed you.');
      return;
    }
    setLoading(verifyBtn, true);
    try {
      const recaptchaToken = await getRecaptchaToken('verify_email_code');
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          form_type:      'verify_email_code',
          token:          'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
          email:          email,
          code:           code,
          recaptchaToken: recaptchaToken,
        }),
      });
      const result = await resp.json();
      if (result.status === 'ok') {
        emailInput.readOnly = true;
        sendBtn.disabled = true;
        codeInput.disabled = true;
        verifyBtn.disabled = true;
        if (resendBtn) resendBtn.disabled = true;
        reveal.style.display = 'block';
        showAlert(opts.alertAreaId, 'success', 'Email verified! Please complete the rest of the form below.');
        reveal.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        throw new Error(result.message || 'Verification failed.');
      }
    } catch (err) {
      showAlert(opts.alertAreaId, 'error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(verifyBtn, false);
    }
  }

  sendBtn.addEventListener('click', sendCode);
  if (resendBtn) resendBtn.addEventListener('click', sendCode);
  if (verifyBtn) verifyBtn.addEventListener('click', verifyCode);
}

/* --- Registration form --- */
async function submitRegistration(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;
  const btn = form.querySelector('[type="submit"]');
  setLoading(btn, true);

  const data = {
    form_type:       'registration',
    token:           'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
    fullName:        form.fullName.value.trim(),
    institution:     form.institution.value.trim(),
    country:         form.country.value.trim(),
    email:           form.email.value.trim(),
    regType:         form.regType.value,
    specialRequests: form.specialRequests ? form.specialRequests.value.trim() : '',
  };

  try {
    data.recaptchaToken = await getRecaptchaToken('registration');

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (result.status === 'ok') {
      sessionStorage.setItem('ich2p_pending_reg', JSON.stringify({
        regId:     result.regId,
        fullName:  result.fullName,
        email:     result.email,
        regType:   result.regType,
        amountDue: result.amountDue,
        currency:  result.currency,
        tier:      result.tier,
        bdoLink:   result.bdoLink,
      }));
      form.reset();
      window.location.href = 'checkout.html';
      return;
    } else {
      throw new Error(result.message || 'Submission failed.');
    }
  } catch (err) {
    showAlert('reg-alert-area', 'error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

/* --- Checkout page --- */
const REG_TYPE_LABELS = {
  ug_ph:            'Undergraduate Student (PH)',
  grad_ph:          'Graduate Student (PH)',
  prof_ph:          'Professional (PH)',
  nonpaper_ph:      'Non-Paper Presenter (PH)',
  student_foreign:  'Student (Foreign)',
  prof_foreign:     'Professional (Foreign)',
  nonpaper_foreign: 'Non-Paper Presenter (Foreign)',
};

function initCheckoutPage() {
  const raw = sessionStorage.getItem('ich2p_pending_reg');
  const empty = document.getElementById('checkoutEmpty');
  const main  = document.getElementById('checkoutMain');
  if (!raw) {
    empty.style.display = 'block';
    return;
  }

  let reg;
  try {
    reg = JSON.parse(raw);
  } catch {
    empty.style.display = 'block';
    return;
  }
  if (!reg || !reg.regId) {
    empty.style.display = 'block';
    return;
  }

  main.style.display = 'block';

  const amountLabel = formatMoney(reg.amountDue, reg.currency);
  document.getElementById('sumRegId').textContent = reg.regId;
  document.getElementById('sumRegIdInline').textContent = reg.regId;
  document.getElementById('sumName').textContent = reg.fullName || '—';
  document.getElementById('sumRegType').textContent = REG_TYPE_LABELS[reg.regType] || reg.regType || '—';
  document.getElementById('sumTier').textContent = reg.tier === 'late' ? 'Late Registration' : 'Regular Registration';
  document.getElementById('sumAmount').textContent = amountLabel;

  const payBtn = document.getElementById('bdoPayBtn');
  if (payBtn) payBtn.href = reg.bdoLink || '#';

  initFileDropZone('proofDropZone', 'proofFile', 'proofFileName');

  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', (e) => submitPayment(e, reg));
  }

  const requestCodeBtn = document.getElementById('requestPaymentCodeBtn');
  if (requestCodeBtn) {
    requestCodeBtn.addEventListener('click', () => requestPaymentCode(reg.regId));
  }
}

async function requestPaymentCode(regId) {
  const btn = document.getElementById('requestPaymentCodeBtn');
  setLoading(btn, true);
  try {
    const recaptchaToken = await getRecaptchaToken('request_payment_code');
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        form_type:      'request_payment_code',
        token:          'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
        regId:          regId,
        recaptchaToken: recaptchaToken,
      }),
    });
    const result = await resp.json();
    if (result.status === 'ok') {
      showAlert('checkout-alert-area', 'success', result.message);
    } else {
      throw new Error(result.message || 'Could not send verification code.');
    }
  } catch (err) {
    showAlert('checkout-alert-area', 'error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

function formatMoney(amount, currency) {
  const symbol = currency === 'USD' ? 'USD ' : 'Php';
  return symbol + Number(amount).toLocaleString('en-US');
}

async function submitPayment(e, reg) {
  e.preventDefault();
  const form = e.target;
  const refInput = document.getElementById('bdoReferenceNo');
  const codeInput = document.getElementById('paymentVerifyCode');

  if (!refInput.value.trim()) {
    refInput.style.borderColor = '#DC2626';
    refInput.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)';
    showAlert('checkout-alert-area', 'error', 'Please enter your BDO reference / transaction number.');
    return;
  }
  refInput.style.borderColor = '';
  refInput.style.boxShadow = '';

  if (!codeInput.value.trim()) {
    codeInput.style.borderColor = '#DC2626';
    codeInput.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)';
    showAlert('checkout-alert-area', 'error', 'Please request and enter the verification code sent to your email first.');
    return;
  }
  codeInput.style.borderColor = '';
  codeInput.style.boxShadow = '';

  const btn = form.querySelector('[type="submit"]');
  setLoading(btn, true);

  const data = {
    form_type:        'payment',
    token:            'b308a11947aa2dee09cff6f58ddc2212569de6b6b62c8627',
    regId:            reg.regId,
    email:            reg.email,
    verificationCode: codeInput.value.trim(),
    bdoReferenceNo:   refInput.value.trim(),
    notes:            document.getElementById('paymentNotes').value.trim(),
  };

  try {
    const fileInput = document.getElementById('proofFile');
    const file = fileInput && fileInput.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Proof of payment file exceeds 5MB. Please upload a smaller file.');
      }
      data.proofBase64   = await readFileAsBase64(file);
      data.proofFileName = file.name;
      data.proofMimeType  = file.type;
    }
    data.recaptchaToken = await getRecaptchaToken('payment');

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (result.status === 'ok') {
      sessionStorage.removeItem('ich2p_pending_reg');
      document.getElementById('checkoutMain').style.display = 'none';
      document.getElementById('checkoutDone').style.display = 'block';
      document.getElementById('checkoutDone').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      throw new Error(result.message || 'Submission failed.');
    }
  } catch (err) {
    showAlert('checkout-alert-area', 'error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

/* --- News page: fetch from Apps Script --- */
async function loadAnnouncements() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>'.repeat(3);

  try {
    const resp = await fetch(APPS_SCRIPT_URL + '?action=announcements');
    const rows = await resp.json();

    if (!rows || !rows.length) {
      grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:40px 0">No announcements yet. Check back soon.</p>';
      return;
    }

    grid.innerHTML = rows.map(row => `
      <article class="news-card reveal">
        <div class="news-card-body">
          <span class="news-tag">Announcement</span>
          <div class="news-date">${escHtml(row.date || '')}</div>
          <h3 class="news-title">${escHtml(row.title)}</h3>
          <p class="news-excerpt">${escHtml(row.body || '').substring(0, 200)}${row.body && row.body.length > 200 ? '…' : ''}</p>
        </div>
      </article>`).join('');

    /* Trigger reveal for dynamically added elements */
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      setTimeout(() => el.classList.add('visible'), 50);
    });
  } catch {
    grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:40px 0">Unable to load announcements. Please refresh the page.</p>';
  }
}

/* --- Helpers --- */
function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { success: 'fa-circle-check', error: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  el.className = `form-alert alert-${type}`;
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escHtml(message)}</span>`;
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Submitting…';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || 'Submit';
  }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
