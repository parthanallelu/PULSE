/**
 * ═══════════════════════════════════════════════════════════════════
 * PULSE — Community Crisis Intelligence Network
 * Application Logic
 *
 * Core Flow:
 *   Citizen → Offline Storage → Peer Relay (Simulated) → Sync
 *
 * State Machine per Report:
 *   OFFLINE_CAPTURED  →  RELAYED  →  SYNCED
 *   (Grey)               (Orange)    (Green)
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────
// DATA STORE — localStorage-backed
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pulse_reports';

/** Load reports from localStorage */
function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist reports to localStorage */
function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/** Generate a unique report ID like PLS-a1b2c3 */
function generateId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return 'PLS-' + id;
}

/** Emoji map for incident types */
const TYPE_META = {
  fire:     { emoji: '🔥', label: 'Fire' },
  flood:    { emoji: '🌊', label: 'Flood' },
  collapse: { emoji: '🏚️', label: 'Collapse' },
  medical:  { emoji: '🏥', label: 'Medical' },
  conflict: { emoji: '⚠️',  label: 'Conflict' },
  other:    { emoji: '📋', label: 'Other' },
};

/** Human-readable status labels & CSS class names */
const STATUS_META = {
  OFFLINE_CAPTURED: { label: 'Stored Locally (No Network)',    css: 'offline_captured' },
  RELAYED:          { label: 'Relayed via Nearby Device',      css: 'relayed' },
  SYNCED:           { label: 'Synced to Command Center',       css: 'synced' },
};

// ─────────────────────────────────────────────────────────────────
// RELATIVE TIMESTAMP HELPER
// ─────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 5)   return 'just now';
  if (seconds < 60)  return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return minutes + ' min ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

// ─────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────

function showToast(type, message) {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check_circle', warning: 'warning_amber', info: 'info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-icons-round">${icons[type] || 'info'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out .3s var(--ease) forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initTypeSelector();
  initCharCounter();
  initLocationButton();
  initImageUpload();
  initFormSubmit();
  initConnectivityToggle();
  renderReportList();
  updateBadge();

  initRelaySimulation();

  // Refresh relative timestamps every 30s
  setInterval(() => renderReportList(), 30000);
});

// ─────────────────────────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────────────────────────

function initAuth() {
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.classList.add('active-form');
    regForm.classList.remove('active-form');
  });

  regTab.addEventListener('click', () => {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.classList.add('active-form');
    loginForm.classList.remove('active-form');
  });

  const handleAuth = (e) => {
    e.preventDefault();
    document.getElementById('auth-shell').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    showToast('success', 'Authentication successful');
  };

  loginForm.addEventListener('submit', handleAuth);
  regForm.addEventListener('submit', handleAuth);
}

// ─────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${target}`).classList.add('active');

      // Re-render when switching to feed so timestamps update
      if (target === 'feed') renderReportList();
      if (target === 'dashboard') renderDashboard();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// INCIDENT TYPE SELECTOR
// ─────────────────────────────────────────────────────────────────

let selectedType = '';

function initTypeSelector() {
  const chips = document.querySelectorAll('.type-chip');
  const hidden = document.getElementById('incident-type');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedType = chip.dataset.type;
      hidden.value = selectedType;
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// CHARACTER COUNTER
// ─────────────────────────────────────────────────────────────────

function initCharCounter() {
  const textarea = document.getElementById('description');
  const counter = document.getElementById('char-counter');

  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
  });
}

// ─────────────────────────────────────────────────────────────────
// LOCATION AUTO-DETECT (Simulated with real API fallback)
// ─────────────────────────────────────────────────────────────────

function initLocationButton() {
  const btn = document.getElementById('btn-locate');
  const input = document.getElementById('location');
  const geoTag = document.getElementById('geo-tag');
  const geoText = document.getElementById('geo-tag-text');

  btn.addEventListener('click', () => {
    // Try real geolocation first; fall back to simulation
    if ('geolocation' in navigator) {
      btn.querySelector('.material-icons-round').textContent = 'sync';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          input.value = `Lat ${lat}, Lng ${lng}`;
          geoTag.style.display = 'flex';
          geoText.textContent = `${lat}° N, ${lng}° E  ±${Math.round(pos.coords.accuracy)}m`;
          btn.querySelector('.material-icons-round').textContent = 'my_location';
          showToast('success', 'GPS location acquired');
        },
        () => simulateLocation(input, geoTag, geoText, btn),
        { timeout: 4000 }
      );
    } else {
      simulateLocation(input, geoTag, geoText, btn);
    }
  });
}

