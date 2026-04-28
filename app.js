import { 
  auth, db, storage,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged,
  collection, addDoc, onSnapshot, query, orderBy, ref, uploadString, getDownloadURL
} from "./services/firebase.js";
import { analyzeIncident } from "./services/gemini.js";
import { saveOfflineReport, getOfflineReports, syncOfflineReports } from "./services/offline.js";

// Global App State
let isOnline = navigator.onLine;
let selectedType = '';
let capturedImage = null;
let userRole = 'Citizen'; // 'Citizen' or 'Responder'

const TYPE_META = {
  fire:     { emoji: '🔥', label: 'Fire' },
  flood:    { emoji: '🌊', label: 'Flood' },
  collapse: { emoji: '🏚️', label: 'Collapse' },
  medical:  { emoji: '🏥', label: 'Medical' },
  conflict: { emoji: '⚠️',  label: 'Conflict' },
  other:    { emoji: '📋', label: 'Other' },
};

const STATUS_META = {
  offline: { label: 'Cached Offline',          css: 'offline_captured' },
  synced:  { label: 'Synced to Command Center', css: 'synced' },
};

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initTypeSelector();
  initCharCounter();
  initLocationButton();
  initImageUpload();
  initFormSubmit();
  initConnectivityToggle();
  setupLiveSync();
});

// ─────────────────────────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────────────────────────

function initAuth() {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const authShell = document.getElementById('auth-shell');
  const appShell = document.getElementById('app-shell');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authShell.style.display = 'none';
      appShell.style.display = 'flex';
      
      // Determine role based on email convention
      if (user.email && user.email.toLowerCase().endsWith('@pulse.gov')) {
        userRole = 'Responder';
      } else {
        userRole = 'Citizen';
      }

      applyRoleAccess();
      showToast('success', `Welcome back, Role: ${userRole}`);
      syncOfflineReports();
    } else {
      authShell.style.display = 'flex';
      appShell.style.display = 'none';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    try {
      await signInWithEmailAndPassword(auth, email.includes('@') ? email : `${email}@pulse.com`, password);
      showToast('success', 'Authentication successful');
    } catch (error) {
      showToast('warning', `Login Error: ${error.message}`);
    }
  });

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    
    try {
      await createUserWithEmailAndPassword(auth, email.includes('@') ? email : `${email}@pulse.com`, password);
      showToast('success', 'Account registered successfully');
    } catch (error) {
      showToast('warning', `Registration Error: ${error.message}`);
    }
  });
}

function applyRoleAccess() {
  const dashboardTab = document.getElementById('tab-dashboard');
  if (userRole === 'Citizen' && dashboardTab) {
    dashboardTab.style.display = 'none'; // Citizens cannot access operational command
  } else if (dashboardTab) {
    dashboardTab.style.display = 'flex';
  }
}

// ─────────────────────────────────────────────────────────────────
// UI HELPERS
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
    });
  });
}

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

function initCharCounter() {
  const textarea = document.getElementById('description');
  const counter = document.getElementById('char-counter');

  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
  });
}

function initLocationButton() {
  const btn = document.getElementById('btn-locate');
  const input = document.getElementById('location');
  const geoTag = document.getElementById('geo-tag');
  const geoText = document.getElementById('geo-tag-text');

  btn.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      btn.querySelector('.material-icons-round').textContent = 'sync';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          input.value = `Lat ${lat}, Lng ${lng}`;
          geoTag.style.display = 'flex';
          geoText.textContent = `${lat}° N, ${lng}° E`;
          btn.querySelector('.material-icons-round').textContent = 'my_location';
          showToast('success', 'GPS coordinates acquired');
        },
        () => simulateLocationFallback(input, geoTag, geoText, btn),
        { timeout: 4000 }
      );
    } else {
      simulateLocationFallback(input, geoTag, geoText, btn);
    }
  });
}

function simulateLocationFallback(input, geoTag, geoText, btn) {
  input.value = "Fallback Location: MG Road";
  geoTag.style.display = 'flex';
  geoText.textContent = "28.47940° N, 77.08010° E";
  btn.querySelector('.material-icons-round').textContent = 'my_location';
}

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

function initConnectivityToggle() {
  const chip = document.getElementById('connectivity-chip');
  const icon = document.getElementById('connectivity-icon');
  const label = document.getElementById('connectivity-label');

  window.addEventListener('online', () => {
    isOnline = true;
    chip.className = 'connectivity-chip online';
    icon.textContent = 'wifi';
    label.textContent = 'Online';
    showToast('success', 'Network available. Syncing data...');
    syncOfflineReports();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    chip.className = 'connectivity-chip offline';
    icon.textContent = 'wifi_off';
    label.textContent = 'Offline';
    showToast('warning', 'Network lost. Entering standalone mode.');
  });
}

