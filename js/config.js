// =======================================================================
// === CONFIGURAZIONE APPLICAZIONE ===
// =======================================================================

export const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyVth91EYNt38fXkL_Nessd-J4PE8yu_hUy1nxKIwryShRX-MluW71Ty_2dtok7X2ll/exec",
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