function simulateLocation(input, geoTag, geoText, btn) {
  const places = [
    { name: 'MG Road, Sector 14, Gurugram',    lat: 28.47940, lng: 77.08010 },
    { name: 'Connaught Place, New Delhi',       lat: 28.63040, lng: 77.21770 },
    { name: 'Koramangala, Bangalore',           lat: 12.93410, lng: 77.62440 },
    { name: 'Bandra West, Mumbai',              lat: 19.05960, lng: 72.83620 },
  ];
  const p = places[Math.floor(Math.random() * places.length)];
  input.value = p.name;
  geoTag.style.display = 'flex';
  geoText.textContent = `${p.lat.toFixed(5)}° N, ${p.lng.toFixed(5)}° E`;
  btn.querySelector('.material-icons-round').textContent = 'my_location';
  showToast('info', 'Simulated GPS fix acquired');
}

// ─────────────────────────────────────────────────────────────────
// IMAGE UPLOAD — stores as base64 data-URL in localStorage
// ─────────────────────────────────────────────────────────────────

let capturedImage = null;

function initImageUpload() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const preview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  const removeBtn = document.getElementById('preview-remove');

  zone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      capturedImage = e.target.result;
      previewImg.src = capturedImage;
      zone.style.display = 'none';
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    capturedImage = null;
    fileInput.value = '';
    preview.style.display = 'none';
    zone.style.display = 'flex';
  });
}

// ─────────────────────────────────────────────────────────────────
// CONNECTIVITY TOGGLE (Simulated)
// ─────────────────────────────────────────────────────────────────

let isOnline = false; // start offline for demo

function initConnectivityToggle() {
  const chip = document.getElementById('connectivity-chip');
  const icon = document.getElementById('connectivity-icon');
  const label = document.getElementById('connectivity-label');

  // Set initial state
  updateConnectivityUI(chip, icon, label);

  chip.addEventListener('click', () => {
    isOnline = !isOnline;
    updateConnectivityUI(chip, icon, label);

    if (isOnline) {
      showToast('success', 'Connection restored — syncing pending reports…');
      // Trigger sync for all offline or relayed reports
      syncAllPending();
    } else {
      showToast('warning', 'Network lost — switching to offline mesh mode');
    }
  });
}

function updateConnectivityUI(chip, icon, label) {
  if (isOnline) {
    chip.className = 'connectivity-chip online';
    icon.textContent = 'wifi';
    label.textContent = 'Online';
  } else {
    chip.className = 'connectivity-chip offline';
    icon.textContent = 'wifi_off';
    label.textContent = 'Offline';
  }
}

// ─────────────────────────────────────────────────────────────────
// FORM SUBMISSION (Section 2 — Offline-First)
// ─────────────────────────────────────────────────────────────────

function initFormSubmit() {
  const form = document.getElementById('report-form');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate type selection
    if (!selectedType) {
      showToast('warning', 'Please select an incident type');
      return;
    }

    const description = document.getElementById('description').value.trim();
    const location = document.getElementById('location').value.trim();

    if (!description || !location) {
      showToast('warning', 'Please fill in all required fields');
      return;
    }

    const allowRelay = document.getElementById('allow-peer-relay').checked;

    // Build structured JSON report (Section 2)
    const report = {
      id: generateId(),
      type: selectedType,
      description: description,
      location: location,
      image: capturedImage || null,
      allowRelay: allowRelay,
      timestamp: new Date().toISOString(),
      status: 'OFFLINE_CAPTURED',       // Initial state is always offline
      statusHistory: [
        { status: 'OFFLINE_CAPTURED', at: new Date().toISOString() }
      ]
    };

    // Save to localStorage
    const reports = loadReports();
    reports.unshift(report);
    saveReports(reports);

    showToast('success', `Report ${report.id} saved locally`);

    // Reset form
    form.reset();
    document.getElementById('char-counter').textContent = '0';
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
    selectedType = '';
    document.getElementById('incident-type').value = '';
    document.getElementById('allow-peer-relay').checked = true;
    capturedImage = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'flex';
    document.getElementById('geo-tag').style.display = 'none';

    updateBadge();
    renderReportList();
    updateRelayButtonState();

    // Lifecycle now controlled by Simulated Peer Relay button
    // simulateLifecycle(report.id);
  });
}

