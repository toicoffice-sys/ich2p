/**
 * DLSL ICH2P 2026 — Google Apps Script Backend
 * Handles form submissions, email notifications, and the
 * Announcements GET endpoint.
 *
 * Setup:
 *  1. Create a Google Sheet with tabs: Abstracts, Registrations, Payments, Speakers, Announcements
 *     (or just run setupSheets() once from the Apps Script editor to create them all).
 *  2. Open Extensions > Apps Script, paste this code.
 *  3. Replace SPREADSHEET_ID below.
 *  4. Replace CONFIG.BDO_LINKS with the real BDO Link.Biz.Ph flexible-amount payment links.
 *  5. Deploy as Web App: Execute As = Me, Who has access = Anyone
 *  6. Copy deployment URL into js/main.js  APPS_SCRIPT_URL constant.
 *  7. See admin-dashboard/ for the separate, Google-Sign-In-gated payment
 *     tracking dashboard for organizers (deployed as its own Apps Script project).
 */

// ============================================================
// CONFIGURATION — replace these with your actual IDs
// ============================================================
var CONFIG = {
  SPREADSHEET_ID:  '1cPII3Rt-gn3IKNysfC2VCBHwNKKkzvB7WeeYy-cNDzQ',
  SECRET_TOKEN:    'DLSL_ICH2P_2026',           // must match token in main.js
  COMMITTEE_EMAIL: 'ich2p.dlsl@gmail.com',
  FROM_NAME:       '17th ICH2P 2026 — De La Salle Lipa',

  // Registration fee schedule — keep in sync with registration.html's fee table
  FEES: {
    ug_ph:            { regular: 6000, late: 6500, currency: 'PHP' },
    grad_ph:          { regular: 7500, late: 8000, currency: 'PHP' },
    prof_ph:          { regular: 8000, late: 9000, currency: 'PHP' },
    nonpaper_ph:      { regular: 9000, late: 9500, currency: 'PHP' },
    student_foreign:  { regular: 125,  late: 175,  currency: 'USD' },
    prof_foreign:     { regular: 150,  late: 200,  currency: 'USD' },
    nonpaper_foreign: { regular: 175,  late: 215,  currency: 'USD' },
  },
  REGULAR_DEADLINE: '2026-11-15T23:59:59+08:00',
  LATE_DEADLINE:    '2026-12-05T23:59:59+08:00',

  // BDO Link.Biz.Ph flexible-amount payment links — REPLACE with the actual
  // links generated from the BDO Link.Biz.Ph merchant portal before going live.
  BDO_LINKS: {
    PHP: 'https://www.linkbiz.ph/REPLACE_WITH_PHP_PAYMENT_LINK',
    USD: 'https://www.linkbiz.ph/REPLACE_WITH_USD_PAYMENT_LINK',
  },

  // Folder (in the Drive of the account this script runs as) where proof-of-payment
  // uploads are stored. Left blank — a folder is created on first upload and the
  // ID is cached in Script Properties under PROOF_FOLDER_ID.
  PROOF_MAX_BYTES: 5 * 1024 * 1024, // 5MB
};

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * HTTP GET — returns published announcements as JSON.
 */
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action ? e.parameter.action : '';
    if (action === 'announcements') {
      return jsonResponse(getAnnouncements());
    }
    return jsonResponse({ status: 'ok', service: '17th ICH2P 2026 Backend' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/**
 * HTTP POST — routes to the correct handler based on form_type.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);

    // Validate secret token
    if (data.token !== CONFIG.SECRET_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized.' });
    }

    // Rate limit: 1 submission per email per 30 seconds
    if (!checkRateLimit(data.email)) {
      return jsonResponse({ status: 'error', message: 'Too many requests. Please wait before resubmitting.' });
    }

    var result;
    switch (data.form_type) {
      case 'abstract':
        result = handleAbstract(data);
        break;
      case 'registration':
        result = handleRegistration(data);
        break;
      case 'payment':
        result = handlePayment(data);
        break;
      default:
        result = { status: 'error', message: 'Unknown form type.' };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * Abstract submission — writes to Abstracts sheet, emails submitter.
 */
function handleAbstract(data) {
  var sheet = getSheet('Abstracts');

  // Validate required fields
  var required = ['name', 'affiliation', 'email', 'presentationType', 'title', 'abstractText'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]] || !data[required[i]].trim()) {
      return { status: 'error', message: 'Missing required field: ' + required[i] };
    }
  }
  var wordCount = data.abstractText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 550) {
    return { status: 'error', message: 'Abstract exceeds the 500-word limit.' };
  }

  var ts = new Date();
  sheet.appendRow([
    ts,                       // Timestamp
    data.name.trim(),         // Name
    data.affiliation.trim(),  // Affiliation
    data.email.trim().toLowerCase(), // Email
    data.presentationType,    // Presentation Type
    data.title.trim(),        // Title
    data.abstractText.trim(), // Abstract Text
    'Pending Review',         // Status
  ]);

  // Confirmation email to submitter
  sendEmail(
    data.email,
    '17th ICH2P 2026 — Abstract Submission Received',
    emailTemplate('Abstract Submission Confirmed', [
      'Dear ' + data.name + ',',
      'We have successfully received your abstract for the 17th International Conference on Hydrogen Production (ICH2P 2026).',
      '<strong>Title:</strong> ' + data.title,
      '<strong>Presentation Type:</strong> ' + data.presentationType,
      'The Organizing Committee will review all abstracts submitted before the October 15, 2026 deadline.',
      'Registration procedures and payment instructions will be included with your abstract acceptance notification.',
      'Thank you for your submission!',
    ])
  );

  // Notification to committee
  sendEmail(
    CONFIG.COMMITTEE_EMAIL,
    '[ICH2P 2026] New Abstract: ' + data.title,
    emailTemplate('New Abstract Submitted', [
      '<strong>Author:</strong> ' + data.name + ' (' + data.email + ')',
      '<strong>Affiliation:</strong> ' + data.affiliation,
      '<strong>Presentation:</strong> ' + data.presentationType,
      '<strong>Title:</strong> ' + data.title,
      'Review in the Abstracts sheet.',
    ])
  );

  return { status: 'ok', message: 'Abstract received.' };
}

