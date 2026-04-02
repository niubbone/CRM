// =======================================================================
// === CONFIGURAZIONE APPLICAZIONE ===
// =======================================================================

export const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzwgSaEfHNt6pPi3vgXS-_J8EHfNZnVGE0byoRkC_9hX6Lhm194nrJYFfugnwdP6v-_/exec",
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

