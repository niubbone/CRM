// =======================================================================
// === TIMESHEET - GESTIONE TAB TIMESHEET ===
// =======================================================================

import { getClientsAndConfig, addClient, getLastWarning } from './api.js';
import { getTodayDate, showNotification } from './utils.js';

/**
 * Inizializza il tab timesheet
 */
export async function initTimesheet() {
  await loadFormData();
  setupFormSubmit();
  setTodayDate();
  setupSelectFocus();
  setupClientValidation();
}

/**
 * Carica dati clienti e configurazioni
 */
async function loadFormData() {
  const submitButton = document.getElementById('submit-btn');
  const infoBox = document.getElementById('info-box');
  
  submitButton.value = "Caricamento dati...";
  submitButton.disabled = true;
  infoBox.innerHTML = '<p>⏳ Caricamento dati dal foglio Google...</p>';

  try {
    const data = await getClientsAndConfig();
    
    window.clients = data.clients;
    window.config = data.config;
    
    // IMPORTANTE: Cancella la cache del browser per il campo cliente
    const clientInput = document.getElementById('client');
    if (clientInput) {
      clientInput.value = '';
      clientInput.setAttribute('autocomplete', 'off');
    }
    
    populateFormFields();
    populateProformaClients();
    showNotification('info-box', '✅ Dati caricati. Compila il form e clicca "Salva Timesheet"', 'success');
  } catch (error) {
    console.error("Errore caricamento dati:", error);
    showNotification('info-box', '❌ Errore nel caricamento dei dati. Ricarica la pagina.', 'error');
  } finally {
    submitButton.value = "Salva Timesheet";
    submitButton.disabled = false;
  }
}

/**
 * Popola i campi del form con clienti e configurazioni
 */
function populateFormFields() {
  // Popola datalist clienti
  const clientDatalist = document.getElementById('client_list');
  clientDatalist.innerHTML = '';
  window.clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.name;
    clientDatalist.appendChild(option);
  });

  // ⭐ FILTRO MODALITÀ ADDEBITO - Solo valori inseribili dall'utente
  const MOD_ADDEBITO_INSERIBILI = [
    'Da fatturare',
    'Scala da pacchetto',
    'Incluso nel canone',
    'Startup Kleos'
  ];

  // Popola select con configurazioni
  const selectDataMap = {
    'tipo_intervento': window.config.tipoIntervento || [],
    'mod_esecuzione': window.config.modEsecuzione || [],
    'mod_addebito': window.config.modAddebito || []
  };

  for (const id in selectDataMap) {
    const select = document.getElementById(id);
    let options = selectDataMap[id];
    
    // ⭐ FILTRO: Se è mod_addebito, mostra solo opzioni inseribili
    if (id === 'mod_addebito') {
      options = options.filter(item => MOD_ADDEBITO_INSERIBILI.includes(item));
    }
    
    if (options && Array.isArray(options) && options.length > 0) {
      select.innerHTML = '';
      
      const placeholder = document.createElement('option');
      placeholder.value = "";
      const placeholderText = id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      placeholder.textContent = `Seleziona ${placeholderText}`;
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      options.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
      });
    } else {
      console.warn(`Configurazione vuota per: ${id}`);
    }
  }
}

/**
 * Popola datalist clienti per proforma (step-1 e filtro)
 * NOTA: Per datalist si usa solo option.value, non textContent
 */
function populateProformaClients() {
  // Popola datalist per step-1 (selezione cliente in creazione proforma)
  const clientDatalistProforma = document.getElementById('proforma-client-list');
  if (clientDatalistProforma) {
    clientDatalistProforma.innerHTML = '';
    window.clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.name;
      clientDatalistProforma.appendChild(option);
    });
    console.log(`✅ Popolato datalist proforma_client_select con ${window.clients.length} clienti`);
  }

  // Popola datalist per il filtro nella sezione gestione proforma
  const filterDatalist = document.getElementById('filter-cliente-proforma-list');
  if (filterDatalist) {
    filterDatalist.innerHTML = '';
    window.clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.name;
      filterDatalist.appendChild(option);
    });
    console.log(`✅ Popolato datalist filtro proforma con ${window.clients.length} clienti`);
  }
}