// ─────────────────────────────────────────────────────────────────
// LIFECYCLE STATE MACHINE (Section 3)
//
//   OFFLINE_CAPTURED  ──(5s)──▶  RELAYED  ──(8s)──▶  SYNCED
//
// Transitions are animated and visible. The delays simulate
// mesh relay propagation and server sync handshake.
// ─────────────────────────────────────────────────────────────────

function simulateLifecycle(reportId) {
  // Phase 1: After 5 seconds, transition to RELAYED
  setTimeout(() => {
    transitionReport(reportId, 'RELAYED', 'Relayed via mesh peer node');
  }, 5000);

  // Phase 2: After 13 seconds total, transition to SYNCED
  setTimeout(() => {
    transitionReport(reportId, 'SYNCED', 'Synced to command center');
  }, 13000);
}

function transitionReport(reportId, newStatus, toastMsg) {
  const reports = loadReports();
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  // Don't transition backwards
  const order = ['OFFLINE_CAPTURED', 'RELAYED', 'SYNCED'];
  if (order.indexOf(newStatus) <= order.indexOf(report.status)) return;

  report.status = newStatus;
  report.statusHistory.push({ status: newStatus, at: new Date().toISOString() });
  saveReports(reports);

  showToast(newStatus === 'SYNCED' ? 'success' : 'info', `${reportId}: ${toastMsg}`);
  renderReportList();
}

/** Sync all pending (offline/relayed) reports immediately */
function syncAllPending() {
  const reports = loadReports();
  let count = 0;

  reports.forEach(r => {
    if (r.status !== 'SYNCED') {
      r.status = 'SYNCED';
      r.statusHistory.push({ status: 'SYNCED', at: new Date().toISOString() });
      count++;
    }
  });

  if (count > 0) {
    saveReports(reports);
    renderReportList();
    showToast('success', `${count} report${count > 1 ? 's' : ''} synced to command center`);
  }
}

// ─────────────────────────────────────────────────────────────────
// RENDER REPORT LIST (Section 6)
// ─────────────────────────────────────────────────────────────────