/**
 * Registration — writes to Registrations sheet, acknowledges receipt,
 * and returns the amount due so the client can proceed to checkout.html.
 */
function handleRegistration(data) {
  var sheet = getSheet('Registrations');

  var required = ['fullName', 'institution', 'country', 'email', 'regType'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]] || !data[required[i]].trim()) {
      return { status: 'error', message: 'Missing required field: ' + required[i] };
    }
  }

  var feeInfo = getFeeForRegType(data.regType);
  if (!feeInfo) {
    return { status: 'error', message: 'Unknown registration type.' };
  }

  var ts    = new Date();
  var regId = generateRegId();

  sheet.appendRow([
    ts,
    regId,
    data.fullName.trim(),
    data.institution.trim(),
    data.country.trim(),
    data.email.trim().toLowerCase(),
    data.regType,
    data.specialRequests ? data.specialRequests.trim() : '',
    feeInfo.amount,
    feeInfo.currency,
    'Pending Payment',
  ]);

  // Acknowledgement email
  sendEmail(
    data.email,
    '17th ICH2P 2026 — Registration Received (Ref: ' + regId + ')',
    emailTemplate('Registration Received', [
      'Dear ' + data.fullName + ',',
      'Thank you for registering for the 17th ICH2P 2026, hosted by De La Salle Lipa, December 17–19, 2026.',
      '<strong>Reference No:</strong> ' + regId,
      '<strong>Amount Due:</strong> ' + formatMoney(feeInfo.amount, feeInfo.currency) + ' (' + feeInfo.tier + ' rate)',
      'Please complete payment via the BDO checkout link shown on the confirmation page, then submit your BDO reference number so our team can verify and confirm your slot.',
      'For questions, contact us at ich2p.dlsl@gmail.com.',
    ])
  );

  // Notification to committee
  sendEmail(
    CONFIG.COMMITTEE_EMAIL,
    '[ICH2P 2026] New Registration: ' + data.fullName,
    emailTemplate('New Registration Submitted', [
      '<strong>Reference No:</strong> ' + regId,
      '<strong>Name:</strong> ' + data.fullName,
      '<strong>Email:</strong> ' + data.email,
      '<strong>Institution:</strong> ' + data.institution + ', ' + data.country,
      '<strong>Type:</strong> ' + data.regType,
      '<strong>Amount Due:</strong> ' + formatMoney(feeInfo.amount, feeInfo.currency),
      '<strong>Special Requests:</strong> ' + (data.specialRequests || 'None'),
      'Review in the Registrations sheet.',
    ])
  );

  return {
    status:     'ok',
    message:    'Registration received.',
    regId:      regId,
    fullName:   data.fullName.trim(),
    email:      data.email.trim().toLowerCase(),
    regType:    data.regType,
    amountDue:  feeInfo.amount,
    currency:   feeInfo.currency,
    tier:       feeInfo.tier,
    bdoLink:    CONFIG.BDO_LINKS[feeInfo.currency] || '',
  };
}

