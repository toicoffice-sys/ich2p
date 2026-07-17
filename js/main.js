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
  }

  /* Registration form */
  const regForm = document.getElementById('registrationForm');
  if (regForm) {
    regForm.addEventListener('submit', submitRegistration);
    initFeeCalculator();
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
    if (inp.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value)) {
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
    token:             'DLSL_ICH2P_2026',
    name:              form.name.value.trim(),
    affiliation:       form.affiliation.value.trim(),
    email:             form.email.value.trim(),
    presentationType:  form.presentationType.value,
    title:             form.title.value.trim(),
    abstractText:      form.abstractText.value.trim(),
  };

  try {
    data.pdfBase64    = await readFileAsBase64(pdfFile);
    data.pdfFileName  = pdfFile.name;
    data.pdfMimeType  = pdfFile.type;

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
        'Your abstract has been submitted successfully! A confirmation email has been sent to ' + data.email);
    } else {
      throw new Error(result.message || 'Submission failed.');
    }
  } catch (err) {
    showAlert('form-alert-area', 'error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
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
    token:           'DLSL_ICH2P_2026',
    fullName:        form.fullName.value.trim(),
    institution:     form.institution.value.trim(),
    country:         form.country.value.trim(),
    email:           form.email.value.trim(),
    regType:         form.regType.value,
    specialRequests: form.specialRequests ? form.specialRequests.value.trim() : '',
  };

  try {
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
}

function formatMoney(amount, currency) {
  const symbol = currency === 'USD' ? 'USD ' : 'Php';
  return symbol + Number(amount).toLocaleString('en-US');
}

async function submitPayment(e, reg) {
  e.preventDefault();
  const form = e.target;
  const refInput = document.getElementById('bdoReferenceNo');

  if (!refInput.value.trim()) {
    refInput.style.borderColor = '#DC2626';
    refInput.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)';
    showAlert('checkout-alert-area', 'error', 'Please enter your BDO reference / transaction number.');
    return;
  }
  refInput.style.borderColor = '';
  refInput.style.boxShadow = '';

  const btn = form.querySelector('[type="submit"]');
  setLoading(btn, true);

  const data = {
    form_type:      'payment',
    token:          'DLSL_ICH2P_2026',
    regId:          reg.regId,
    email:          reg.email,
    bdoReferenceNo: refInput.value.trim(),
    notes:          document.getElementById('paymentNotes').value.trim(),
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
          <div class="news-date">${row.date || ''}</div>
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
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
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