/**
 * Setup validazione real-time del campo cliente
 * NUOVO: Impedisce inserimento di clienti non validi
 */
function setupClientValidation() {
  const clientInput = document.getElementById('client');
  
  if (!clientInput) return;
  
  // Feedback visivo real-time
  clientInput.addEventListener('input', function() {
    const clientName = this.value.trim();
    
    if (!clientName) {
      this.style.borderColor = '';
      return;
    }
    
    const isValid = window.clients.some(client => client.name === clientName);
    
    if (isValid) {
      this.style.borderColor = '#28a745'; // Verde
      this.style.borderWidth = '2px';
    } else {
      this.style.borderColor = '#dc3545'; // Rosso
      this.style.borderWidth = '2px';
    }
  });
  
  // Reset colore quando perde focus
  clientInput.addEventListener('blur', function() {
    setTimeout(() => {
      this.style.borderColor = '';
      this.style.borderWidth = '';
    }, 2000);
  });
}

/**
 * Setup submit del form timesheet
 */
function setupFormSubmit() {
  const form = document.getElementById('timesheet-form');
  form.addEventListener('submit', handleFormSubmit);
}

/**
 * Gestisce il submit del form
 * MODIFICATO: Aggiunta validazione stricta del cliente
 */
function handleFormSubmit(event) {
  // 🚨 VALIDAZIONE CRITICA: Verifica che il cliente esista
  const clientInput = document.getElementById('client');
  const clientName = clientInput.value.trim();
  
  if (!clientName) {
    event.preventDefault();
    showNotification('info-box', '❌ ERRORE: Devi selezionare un cliente', 'error');
    clientInput.focus();
    return false;
  }
  
  // Verifica che il nome cliente sia nella lista valida
  const validClient = window.clients.find(client => client.name === clientName);
  
  if (!validClient) {
    event.preventDefault();
    showNotification('info-box', 
      `❌ ERRORE CRITICO: Cliente "${clientName}" non esiste nel database.<br><br>` +
      `<strong>Possibili cause:</strong><br>` +
      `• Nome cliente modificato nel foglio Google<br>` +
      `• Cache del browser con dati obsoleti<br>` +
      `• Cliente non ancora sincronizzato<br><br>` +
      `<strong>Soluzione:</strong> Ricarica la pagina (F5) e seleziona il cliente dalla lista aggiornata`, 
      'error');
    clientInput.focus();
    clientInput.select();
    return false;
  }
  
  const submitButton = document.getElementById('submit-btn');
  const infoBox = document.getElementById('info-box');
  
  submitButton.value = "Salvataggio in corso...";
  submitButton.disabled = true;
  infoBox.innerHTML = '<p>⏳ Invio dati a Google Sheets...</p>';
  
  const iframe = document.getElementById('hidden_iframe');
  
  iframe.onload = async function() {
    try {
      // Attendi un attimo che il backend completi il salvataggio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Recupera eventuali warning dal backend
      const warningMessage = await getLastWarning();
      
      submitButton.value = "Salva Timesheet";
      submitButton.disabled = false;
      
      if (warningMessage) {
        // Determina il tipo di alert in base al contenuto
        let alertType = 'warning';
        let alertDuration = 12000; // Default 12 secondi
        
        if (warningMessage.includes('TERMINATO')) {
          alertType = 'terminated';
          alertDuration = 15000; // 15 secondi per TERMINATO
        } else if (warningMessage.includes('OVER')) {
          alertType = 'over';
          alertDuration = 20000; // 20 secondi per OVER (critico)
        } else if (warningMessage.includes('SCADUTO')) {
          alertType = 'expired';
          alertDuration = 15000; // 15 secondi per SCADUTO
        } else if (warningMessage.includes('ERRORE')) {
          alertType = 'error';
          alertDuration = 20000; // 20 secondi per ERRORE
        }
        
        // Stili diversi per tipo di alert
        const alertStyles = {
          warning: 'background: #fff3cd; border-left: 5px solid #ffc107; color: #856404; border: 2px solid #ffc107;',
          terminated: 'background: #cfe2ff; border-left: 5px solid #0d6efd; color: #084298; border: 2px solid #0d6efd;',
          over: 'background: #f8d7da; border-left: 5px solid #dc3545; color: #842029; border: 2px solid #dc3545; font-weight: 500;',
          expired: 'background: #ffe5d0; border-left: 5px solid #fd7e14; color: #984c0c; border: 2px solid #fd7e14;',
          error: 'background: #f8d7da; border-left: 5px solid #dc3545; color: #721c24; border: 2px solid #dc3545; font-weight: 500;'
        };
        
        // Sostituisci il marcatore |||BREAK||| con doppio a capo per visualizzazione
        const displayMessage = warningMessage.replace(/\|\|\|BREAK\|\|\|/g, '\n\n');
        
        infoBox.innerHTML = `
          <div class="alert-box" style="${alertStyles[alertType]} padding: 20px !important; margin-bottom: 15px !important; border-radius: 8px; font-size: 15px; line-height: 1.6;">
            <strong style="display: block; margin-bottom: 10px; font-size: 16px;">
              ${alertType === 'over' ? '🚨 ALERT CRITICO' : 
                alertType === 'error' ? '❌ ERRORE' :
                alertType === 'terminated' ? '✅ PACCHETTO COMPLETATO' : 
                alertType === 'expired' ? '⏰ ATTENZIONE' : 
                '⚠️ ATTENZIONE'}
            </strong>
            <div style="white-space: pre-line;">${displayMessage}</div>
          </div>
          <p style="color: #155724; background: #d4edda; padding: 15px !important; border-radius: 4px;">✅ Timesheet salvato</p>
        `;
        
        // Nascondi alert dopo il tempo specificato
        setTimeout(function() {
          const alertBox = document.querySelector('.alert-box');
          if (alertBox) {
            alertBox.style.transition = 'opacity 0.5s ease';
            alertBox.style.opacity = '0';
            setTimeout(() => alertBox.remove(), 500);
          }
          infoBox.innerHTML = '<p>✅ Pronto per un nuovo inserimento</p>';
        }, alertDuration);
        
      } else {
        showNotification('info-box', '✅ Timesheet salvato con successo!', 'success');
      }
      
      const currentDate = document.getElementById('date').value;
      document.getElementById('timesheet-form').reset();
      document.getElementById('date').value = currentDate;
      document.getElementById('send_email').checked = true;
      
    } catch (e) {
      console.error('Errore gestione submit:', e);
      submitButton.value = "Salva Timesheet";
      submitButton.disabled = false;
      showNotification('info-box', '✅ Timesheet salvato', 'success');
      
      const currentDate = document.getElementById('date').value;
      document.getElementById('timesheet-form').reset();
      document.getElementById('date').value = currentDate;
      document.getElementById('send_email').checked = true;
      
      setTimeout(function() {
        infoBox.innerHTML = '<p>✅ Pronto per un nuovo inserimento</p>';
      }, 5000);
    }
  };
}