/**
 * Payment reference submission — writes to Payments sheet as
 * "Pending Verification" and flags the matching Registrations row.
 */
function handlePayment(data) {
  var required = ['regId', 'bdoReferenceNo', 'email'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]] || !String(data[required[i]]).trim()) {
      return { status: 'error', message: 'Missing required field: ' + required[i] };
    }
  }

  var reg = findRegistrationByRegId(data.regId.trim().toUpperCase());
  if (!reg) {
    return { status: 'error', message: 'We could not find a registration with that reference number.' };
  }

  var proofUrl = '';
  if (data.proofBase64 && data.proofFileName) {
    try {
      proofUrl = saveProofFile(data.proofBase64, data.proofFileName, data.proofMimeType, reg.regId);
    } catch (err) {
      return { status: 'error', message: 'Could not save proof of payment: ' + err.message };
    }
  }

  var ts = new Date();
  var paymentsSheet = getSheet('Payments');
  paymentsSheet.appendRow([
    ts,
    reg.regId,
    reg.fullName,
    reg.email,
    reg.regType,
    reg.amountDue,
    reg.currency,
    data.bdoReferenceNo.trim(),
    proofUrl,
    'Pending Verification',
    '',   // Verified By
    '',   // Verified On
    data.notes ? data.notes.trim() : '',
  ]);

  setRegistrationStatus(reg.rowIndex, 'Payment Submitted — Pending Verification');

  sendEmail(
    reg.email,
    '17th ICH2P 2026 — Payment Reference Received (Ref: ' + reg.regId + ')',
    emailTemplate('Payment Reference Received', [
      'Dear ' + reg.fullName + ',',
      'We received your BDO payment reference for registration ' + reg.regId + '.',
      '<strong>BDO Reference No:</strong> ' + data.bdoReferenceNo.trim(),
      '<strong>Amount:</strong> ' + formatMoney(reg.amountDue, reg.currency),
      'Our team will verify this against BDO records and send a confirmation email once your payment is verified, usually within 1–2 business days.',
      'For questions, contact us at ich2p.dlsl@gmail.com.',
    ])
  );

  sendEmail(
    CONFIG.COMMITTEE_EMAIL,
    '[ICH2P 2026] Payment Submitted: ' + reg.fullName + ' (' + reg.regId + ')',
    emailTemplate('Payment Reference Submitted', [
      '<strong>Reference No:</strong> ' + reg.regId,
      '<strong>Name:</strong> ' + reg.fullName + ' (' + reg.email + ')',
      '<strong>Amount Due:</strong> ' + formatMoney(reg.amountDue, reg.currency),
      '<strong>BDO Reference No:</strong> ' + data.bdoReferenceNo.trim(),
      proofUrl ? '<strong>Proof of Payment:</strong> <a href="' + proofUrl + '">' + proofUrl + '</a>' : '<strong>Proof of Payment:</strong> Not attached',
      'Verify against the BDO merchant dashboard and update the Payments sheet, or use the admin dashboard.',
    ])
  );

  return { status: 'ok', message: 'Payment reference submitted for verification.' };
}

// ============================================================
// ANNOUNCEMENTS (GET endpoint)
// ============================================================

function getAnnouncements() {
  var sheet = getSheet('Announcements');
  var rows  = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[3] === 'Y' || row[3] === true) { // Published column
      results.push({
        date:  formatDate(row[0]),
        title: row[1],
        body:  row[2],
      });
    }
  }

  return results.reverse(); // Newest first
}

// ============================================================
// HELPERS
// ============================================================

function getSheet(name) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found. Please create it in the spreadsheet.');
  return sheet;
}

/**
 * Looks up the fee for a registration type based on today's date vs.
 * the regular/late deadlines in CONFIG.
 */
function getFeeForRegType(regType) {
  var fee = CONFIG.FEES[regType];
  if (!fee) return null;

  var now = new Date();
  var regularDeadline = new Date(CONFIG.REGULAR_DEADLINE);
  var tier = now <= regularDeadline ? 'regular' : 'late';

  return {
    amount:   fee[tier],
    currency: fee.currency,
    tier:     tier,
  };
}

/**
 * Short, unguessable registration reference (e.g. "ICH2P-7K3QF9").
 */
function generateRegId() {
  var code = Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase();
  return 'ICH2P-' + code;
}

function formatMoney(amount, currency) {
  var symbol = currency === 'USD' ? 'USD' : 'Php';
  return symbol + Number(amount).toLocaleString('en-US');
}

