/**
 * config.js
 * -----------------------------------------------------------------------
 * ONE place to set the Google Apps Script Web App URL.
 * Every portal page (student, teacher, admin, IE) loads this file BEFORE api.js,
 * so you paste the URL here once and all portals use it.
 *
 * Paste your deployed Web App URL (ends in /exec) between the quotes:
 * -----------------------------------------------------------------------
 */
window.APP_CONFIG = {
  backendUrl: "https://script.google.com/macros/s/AKfycbyZu_zF7Art3-ESITSghS2jbN9jNcDb3LU6FPYMHmWBGuEmCLPqk7Pl057dZ8DbVAbpUQ/exec"
};
