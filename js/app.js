import { calculateSquareFeet, formatSquareFeet, getWardrobeTotals } from './calculator.js';
import { convertInchesToDecimal } from './conversion.js';
import {
  deleteCalculation,
  duplicateCalculation,
  generateCalculationId,
  generateWardrobeId,
  isValidStoredCalculation,
  loadAllSavedCalculations,
  loadCalculationById,
  loadSettings,
  replaceAllCalculations,
  saveCalculation,
  saveSettings,
  updateSavedCalculation,
} from './storage.js';

const state = {
  currentCalculationId: null,
  isDirty: false,
  displayPrecision: 4,
};

const navButtons = document.querySelectorAll('.nav-button, .action-card');
const views = document.querySelectorAll('.view');

function formatDisplayValue(value) {
  return formatSquareFeet(value, state.displayPrecision);
}

function getCurrentViewName() {
  return document.querySelector('.view.active')?.id || 'dashboard';
}

function showStatus(message, type = 'success') {
  const statusElement = document.getElementById('save-status');
  if (!statusElement) {
    return;
  }

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = '';
    statusElement.classList.remove('error');
    return;
  }

  statusElement.textContent = message;
  statusElement.hidden = false;
  statusElement.classList.toggle('error', type === 'error');
}

function showView(viewName) {
  const currentViewName = getCurrentViewName();

  if (viewName !== currentViewName && currentViewName === 'new-calculation' && state.isDirty) {
    const shouldLeave = window.confirm('You have unsaved changes. Leave without saving?');
    if (!shouldLeave) {
      return;
    }
  }

  views.forEach((view) => {
    const isActive = view.id === viewName;
    view.classList.toggle('active', isActive);
    view.hidden = !isActive;
  });

  navButtons.forEach((button) => {
    const isActiveButton = button.dataset.view === viewName;
    button.classList.toggle('active', isActiveButton);
    if (button.classList.contains('nav-button')) {
      button.setAttribute('aria-selected', String(isActiveButton));
    }
  });

  if (viewName === 'history') {
    renderHistory();
  }
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetView = button.dataset.view;
    if (!targetView) {
      return;
    }

    if (targetView === 'new-calculation') {
      const didStartFresh = startNewCalculation();
      if (!didStartFresh) {
        return;
      }
    }

    showView(targetView);
  });
});

function setValidationMessage(input, message) {
  const inputGroup = input.closest('.input-stack');
  const errorElement = inputGroup ? inputGroup.querySelector('.validation-message') : null;

  if (!errorElement) {
    return;
  }

  errorElement.textContent = message || '';
  errorElement.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  input.classList.toggle('is-invalid', Boolean(message));
}

function clearValidationMessage(input) {
  setValidationMessage(input, '');
}

function updateRowValues(row) {
  const heightInput = row.querySelector('[data-role="height"]');
  const widthInput = row.querySelector('[data-role="width"]');
  const resultCell = row.querySelector('.result-placeholder');

  if (!heightInput || !widthInput || !resultCell) {
    return;
  }

  const heightText = heightInput.value.trim();
  const widthText = widthInput.value.trim();

  const heightResult = convertInchesToDecimal(heightText);
  const widthResult = convertInchesToDecimal(widthText);

  if (heightText === '') {
    setValidationMessage(heightInput, 'Height is required.');
  } else if (!heightResult.valid) {
    setValidationMessage(heightInput, heightResult.message);
  } else {
    clearValidationMessage(heightInput);
  }

  if (widthText === '') {
    setValidationMessage(widthInput, 'Width is required.');
  } else if (!widthResult.valid) {
    setValidationMessage(widthInput, widthResult.message);
  } else {
    clearValidationMessage(widthInput);
  }

  if (heightText === '' || widthText === '' || !heightResult.valid || !widthResult.valid) {
    resultCell.textContent = '—';
    return;
  }

  const calculation = calculateSquareFeet(heightText, widthText);
  if (!calculation.valid) {
    resultCell.textContent = '—';
    return;
  }

  resultCell.textContent = formatDisplayValue(calculation.area);
}

function updateAllRowValues() {
  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return;
  }

  tableBody.querySelectorAll('tr').forEach((row) => updateRowValues(row));
}

