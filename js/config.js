// =======================================================================
// === CONFIGURAZIONE APPLICAZIONE ===
// =======================================================================

export const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwtpEhoAWLHHyKoFi0Uwlmjfev6XaBOUbW-LspEZY2Hsc0PFzEyekIQ_PyoZUOslIkN/exec",
  APP_NAME: "Studio Smart Timesheet",
  VERSION: "2.0.0"
};

// Esponi CONFIG globalmente per script non-module (come vendite.js)
window.CONFIG = CONFIG;

// Variabili globali condivise (accessibili da window)
export function initGlobalState() {
  window.clients = [];
  window.config = {};
  window.selectedTimesheet = [];
  window.currentTimesheetData = [];
}

