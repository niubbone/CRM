// =======================================================================
// === CONFIGURAZIONE APPLICAZIONE ===
// =======================================================================

export const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwjL-6JzDpKImTr4y-sEaT7Y-ko7GxcA_9W3tUck9lyUWK6_t-tkuK_S2sQP2L9cp2z/exec",
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