/**
 * Imposta la data odierna nel campo data
 */
function setTodayDate() {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.value = getTodayDate();
  }
}

/**
 * Setup focus/blur per nascondere placeholder nei select
 */
function setupSelectFocus() {
  document.querySelectorAll('select').forEach(select => {
    select.addEventListener('focus', function() {
      const defaultOption = this.querySelector('option[value=""]');
      if (defaultOption) {
        defaultOption.style.display = 'none';
      }
    });
    select.addEventListener('blur', function() {
      const defaultOption = this.querySelector('option[value=""]');
      if (defaultOption && this.value === '') {
        defaultOption.style.display = 'block';
      }
    });
  });
}

/**
 * Apre il modal per aggiungere un nuovo cliente
 */
export function openAddClientModal() {
  document.getElementById('add-client-modal').style.display = 'flex';
}

/**
 * Chiude il modal aggiungi cliente
 */
export function closeAddClientModal() {
  document.getElementById('add-client-modal').style.display = 'none';
  document.getElementById('new-client-name').value = '';
  document.getElementById('new-client-email').value = '';
}

/**
 * Salva un nuovo cliente
 */
export async function saveNewClient() {
  const clientName = document.getElementById('new-client-name').value.trim();
  const clientEmail = document.getElementById('new-client-email').value.trim();
  
  if (!clientName) {
    alert('Inserisci il nome del cliente');
    return;
  }
  
  const saveBtn = document.querySelector('.btn-save');
  saveBtn.textContent = 'Salvataggio...';
  saveBtn.disabled = true;
  
  try {
    await addClient(clientName, clientEmail);
    
    // IMPORTANTE: Forza il refresh completo dei dati
    await loadFormData();
    
    document.getElementById('client').value = clientName;
    closeAddClientModal();
    showNotification('info-box', '✅ Cliente aggiunto con successo!', 'success');
  } catch (error) {
    console.error('Errore:', error);
    alert('Errore: ' + error.message);
  } finally {
    saveBtn.textContent = 'Salva';
    saveBtn.disabled = false;
  }
}