// ─────────────────────────────────────────────────────────────────
// SUBMISSION LOGIC
// ─────────────────────────────────────────────────────────────────

function initFormSubmit() {
  const form = document.getElementById('report-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('description').value.trim();
    const location = document.getElementById('location').value.trim();

    if (!description || !location) {
      showToast('warning', 'Please fill in required inputs.');
      return;
    }

    const reportId = 'PLS-' + Date.now().toString(36).toUpperCase();
    const reportData = {
      id: reportId,
      description,
      location,
      timestamp: new Date().toISOString()
    };

    if (navigator.onLine) {
      showToast('info', 'Processing report with AI analysis...');
      try {
        let imageURL = null;
        if (capturedImage) {
          const storageRef = ref(storage, `incidents/${reportId}`);
          const snapshot = await uploadString(storageRef, capturedImage, 'data_url');
          imageURL = await getDownloadURL(snapshot.ref);
        }

        const analysis = await analyzeIncident(description, capturedImage);

        await addDoc(collection(db, "reports"), {
          ...reportData,
          incidentType: analysis.incidentType,
          status: 'synced',
          imageURL,
          severity: analysis.severity,
          urgencyScore: analysis.urgencyScore,
          summary: analysis.summary
        });

        showToast('success', `Live report ${reportId} dispatched.`);
      } catch (err) {
        showToast('warning', 'Direct dispatch failed. Queued locally.');
        saveOfflineReport({ ...reportData, image: capturedImage });
      }
    } else {
      showToast('info', 'Network offline. Saving to cache.');
      saveOfflineReport({ ...reportData, image: capturedImage });
    }

    // Reset Form
    form.reset();
    document.getElementById('char-counter').textContent = '0';
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
    selectedType = '';
    capturedImage = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'flex';
    document.getElementById('geo-tag').style.display = 'none';
    
    renderOfflineQueue();
  });
}

// ─────────────────────────────────────────────────────────────────
// REAL-TIME RENDERING
// ─────────────────────────────────────────────────────────────────

function setupLiveSync() {
  const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
  
  onSnapshot(q, (snapshot) => {
    const liveReports = [];
    snapshot.forEach(doc => liveReports.push(doc.data()));
    
    renderLiveFeed(liveReports);
    renderDashboard(liveReports);
  });
}

function renderLiveFeed(reports) {
  const container = document.getElementById('report-list');
  const offlineReports = getOfflineReports();
  
  const allReports = [...offlineReports.map(r => ({ ...r, status: 'offline', severity: 'Low', urgencyScore: 1, summary: 'Awaiting sync.' })), ...reports];
  
  if (allReports.length === 0) {
    container.innerHTML = `<p class="section-desc">No active emergency signals.</p>`;
    return;
  }

  container.innerHTML = allReports.map(r => {
    const meta = TYPE_META[r.incidentType] || TYPE_META.other;
    const badgeCss = r.status === 'offline' ? 'offline_captured' : 'synced';
    
    return `
      <div class="report-card">
        <div class="card-top-bar">
          <span class="card-type-tag">${meta.emoji} ${meta.label}</span>
          <span class="status-badge ${badgeCss}">${r.status === 'offline' ? 'Offline' : 'Live'}</span>
        </div>
        <div class="card-content">
          <p><strong>Location:</strong> ${escapeHtml(r.location)}</p>
          <p>${escapeHtml(r.description)}</p>
          ${r.imageURL ? `<div class="card-thumb"><img src="${r.imageURL}" alt="Telemetry Image"/></div>` : ''}
          ${r.summary ? `<div class="gemini-insight"><p><strong>AI Summary:</strong> ${escapeHtml(r.summary)}</p></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboard(reports) {
  const criticalEl = document.getElementById('dash-critical-count');
  const syncedEl = document.getElementById('dash-synced-count');
  const feedEl = document.getElementById('dash-incident-feed');
  
  if (!criticalEl || !feedEl) return;

  const critical = reports.filter(r => r.severity === 'High');
  criticalEl.textContent = critical.length;
  syncedEl.textContent = reports.length;

  const sorted = [...reports].sort((a, b) => b.urgencyScore - a.urgencyScore);

  feedEl.innerHTML = sorted.map(r => `
    <div class="report-card" style="border-left: 5px solid ${r.severity === 'High' ? '#ef4444' : r.severity === 'Medium' ? '#f59e0b' : '#10b981'}">
      <div class="card-top-bar">
        <span><strong>Urgency:</strong> ${r.urgencyScore}/10</span>
        <span class="status-badge synced">${r.severity} Priority</span>
      </div>
      <div class="card-content">
        <p><strong>Location:</strong> ${escapeHtml(r.location)}</p>
        <p>${escapeHtml(r.summary)}</p>
      </div>
    </div>
  `).join('');
}

function renderOfflineQueue() {
  renderLiveFeed([]);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(type, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
