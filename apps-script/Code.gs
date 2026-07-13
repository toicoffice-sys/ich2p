/**
 * DLSL ICH2P 2026 — Google Apps Script Backend
 * Handles form submissions, email notifications, and the
 * Announcements GET endpoint.
 *
 * Setup:
 *  1. Create a Google Sheet with tabs: Abstracts, Registrations, Speakers, Announcements
 *  2. Open Extensions > Apps Script, paste this code.
 *  3. Replace SPREADSHEET_ID below.
 *  4. Deploy as Web App: Execute As = Me, Who has access = Anyone
 *  5. Copy deployment URL into js/main.js  APPS_SCRIPT_URL constant.
 */

// ============================================================
// CONFIGURATION — replace these with your actual IDs
// ============================================================
var CONFIG = {
  SPREADSHEET_ID:  '1cPII3Rt-gn3IKNysfC2VCBHwNKKkzvB7WeeYy-cNDzQ',
  SECRET_TOKEN:    'DLSL_ICH2P_2026',           // must match token in main.js
  COMMITTEE_EMAIL: 'ich2p.dlsl@gmail.com',
  FROM_NAME:       '17th ICH2P 2026 — De La Salle Lipa',
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
 * Registration — writes to Registrations sheet, acknowledges receipt.
 */
function handleRegistration(data) {
  var sheet = getSheet('Registrations');

  var required = ['fullName', 'institution', 'country', 'email', 'regType'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]] || !data[required[i]].trim()) {
      return { status: 'error', message: 'Missing required field: ' + required[i] };
    }
  }

  var ts = new Date();
  sheet.appendRow([
    ts,
    data.fullName.trim(),
    data.institution.trim(),
    data.country.trim(),
    data.email.trim().toLowerCase(),
    data.regType,
    data.specialRequests ? data.specialRequests.trim() : '',
    'Pending',
  ]);

  // Acknowledgement email
  sendEmail(
    data.email,
    '17th ICH2P 2026 — Registration Received',
    emailTemplate('Registration Received', [
      'Dear ' + data.fullName + ',',
      'Thank you for registering your interest in the 17th ICH2P 2026, hosted by De La Salle Lipa, December 17–19, 2026.',
      'Your registration has been recorded. Full registration procedures — including payment instructions — will be sent together with your abstract acceptance notification.',
      '<strong>Regular Registration deadline:</strong> November 15, 2026<br><strong>Late Registration deadline:</strong> December 5, 2026',
      'For questions, contact us at ich2p.dlsl@gmail.com.',
    ])
  );

  // Notification to committee
  sendEmail(
    CONFIG.COMMITTEE_EMAIL,
    '[ICH2P 2026] New Registration: ' + data.fullName,
    emailTemplate('New Registration Submitted', [
      '<strong>Name:</strong> ' + data.fullName,
      '<strong>Email:</strong> ' + data.email,
      '<strong>Institution:</strong> ' + data.institution + ', ' + data.country,
      '<strong>Type:</strong> ' + data.regType,
      '<strong>Special Requests:</strong> ' + (data.specialRequests || 'None'),
      'Review in the Registrations sheet.',
    ])
  );

  return { status: 'ok', message: 'Registration received.' };
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
      'Timestamp', 'Full Name', 'Institution', 'Country', 'Email',
      'Registration Type', 'Special Requests', 'Status'
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