function updateSummaryTotals() {
  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return;
  }

  const rows = Array.from(tableBody.querySelectorAll('tr'));
  const totals = getWardrobeTotals(rows);

  const summaryAll = document.getElementById('summary-all');
  const summaryIncluded = document.getElementById('summary-included');
  const summaryExcluded = document.getElementById('summary-excluded');

  if (summaryAll) summaryAll.textContent = formatDisplayValue(totals.all);
  if (summaryIncluded) summaryIncluded.textContent = formatDisplayValue(totals.included);
  if (summaryExcluded) summaryExcluded.textContent = formatDisplayValue(totals.excluded);
}

function updateDashboardSummary() {
  const calculations = loadAllSavedCalculations();
  const totalWardrobes = calculations.reduce((total, calculation) => total + calculation.rows.length, 0);

  const savedCount = document.getElementById('savedCalculationsCount');
  const wardrobeEntries = document.getElementById('wardrobeEntriesCount');

  if (savedCount) {
    savedCount.textContent = String(calculations.length);
  }

  if (wardrobeEntries) {
    wardrobeEntries.textContent = String(totalWardrobes);
  }
}

function createWardrobeRow(rowData = {}) {
  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return null;
  }

  const rowNumber = tableBody.querySelectorAll('tr').length + 1;
  const row = document.createElement('tr');
  const wardrobeId = rowData.id || generateWardrobeId();

  row.dataset.rowId = wardrobeId;
  row.innerHTML = `
    <td class="row-number">${rowNumber}</td>
    <td>
      <div class="input-stack">
        <input class="dimension-input" data-role="height" type="number" min="0" step="0.1" aria-label="Height for wardrobe ${rowNumber}" placeholder="72" />
        <div class="validation-message" aria-live="polite" hidden></div>
      </div>
    </td>
    <td>
      <div class="input-stack">
        <input class="dimension-input" data-role="width" type="number" min="0" step="0.1" aria-label="Width for wardrobe ${rowNumber}" placeholder="36" />
        <div class="validation-message" aria-live="polite" hidden></div>
      </div>
    </td>
    <td class="result-cell"><span class="result-placeholder">—</span></td>
    <td class="include-cell">
      <input type="checkbox" checked aria-label="Include wardrobe ${rowNumber}" />
    </td>
    <td class="action-cell">
      <button class="delete-row-button" type="button" aria-label="Delete wardrobe ${rowNumber}">Delete</button>
    </td>
  `;

  const heightInput = row.querySelector('[data-role="height"]');
  const widthInput = row.querySelector('[data-role="width"]');
  const includeCheckbox = row.querySelector('input[type="checkbox"]');

  if (heightInput) {
    heightInput.value = rowData.height || '';
  }

  if (widthInput) {
    widthInput.value = rowData.width || '';
  }

  if (includeCheckbox) {
    includeCheckbox.checked = rowData.included !== false;
  }

  tableBody.appendChild(row);
  updateAllRowValues();
  updateSummaryTotals();
  return row;
}

function updateRowNumbers() {
  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return;
  }

  const rows = tableBody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const rowNumberCell = row.querySelector('.row-number');
    if (rowNumberCell) {
      rowNumberCell.textContent = String(index + 1);
    }

    const heightInput = row.querySelector('[data-role="height"]');
    const widthInput = row.querySelector('[data-role="width"]');
    const includeCheckbox = row.querySelector('input[type="checkbox"]');

    if (heightInput) {
      heightInput.setAttribute('aria-label', `Height for wardrobe ${index + 1}`);
    }

    if (widthInput) {
      widthInput.setAttribute('aria-label', `Width for wardrobe ${index + 1}`);
    }

    if (includeCheckbox) {
      includeCheckbox.setAttribute('aria-label', `Include wardrobe ${index + 1}`);
    }

    const deleteButton = row.querySelector('.delete-row-button');
    if (deleteButton) {
      deleteButton.setAttribute('aria-label', `Delete wardrobe ${index + 1}`);
    }
  });
}