/**
 * Finds a registration row by RegID (column B). Returns null if not found.
 */
function findRegistrationByRegId(regId) {
  var sheet = getSheet('Registrations');
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim().toUpperCase() === regId) {
      return {
        rowIndex:  i + 1, // 1-based sheet row
        regId:     values[i][1],
        fullName:  values[i][2],
        email:     values[i][5],
        regType:   values[i][6],
        amountDue: values[i][8],
        currency:  values[i][9],
      };
    }
  }
  return null;
}

function setRegistrationStatus(rowIndex, status) {
  var sheet = getSheet('Registrations');
  sheet.getRange(rowIndex, 11).setValue(status); // Status is column K
}

/**
 * Saves a base64-encoded proof-of-payment file to Drive and returns its URL.
 * Files are stored in a dedicated folder, created on first use and cached
 * in Script Properties so re-runs reuse the same folder.
 */
function saveProofFile(base64Data, fileName, mimeType, regId) {
  var sizeBytes = Math.ceil((base64Data.length * 3) / 4);
  if (sizeBytes > CONFIG.PROOF_MAX_BYTES) {
    throw new Error('File exceeds the 5MB limit.');
  }

  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('PROOF_FOLDER_ID');
  var folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = null;
    }
  }
  if (!folder) {
    folder = DriveApp.createFolder('ICH2P 2026 — Proof of Payment');
    props.setProperty('PROOF_FOLDER_ID', folder.getId());
  }

  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType || 'application/octet-stream',
    regId + '_' + fileName
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function sendEmail(to, subject, htmlBody) {
  MailApp.sendEmail({
    to:       to,
    subject:  subject,
    htmlBody: htmlBody,
    name:     CONFIG.FROM_NAME,
    replyTo:  CONFIG.COMMITTEE_EMAIL,
  });
}

function emailTemplate(heading, paragraphs) {
  var body = paragraphs.map(function(p) {
    return '<p style="margin:0 0 12px;line-height:1.7;color:#374151;">' + p + '</p>';
  }).join('');

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">' +
    '<tr><td style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:32px 40px;">' +
    '<p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">DE LA SALLE LIPA · 17TH ICH2P 2026</p>' +
    '<h2 style="margin:8px 0 0;color:#fff;font-size:22px;">' + heading + '</h2>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 40px;">' + body + '</td></tr>' +
    '<tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">' +
    '<p style="margin:0;font-size:12px;color:#9ca3af;">' +
    'De La Salle Lipa · Lipa City, Batangas, Philippines · ' +
    '<a href="mailto:ich2p.dlsl@gmail.com" style="color:#2E7D32;">ich2p.dlsl@gmail.com</a></p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(d) {
  if (!d) return '';
  var date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Simple rate limiter — tracks last submission timestamp per email in ScriptProperties.
 * Returns true if allowed, false if too frequent.
 */
function checkRateLimit(email) {
  if (!email) return true;
  var key   = 'rate_' + email.replace(/[^a-zA-Z0-9]/g, '_');
  var props = PropertiesService.getScriptProperties();
  var last  = parseInt(props.getProperty(key) || '0');
  var now   = Date.now();

  if (now - last < 30000) return false; // 30 second cooldown

  props.setProperty(key, String(now));
  return true;
}

// ============================================================
// SETUP HELPER (run once manually to create sheet structure)
// ============================================================

/**
 * Run this function once from the Apps Script editor to create
 * all required sheet tabs with their headers.
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var sheets = {
    'Abstracts': [
      'Timestamp', 'Name', 'Affiliation', 'Email',
      'Presentation Type', 'Title', 'Abstract Text', 'Status'
    ],
    'Registrations': [
      'Timestamp', 'RegID', 'Full Name', 'Institution', 'Country', 'Email',
      'Registration Type', 'Special Requests', 'Amount Due', 'Currency', 'Status'
    ],
    'Payments': [
      'Timestamp', 'RegID', 'Full Name', 'Email', 'Registration Type',
      'Amount Due', 'Currency', 'BDO Reference No', 'Proof URL', 'Status',
      'Verified By', 'Verified On', 'Notes'
    ],
    'Speakers': [
      'Name', 'Institution', 'Country', 'Bio', 'Photo URL', 'Status'
    ],
    'Announcements': [
      'Date', 'Title', 'Body', 'Published (Y/N)'
    ],
  };

  Object.keys(sheets).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var headers = sheets[name];
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#1B5E20');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  SpreadsheetApp.getUi().alert('Sheets set up successfully! All tabs created with headers.');
}
