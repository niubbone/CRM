// =======================================================================
// === CONFIGURAZIONE APPLICAZIONE ===
// =======================================================================

export const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxodRCMoPa9VW2nphsazv8Ux72mebjCSKd48c0HKoCOsrG5Z-ZJFyzCWHt6qhCgPxkU/exec",
  // I TODO della Home non stanno più su Apps Script ma sull'hosting di
  // studio-smart.it (PHP + SQLite, ~100 ms): sorgente in Hosting/api/crm-todo.php
  TODO_API_URL: "https://www.studio-smart.it/api/crm-todo.php",
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