function getCurrentCalculationFromForm() {
  const nameInput = document.getElementById('calculation-name');
  const tableBody = document.getElementById('wardrobe-table-body');

  let calculationName = nameInput?.value.trim() || '';
  if (!calculationName) {
    const promptedName = window.prompt('Enter a calculation name', 'Untitled Calculation');
    calculationName = promptedName ? promptedName.trim() : 'Untitled Calculation';
  }

  const rows = Array.from(tableBody?.querySelectorAll('tr') || []).map((row) => {
    const heightInput = row.querySelector('[data-role="height"]');
    const widthInput = row.querySelector('[data-role="width"]');
    const includeCheckbox = row.querySelector('input[type="checkbox"]');

    return {
      id: row.dataset.rowId || generateWardrobeId(),
      height: heightInput ? heightInput.value.trim() : '',
      width: widthInput ? widthInput.value.trim() : '',
      included: includeCheckbox ? includeCheckbox.checked : true,
    };
  });

  const currentCalculation = state.currentCalculationId ? loadCalculationById(state.currentCalculationId) : null;

  return {
    id: state.currentCalculationId || generateCalculationId(),
    name: calculationName,
    rows,
    createdAt: currentCalculation?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function startNewCalculation() {
  if (getCurrentViewName() === 'new-calculation' && state.isDirty) {
    const shouldLeave = window.confirm('You have unsaved changes. Leave without saving?');
    if (!shouldLeave) {
      return false;
    }
  }

  const nameInput = document.getElementById('calculation-name');
  const tableBody = document.getElementById('wardrobe-table-body');

  if (nameInput) {
    nameInput.value = '';
  }

  if (tableBody) {
    tableBody.innerHTML = '';
    createWardrobeRow();
    createWardrobeRow();
    updateRowNumbers();
  }

  state.currentCalculationId = null;
  state.isDirty = false;
  updateSummaryTotals();
  showStatus('', 'success');
  return true;
}

function resetNewCalculationForm() {
  const nameInput = document.getElementById('calculation-name');
  if (nameInput) {
    nameInput.value = '';
  }

  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';
  createWardrobeRow();
  createWardrobeRow();
  state.currentCalculationId = null;
  state.isDirty = false;
  updateRowNumbers();
  updateSummaryTotals();
  showStatus('', 'success');
}

function populateCalculationIntoForm(calculation) {
  const nameInput = document.getElementById('calculation-name');
  const tableBody = document.getElementById('wardrobe-table-body');

  if (!nameInput || !tableBody) {
    return;
  }

  nameInput.value = calculation.name || 'Untitled Calculation';
  tableBody.innerHTML = '';

  if (!Array.isArray(calculation.rows) || calculation.rows.length === 0) {
    createWardrobeRow();
  } else {
    calculation.rows.forEach((row) => createWardrobeRow(row));
  }

  state.currentCalculationId = calculation.id;
  state.isDirty = false;
  updateRowNumbers();
  updateSummaryTotals();
  showStatus('', 'success');
}

function saveCurrentCalculation() {
  const calculation = getCurrentCalculationFromForm();

  try {
    const result = state.currentCalculationId ? updateSavedCalculation(calculation) : saveCalculation(calculation);
    state.currentCalculationId = result.id;
    state.isDirty = false;
    showStatus(`Saved "${result.name}" successfully.`, 'success');
    updateDashboardSummary();
    renderHistory();
  } catch (error) {
    console.error('Failed to save calculation:', error);
    showStatus(error instanceof Error ? error.message : 'Saving failed. Please try again.', 'error');
  }
}

function openSavedCalculation(id) {
  const calculation = loadCalculationById(id);
  if (!calculation) {
    showStatus('The selected calculation could not be found.', 'error');
    return;
  }

  populateCalculationIntoForm(calculation);
  showView('new-calculation');
  showStatus(`Opened "${calculation.name}".`, 'success');
}

function renameCalculation(id) {
  const calculation = loadCalculationById(id);
  if (!calculation) {
    showStatus('The selected calculation could not be renamed.', 'error');
    return;
  }

  const nextName = window.prompt('Rename calculation', calculation.name || 'Untitled Calculation');
  if (nextName === null) {
    return;
  }

  const trimmedName = nextName.trim();
  if (!trimmedName) {
    showStatus('A calculation name cannot be empty.', 'error');
    return;
  }

  const updatedCalculation = {
    ...calculation,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = updateSavedCalculation(updatedCalculation);

    if (state.currentCalculationId === id) {
      const nameInput = document.getElementById('calculation-name');
      if (nameInput) {
        nameInput.value = trimmedName;
      }
    }

    renderHistory();
    updateDashboardSummary();
    showStatus(`Renamed to "${saved.name}".`, 'success');
  } catch (error) {
    console.error('Could not rename calculation:', error);
    showStatus('The calculation could not be renamed.', 'error');
  }
}

function duplicateAndSave(id) {
  try {
    const duplicated = duplicateCalculation(id);
    if (!duplicated) {
      showStatus('The calculation could not be duplicated.', 'error');
      return;
    }

    renderHistory();
    updateDashboardSummary();
    showStatus(`Duplicated "${duplicated.name}".`, 'success');
  } catch (error) {
    console.error('Duplicate failed:', error);
    showStatus('The calculation could not be duplicated.', 'error');
  }
}

function confirmDeleteCalculation(id) {
  const calculation = loadCalculationById(id);
  if (!calculation) {
    showStatus('That calculation could not be found for deletion.', 'error');
    return;
  }

  const shouldDelete = window.confirm(`Delete "${calculation.name}"? This action cannot be undone.`);
  if (!shouldDelete) {
    return;
  }

  try {
    const didDelete = deleteCalculation(id);
    if (!didDelete) {
      throw new Error('Storage could not delete the record.');
    }

    if (state.currentCalculationId === id) {
      resetNewCalculationForm();
    }

    renderHistory();
    updateDashboardSummary();
    showStatus(`Deleted "${calculation.name}".`, 'success');
  } catch (error) {
    console.error('Delete failed:', error);
    showStatus('The calculation could not be deleted.', 'error');
  }
}

function renderHistory() {
  const historyList = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');

  if (!historyList || !searchInput) {
    return;
  }

  const filterText = searchInput.value.trim().toLowerCase();
  const calculations = loadAllSavedCalculations();
  const filteredCalculations = calculations.filter((calculation) => {
    return calculation.name.toLowerCase().includes(filterText);
  });

  if (!filteredCalculations.length) {
    historyList.innerHTML = '<div class="empty-state">No matching calculations were found.</div>';
    return;
  }

  historyList.innerHTML = filteredCalculations
    .map((calculation) => {
      let includedTotal = 0;
      let allTotal = 0;

      calculation.rows.forEach((row) => {
        if (!row || typeof row.height !== 'string' || typeof row.width !== 'string') {
          return;
        }

        const heightText = row.height.trim();
        const widthText = row.width.trim();
        if (heightText === '' || widthText === '') {
          return;
        }

        const result = calculateSquareFeet(heightText, widthText);
        if (!result.valid) {
          return;
        }

        allTotal += result.area;
        if (row.included !== false) {
          includedTotal += result.area;
        }
      });

      const updatedAt = new Date(calculation.updatedAt || calculation.createdAt).toLocaleString();
      return `
        <article class="history-card">
          <div class="history-card-row">
            <div>
              <h3>${calculation.name}</h3>
              <p class="history-meta">Updated: ${updatedAt}</p>
              <p class="history-meta">Wardrobes: ${calculation.rows.length}</p>
            </div>
            <span class="pill">${formatDisplayValue(includedTotal)} sq ft</span>
          </div>
          <div class="history-card-actions">
            <button type="button" data-action="open" data-id="${calculation.id}">Open</button>
            <button type="button" data-action="rename" data-id="${calculation.id}">Rename</button>
            <button type="button" data-action="duplicate" data-id="${calculation.id}">Duplicate</button>
            <button type="button" data-action="delete" class="danger" data-id="${calculation.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function validateImportedBackup(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { valid: false, message: 'No valid calculation records were found in the backup file.' };
  }

  for (const record of records) {
    if (!isValidStoredCalculation(record)) {
      return { valid: false, message: 'The backup file contains malformed or invalid calculation data.' };
    }
  }

  return { valid: true, message: '' };
}

function importBackupFile(file) {
  if (!file) {
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = () => {
    try {
      const parsed = JSON.parse(String(fileReader.result || ''));
      const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.calculations) ? parsed.calculations : [];
      const validation = validateImportedBackup(records);
      if (!validation.valid) {
        showStatus(validation.message, 'error');
        return;
      }

      const shouldReplace = window.confirm('Choose OK to replace all saved calculations, or Cancel to merge imported data into the existing list.');
      const existing = loadAllSavedCalculations();
      const mergedRecords = shouldReplace
        ? records
        : [...existing, ...records].filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index);

      try {
        replaceAllCalculations(mergedRecords);
        updateDashboardSummary();
        renderHistory();
        showStatus(shouldReplace ? 'Backup replaced the saved calculations.' : 'Backup merged with the existing calculations.', 'success');
      } catch (error) {
        console.error('Import failed:', error);
        showStatus('The backup file could not be imported because storage is unavailable.', 'error');
      }
    } catch (error) {
      console.error('Invalid backup JSON:', error);
      showStatus('The backup file is not valid JSON.', 'error');
    }
  };

  fileReader.onerror = () => {
    showStatus('The backup file could not be read.', 'error');
  };

  fileReader.readAsText(file);
}

function exportBackupFile() {
  const calculations = loadAllSavedCalculations();
  const payload = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    calculations,
  };

  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const downloadLink = document.createElement('a');
  const objectUrl = URL.createObjectURL(jsonBlob);

  downloadLink.href = objectUrl;
  downloadLink.download = 'samir-wardrobe-calculator-backup.json';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(objectUrl);

  showStatus('Backup exported successfully.', 'success');
}

function clearAllSavedCalculations() {
  const shouldClear = window.confirm('Clear all saved calculations? This action cannot be undone.');
  if (!shouldClear) {
    return;
  }

  try {
    replaceAllCalculations([]);
    state.currentCalculationId = null;
    resetNewCalculationForm();
    renderHistory();
    updateDashboardSummary();
    showStatus('All saved calculations were cleared.', 'success');
  } catch (error) {
    console.error('Clear all failed:', error);
    showStatus('The stored calculations could not be cleared.', 'error');
  }
}

function initializeSettings() {
  const settings = loadSettings();
  state.displayPrecision = settings.displayPrecision;
  const precisionSelect = document.getElementById('display-precision');

  if (precisionSelect) {
    precisionSelect.value = String(state.displayPrecision);
  }
}

function initializeTable() {
  const tableBody = document.getElementById('wardrobe-table-body');
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';
  createWardrobeRow();
  createWardrobeRow();
  updateRowNumbers();
  updateSummaryTotals();
}

function bindFormEvents() {
  const addWardrobeButton = document.getElementById('add-wardrobe-button');
  const saveButton = document.getElementById('save-calculation-button');
  const tableBody = document.getElementById('wardrobe-table-body');
  const nameInput = document.getElementById('calculation-name');
  const searchInput = document.getElementById('history-search');
  const precisionSelect = document.getElementById('display-precision');
  const exportButton = document.getElementById('export-backup-button');
  const importButton = document.getElementById('import-backup-button');
  const importInput = document.getElementById('import-backup-input');
  const clearButton = document.getElementById('clear-all-calculations-button');
  const historyList = document.getElementById('history-list');

  if (addWardrobeButton) {
    addWardrobeButton.addEventListener('click', () => {
      createWardrobeRow();
      state.isDirty = true;
      updateRowNumbers();
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', saveCurrentCalculation);
  }

  if (tableBody) {
    tableBody.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.matches('input[type="checkbox"]')) {
        state.isDirty = true;
        updateSummaryTotals();
        return;
      }

      if (target.matches('[data-role="height"], [data-role="width"]')) {
        state.isDirty = true;
        const row = target.closest('tr');
        if (row) {
          updateRowValues(row);
        }
        updateSummaryTotals();
      }
    });

    tableBody.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('.delete-row-button');
      if (!deleteButton) {
        return;
      }

      const row = deleteButton.closest('tr');
      if (!row) {
        return;
      }

      row.remove();
      state.isDirty = true;

      if (tableBody.querySelectorAll('tr').length === 0) {
        createWardrobeRow();
      }

      updateRowNumbers();
      updateSummaryTotals();
    });
  }

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      state.isDirty = true;
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderHistory);
  }

  if (historyList) {
    historyList.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target || !target.dataset.action) {
        return;
      }

      const id = target.dataset.id;
      if (!id) {
        return;
      }

      switch (target.dataset.action) {
        case 'open':
          openSavedCalculation(id);
          break;
        case 'rename':
          renameCalculation(id);
          break;
        case 'duplicate':
          duplicateAndSave(id);
          break;
        case 'delete':
          confirmDeleteCalculation(id);
          break;
        default:
          break;
      }
    });
  }

  if (precisionSelect) {
    precisionSelect.addEventListener('change', (event) => {
      const value = Number(event.target.value);
      state.displayPrecision = Number.isInteger(value) && value >= 2 && value <= 4 ? value : 4;
      try {
        saveSettings({ displayPrecision: state.displayPrecision });
        updateSummaryTotals();
        renderHistory();
        showStatus(`Display precision set to ${state.displayPrecision} decimal places.`, 'success');
      } catch (error) {
        console.error('Failed to save display precision:', error);
        showStatus('Could not update display precision.', 'error');
      }
    });
  }

  if (exportButton) {
    exportButton.addEventListener('click', exportBackupFile);
  }

  if (importButton && importInput) {
    importButton.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      if (file) {
        importBackupFile(file);
        event.target.value = '';
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', clearAllSavedCalculations);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

initializeSettings();
initializeTable();
bindFormEvents();
updateDashboardSummary();
renderHistory();
showStatus('', 'success');