function renderReportList() {
  const container = document.getElementById('report-list');
  const summary = document.getElementById('feed-summary');
  const reports = loadReports();

  if (reports.length === 0) {
    container.innerHTML = '';
    summary.textContent = 'No reports yet. Submit one from the Report tab.';
    return;
  }

  summary.textContent = `${reports.length} report${reports.length > 1 ? 's' : ''} captured.`;

  container.innerHTML = reports.map((r, i) => {
    const meta = TYPE_META[r.type] || TYPE_META.other;
    const sMeta = STATUS_META[r.status] || STATUS_META.OFFLINE_CAPTURED;

    return `
      <div class="report-card" style="animation-delay: ${i * 0.06}s">
        <div class="card-top-bar">
          <span class="card-type-tag">
            <span class="card-type-emoji">${meta.emoji}</span>
            ${meta.label}
          </span>
          <span class="status-badge ${sMeta.css}" title="${sMeta.label}">
            <span class="status-pip"></span>
            ${sMeta.label}
          </span>
        </div>
        <div class="card-content">
          <div class="card-location">
            <span class="material-icons-round">place</span>
            ${escapeHtml(r.location)}
          </div>
          <p class="card-desc">${escapeHtml(r.description)}</p>
          ${r.image ? `<div class="card-thumb"><img src="${r.image}" alt="Attached photo" /></div>` : ''}
          
          ${r.status === 'SYNCED' ? (() => {
            const ai = processWithGemini(r);
            return `
              <div class="gemini-insight">
                <div class="gemini-insight-header">
                  <span class="material-icons-round gemini-sparkle">psychology</span>
                  <span>Processed by Gemini Intelligence</span>
                </div>
                <div class="gemini-insight-body">
                  <div class="gemini-insight-row">
                    <span class="gemini-insight-label">Severity:</span>
                    <span class="gemini-insight-value ai-severity-${ai.severity.toLowerCase()}">${ai.severity}</span>
                  </div>
                  <div class="gemini-insight-row">
                    <span class="gemini-insight-label">Urgency:</span>
                    <span class="gemini-insight-value">${ai.urgency}/10</span>
                  </div>
                  ${ai.tags.length > 0 ? `
                  <div class="gemini-insight-row">
                    <span class="gemini-insight-label">Tags:</span>
                    <div class="gemini-insight-tags">
                      ${ai.tags.map(t => `<span class="gemini-tag">${t}</span>`).join('')}
                    </div>
                  </div>
                  ` : ''}
                  <div class="gemini-insight-summary">
                    "${ai.summary}"
                  </div>
                  ${ai.imageInsight ? `
                  <div class="gemini-insight-image">
                    <span class="material-icons-round">visibility</span>
                    <span>${ai.imageInsight}</span>
                  </div>
                  ` : ''}
                </div>
              </div>
            `;
          })() : ''}
        </div>
        <div class="card-footer">
          <span class="card-id">${r.id}</span>
          <span>${timeAgo(r.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');
  
  if (typeof updateRelayButtonState === 'function') {
    updateRelayButtonState();
  }
}

/** Prevent XSS in user-provided text */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────
// BADGE COUNT
// ─────────────────────────────────────────────────────────────────

function updateBadge() {
  const badge = document.getElementById('tab-badge');
  const reports = loadReports();
  const pending = reports.filter(r => r.status !== 'SYNCED').length;

  if (pending > 0) {
    badge.style.display = 'flex';
    badge.textContent = pending;
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────────
// SIMULATED PEER RELAY LAYER
// ─────────────────────────────────────────────────────────────────

function initRelaySimulation() {
  const btn = document.getElementById('btn-relay');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const reports = loadReports();
    const offlineReports = reports.filter(r => r.status === 'OFFLINE_CAPTURED' && r.allowRelay !== false);

    if (offlineReports.length === 0) return;

    // Start Simulation
    btn.classList.add('running');
    btn.disabled = true;

    const consoleEl = document.getElementById('relay-console');
    consoleEl.innerHTML = ''; // clear console

    addConsoleLine('Scanning for nearby devices...', 'info', true);

    // 500ms Delay to transition to RELAYED
    await sleep(500);

    offlineReports.forEach(r => {
      r.status = 'RELAYED';
      r.statusHistory.push({ status: 'RELAYED', at: new Date().toISOString() });
    });
    saveReports(reports);
    renderReportList();
    updateBadge();

    addConsoleLine('Connection established with peer node', 'ok');
    addConsoleLine('Transferring compressed emergency packet...', 'warn', true);

    // 1000ms Delay to transition to SYNCED
    await sleep(1000);

    const updatedReports = loadReports();
    updatedReports.forEach(r => {
      if (r.status === 'RELAYED') {
        r.status = 'SYNCED';
        r.statusHistory.push({ status: 'SYNCED', at: new Date().toISOString() });
      }
    });
    saveReports(updatedReports);
    renderReportList();
    updateBadge();

    addConsoleLine('Peer node connected to internet — syncing...', 'info', true);
    await sleep(500); // quick final touch for realism
    addConsoleLine('Upload successful', 'ok');

    btn.classList.remove('running');
    updateRelayButtonState();
    showToast('success', `${offlineReports.length} reports successfully relayed and synced.`);
  });

  updateRelayButtonState();
}

function updateRelayButtonState() {
  const btn = document.getElementById('btn-relay');
  if (!btn) return;

  const reports = loadReports();
  const relayableReports = reports.filter(r => r.status === 'OFFLINE_CAPTURED' && r.allowRelay !== false);
  const hasRelayable = relayableReports.length > 0;
  btn.disabled = !hasRelayable;

  const consoleEl = document.getElementById('relay-console');
  if (consoleEl && !btn.classList.contains('running')) {
    if (hasRelayable) {
      consoleEl.innerHTML = `
        <div class="relay-line relay-info">
          <span class="relay-prompt">$</span> ${relayableReports.length} offline report(s) ready for peer relay.
        </div>
      `;
    } else {
      consoleEl.innerHTML = `
        <div class="relay-line relay-muted">
          <span class="relay-prompt">$</span> Relay engine idle. Submit reports to enable relay simulation.
        </div>
      `;
    }
  }
}

function addConsoleLine(text, type = 'info', showSpinner = false) {
  const consoleEl = document.getElementById('relay-console');
  if (!consoleEl) return;

  // Remove active state from previous line
  const prevActive = consoleEl.querySelector('.relay-active');
  if (prevActive) prevActive.classList.remove('relay-active');

  const line = document.createElement('div');
  line.className = `relay-line relay-${type} relay-active`;

  let spinnerHtml = showSpinner ? '<span class="relay-spinner"></span>' : '';

  line.innerHTML = `<span class="relay-prompt">$</span> ${spinnerHtml} <span>${text}</span>`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────
// GEMINI INTELLIGENCE LAYER (AI Simulation)
// ─────────────────────────────────────────────────────────────────

function processWithGemini(report) {
  const text = (report.description || '').toLowerCase();
  const imageExists = !!report.image;

  // 1. Classification (Inferred Incident Type from text)
  let inferredType = report.type;
  if (!inferredType || inferredType === 'other') {
    if (text.includes('fire') || text.includes('smoke') || text.includes('burn')) inferredType = 'fire';
    else if (text.includes('water') || text.includes('flood') || text.includes('rising')) inferredType = 'flood';
    else if (text.includes('collapse') || text.includes('trapped') || text.includes('debris')) inferredType = 'collapse';
    else if (text.includes('injury') || text.includes('blood') || text.includes('hospital')) inferredType = 'medical';
    else if (text.includes('conflict') || text.includes('fight') || text.includes('weapon')) inferredType = 'conflict';
  }

  // 2. Severity Analysis
  let severity = 'Low';
  if (text.includes('fire') || text.includes('explosion') || text.includes('trapped') || text.includes('collapse')) {
    severity = 'High';
  } else if (text.includes('water') || text.includes('rising') || text.includes('injury') || text.includes('flood') || text.includes('broken')) {
    severity = 'Medium';
  }

  // 3. Urgency Score (1-10)
  let urgency = 3;
  if (severity === 'High') urgency = 8;
  else if (severity === 'Medium') urgency = 5;

  if (text.includes('people') || text.includes('person') || text.includes('trapped') || text.includes('someone') || text.includes('multiple')) {
    urgency = Math.min(10, urgency + 2);
  }

  // 4. Summarization (1-line structured summary)
  let summary = 'Situation requires standard field assessment and monitoring.';
  if (severity === 'High') {
    summary = 'Critical risk scenario with severe safety thresholds breached.';
  } else if (severity === 'Medium') {
    summary = 'Moderate-urgency condition requiring dispatch queues.';
  }

  if (text.includes('fire')) summary = 'Active fire outbreak requiring swift deployment of firefighting assets.';
  if (text.includes('collapse')) summary = 'Structural failure reported. Urban Search & Rescue support recommended.';
  if (text.includes('flood')) summary = 'Rising water level thresholds. Water rescue teams to remain on standby.';

  // 5. Key Signal Extraction
  const tags = [];
  if (text.includes('fire') || text.includes('smoke')) tags.push('Fire');
  if (text.includes('collapse') || text.includes('crush')) tags.push('Collapse');
  if (text.includes('flood') || text.includes('water')) tags.push('Flood');
  if (text.includes('injury') || text.includes('bleed') || text.includes('blood')) tags.push('Injury');
  if (text.includes('trapped') || text.includes('stuck')) tags.push('Trapped');
  if (text.includes('people') || text.includes('children') || text.includes('family')) tags.push('Civilians');

  // 6. Optional Image Interpretation
  let imageInsight = '';
  if (imageExists) {
    imageInsight = 'Visual signal detected: high confidence of structural or fire damage.';
  }

  return {
    inferredType,
    severity,
    urgency,
    summary,
    tags,
    imageInsight
  };
}

// ─────────────────────────────────────────────────────────────────
// RESPONDER COMMAND DASHBOARD (Section 7)
// ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  const reports = loadReports();
  const syncedReports = reports.filter(r => r.status === 'SYNCED');

  // Compute stats
  const criticalCount = syncedReports.filter(r => {
    const ai = processWithGemini(r);
    return ai.severity === 'High';
  }).length;

  document.getElementById('dash-critical-count').textContent = criticalCount;
  document.getElementById('dash-synced-count').textContent = syncedReports.length;
  
  const now = new Date();
  document.getElementById('dash-last-update').textContent = 
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  // Sort by urgency score descending
  const processedReports = syncedReports.map(r => {
    return {
      ...r,
      ai: processWithGemini(r)
    };
  }).sort((a, b) => b.ai.urgency - a.ai.urgency);

  // Render dispatch recommendation engine
  const dispatchContainer = document.getElementById('dispatch-feed-container');
  const topHigh = processedReports.filter(r => r.ai.severity === 'High').slice(0, 2);

  if (topHigh.length === 0) {
    dispatchContainer.innerHTML = `
      <div class="relay-line relay-muted" style="padding: 10px; font-family: var(--font-mono); font-size: .75rem;">
        No critical high-priority incidents in queue. Command idle.
      </div>
    `;
  } else {
    dispatchContainer.innerHTML = topHigh.map((r, index) => {
      let advice = 'Recommended Response: Standard Dispatch';
      const text = r.description.toLowerCase();
      
      if (text.includes('fire')) advice = 'Recommended Response: Fire + Rescue Unit';
      else if (text.includes('collapse') || text.includes('trapped')) advice = 'Recommended Response: Urban Search & Rescue';
      else if (text.includes('flood') || text.includes('water')) advice = 'Recommended Response: Swift Water Team';

      return `
        <div class="dispatch-card">
          <div class="dispatch-title">
            <span class="material-icons-round">notification_important</span>
            Priority ${index + 1}: ${TYPE_META[r.type]?.label || 'Incident'} at ${escapeHtml(r.location)}
          </div>
          <div class="dispatch-body">
            ${escapeHtml(r.description)}
          </div>
          <div class="dispatch-recommendation">
            <span class="material-icons-round">bolt</span>
            <span>${advice}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render incident list
  const feedContainer = document.getElementById('dash-incident-feed');
  if (processedReports.length === 0) {
    feedContainer.innerHTML = `
      <p style="text-align: center; color: var(--text-3); font-size: .85rem; padding: 20px;">
        No synced situational intelligence data yet.
      </p>
    `;
    document.getElementById('simulated-map-grid').innerHTML = '';
    return;
  }

  feedContainer.innerHTML = processedReports.map(r => {
    return `
      <div class="dash-card">
        <div class="dash-card-header">
          <div class="dash-card-loc">
            <span class="material-icons-round">place</span>
            <span>${escapeHtml(r.location)}</span>
          </div>
          <div class="dash-card-badges">
            <span class="dash-card-badge ${r.ai.severity.toLowerCase()}">${r.ai.severity}</span>
            <span class="dash-card-score">Score: ${r.ai.urgency}/10</span>
          </div>
        </div>
        <div class="dash-card-body">
          "${r.ai.summary}"
        </div>
        <div class="dash-card-footer">
          <span class="dash-card-type">${TYPE_META[r.type]?.emoji || '📋'} ${TYPE_META[r.type]?.label || 'Other'}</span>
          <span>${timeAgo(r.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Drop Map Markers
  const mapGrid = document.getElementById('simulated-map-grid');
  mapGrid.innerHTML = processedReports.map(r => {
    // Generate deterministic coordinates
    let hash = 0;
    const locStr = r.location || 'default';
    for (let i = 0; i < locStr.length; i++) {
      hash = locStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const x = Math.abs(hash % 80) + 10; // offset edges
    const y = Math.abs((hash / 100) % 70) + 15;

    return `
      <div class="map-beacon severity-${r.ai.severity.toLowerCase()}" 
           style="top: ${y}%; left: ${x}%;" 
           title="${escapeHtml(r.location)}">
      </div>
    `;
  }).join('');
}
