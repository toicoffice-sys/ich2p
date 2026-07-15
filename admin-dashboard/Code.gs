/**
 * ICH2P 2026 — Admin Payment Tracking Dashboard
 *
 * Deliberately a SEPARATE Apps Script project from apps-script/Code.gs (the
 * public site backend). The public backend must stay anonymously accessible
 * (registration/abstract forms, announcements feed), while this dashboard
 * must be gated by Google Sign-In. A single Apps Script deployment can only
 * have one access/executeAs configuration, so splitting them into two
 * projects is what lets each have the right one.
 *
 * Setup:
 *  1. Create a new Apps Script project (Apps Script editor > New project, or
 *     `clasp create --type webapp --title "ICH2P Admin Dashboard"` from this folder).
 *  2. Paste in this Code.gs and admin.html.
 *  3. Replace CONFIG.SPREADSHEET_ID below with the SAME spreadsheet ID used
 *     by apps-script/Code.gs (the public site backend) — both projects read
 *     and write the same Registrations / Payments sheets.
 *  4. Open this file in the Apps Script editor, edit the `emails` array in
 *     setAdminEmails() below, then run that function once (Run > setAdminEmails).
 *  5. Deploy as Web App:
 *       Execute As     = User accessing the web app
 *       Who has access = Anyone with Google account
 *     (Do NOT choose "Anyone" (anonymous) — the access check below relies on
 *     Session.getActiveUser(), which is only populated when the visitor signs in.)
 *  6. Share the resulting /exec URL directly with organizers by email/chat.
 *     Do NOT link it from the public conference site or its nav.
 */

var CONFIG = {
  SPREADSHEET_ID: '1cPII3Rt-gn3IKNysfC2VCBHwNKKkzvB7WeeYy-cNDzQ', // same spreadsheet as apps-script/Code.gs
};

// ============================================================
// WEB APP ENTRY POINT
// ============================================================

function doGet(e) {
  var email = getCurrentEmail_();

  if (!isAdmin_(email)) {
    return HtmlService.createHtmlOutput(accessDeniedHtml_(email))
      .setTitle('ICH2P 2026 — Access Denied');
  }

  var tpl = HtmlService.createTemplateFromFile('admin');
  tpl.userEmail = email;
  tpl.spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID + '/edit';

  return tpl.evaluate()
    .setTitle('ICH2P 2026 — Payment Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// RPCs — called from admin.html via google.script.run
// ============================================================

/**
 * Returns everything the dashboard needs: raw rows + summary stats.
 * Every RPC re-checks the allow-list — never trust that doGet already did.
 */
function getDashboardData() {
  assertAdmin_();

  var registrations = readSheetAsObjects_('Registrations');
  var payments = readSheetAsObjects_('Payments');

  var stats = {
    totalRegistrations: registrations.length,
    pendingVerification: 0,
    verified: 0,
    rejected: 0,
    collected: {}, // { PHP: 12345, USD: 500 }
  };

  payments.forEach(function (p) {
    var status = p['Status'];
    if (status === 'Verified') {
      stats.verified++;
      var cur = p['Currency'] || 'PHP';
      stats.collected[cur] = (stats.collected[cur] || 0) + (Number(p['Amount Due']) || 0);
    } else if (status === 'Rejected') {
      stats.rejected++;
    } else {
      stats.pendingVerification++;
    }
  });

  return {
    email: getCurrentEmail_(),
    registrations: registrations,
    payments: payments,
    stats: stats,
  };
}

/**
 * Approve/reject/reset a payment row. rowIndex is the 1-based sheet row
 * (returned as `_row` on each payment object from getDashboardData()).
 */
function updatePaymentStatus(rowIndex, newStatus) {
  assertAdmin_();

  var validStatuses = ['Verified', 'Rejected', 'Pending Verification'];
  if (validStatuses.indexOf(newStatus) === -1) {
    throw new Error('Invalid status: ' + newStatus);
  }

  var sheet = getSheet_('Payments');
  var email = getCurrentEmail_();

  sheet.getRange(rowIndex, 10).setValue(newStatus); // Status
  sheet.getRange(rowIndex, 11).setValue(email);     // Verified By
  sheet.getRange(rowIndex, 12).setValue(
    newStatus === 'Pending Verification' ? '' : new Date()
  ); // Verified On

  var regId = sheet.getRange(rowIndex, 2).getValue();
  var regStatus =
    newStatus === 'Verified' ? 'Paid' :
    newStatus === 'Rejected' ? 'Payment Rejected — Please Resubmit' :
    'Payment Submitted — Pending Verification';
  updateRegistrationStatusByRegId_(regId, regStatus);

  return getDashboardData();
}

// ============================================================
// ADMIN ALLOW-LIST
// ============================================================

function getCurrentEmail_() {
  try {
    return (Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function isAdmin_(email) {
  if (!email) return false;
  return getAdminEmails_().indexOf(email) !== -1;
}

function assertAdmin_() {
  if (!isAdmin_(getCurrentEmail_())) {
    throw new Error('Not authorized to perform this action.');
  }
}

function getAdminEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || 'ich2p.dlsl@gmail.com';
  return raw.split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(Boolean);
}

/**
 * Run this once from the Apps Script editor (Run > setAdminEmails) whenever
 * the list of organizers who can access the dashboard changes.
 */
function setAdminEmails() {
  var emails = [
    'ich2p.dlsl@gmail.com',
    // add more organizer emails here, one per line, e.g.:
    // 'toic.office@dlsl.edu.ph',
  ];
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAILS', emails.join(','));
}

// ============================================================
// SHEET HELPERS
// ============================================================

function getSheet_(name) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found.');
  return sheet;
}

function readSheetAsObjects_(name) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0];
  var tz = Session.getScriptTimeZone();
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      var v = values[i][c];
      obj[headers[c]] = (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm') : v;
    }
    rows.push(obj);
  }
  return rows;
}

function updateRegistrationStatusByRegId_(regId, status) {
  var sheet = getSheet_('Registrations');
  var values = sheet.getDataRange().getValues();
  var target = String(regId).trim().toUpperCase();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim().toUpperCase() === target) {
      sheet.getRange(i + 1, 11).setValue(status); // Status column
      return;
    }
  }
}

function accessDeniedHtml_(email) {
  return '<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;' +
    'max-width:480px;margin:80px auto;text-align:center;color:#374151;">' +
    '<h2 style="color:#1B5E20;">Access Denied</h2>' +
    '<p>' + (email
      ? 'Signed in as <strong>' + email + '</strong>, but this account is'
      : 'This account is') +
    ' not authorized to view the ICH2P 2026 payment dashboard.</p>' +
    '<p>Contact <a href="mailto:ich2p.dlsl@gmail.com">ich2p.dlsl@gmail.com</a> to request access.</p>' +
    '</body></html>';
}