// =============================================================================
// HANDLER MODALITÀ EDIT
// =============================================================================

/**
 * Gestisce il submit del form in modalità edit
 * Modifica il comportamento se submit-btn ha dataset.editMode = 'true'
 */
function handleTimesheetSubmit(event) {
    const submitBtn = document.getElementById('submit-btn');
    
    // Controlla se siamo in modalità edit
    if (submitBtn.dataset.editMode === 'true') {
        event.preventDefault(); // Blocca submit normale
        
        const rowIndex = parseInt(submitBtn.dataset.editRow);
        
        if (!rowIndex) {
            alert('❌ Errore: riga da modificare non specificata');
            return;
        }
        
        // Raccogli dati dal form
        const formData = {
            row: rowIndex,
            date: document.getElementById('date').value,
            start_time: document.getElementById('start_time').value,
            stop_time: document.getElementById('stop_time').value,
            client_name: document.getElementById('client_name').value,
            tipo_intervento: document.getElementById('tipo_intervento').value,
            mod_esecuzione: document.getElementById('mod_esecuzione').value,
            chiamata: document.getElementById('chiamata').value,
            mod_addebito: document.getElementById('mod_addebito').value,
            description: document.getElementById('description').value
        };
        
        // Chiamata backend per update
        updateTimesheet(formData);
    }
    // Altrimenti lascia procedere il submit normale (nuovo timesheet)
}

/**
 * Aggiorna timesheet esistente via backend
 */
async function updateTimesheet(formData) {
    try {
        // Costruisci URL
        const params = new URLSearchParams();
        params.append('action', 'update_timesheet');
        
        Object.keys(formData).forEach(key => {
            params.append(key, formData[key]);
        });
        
        const url = `${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`;
        
        // Loading
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.value = '⏳ Aggiornamento...';
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Timesheet aggiornato con successo!');
            
            // Reset form
            document.getElementById('timesheet-form').reset();
            
            // Reset pulsante a modalità normale
            submitBtn.value = 'Salva Timesheet';
            submitBtn.dataset.editMode = 'false';
            delete submitBtn.dataset.editRow;
            
        } else {
            throw new Error(data.error || 'Errore aggiornamento');
        }
        
    } catch (error) {
        console.error('Errore update timesheet:', error);
        alert('❌ Errore durante l\'aggiornamento del timesheet');
    } finally {
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = false;
        submitBtn.value = 'Salva Timesheet';
    }
}

// Aggancia l'handler al form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('timesheet-form');
    if (form) {
        form.addEventListener('submit', handleTimesheetSubmit);
    }
});
