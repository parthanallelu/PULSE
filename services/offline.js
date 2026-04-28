import { analyzeIncident } from "./gemini.js";
import { db, storage, collection, addDoc, ref, uploadString, getDownloadURL } from "./firebase.js";

const OFFLINE_KEY = "pulse_offline_queue";

export function getOfflineReports() {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineReport(report) {
  const queue = getOfflineReports();
  queue.push(report);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
}

export async function syncOfflineReports() {
  if (!navigator.onLine) return;

  const queue = getOfflineReports();
  if (queue.length === 0) return;

  console.log(`Syncing ${queue.length} offline reports...`);
  
  const remaining = [];

  for (const report of queue) {
    try {
      let imageURL = null;

      // 1. Upload image if present
      if (report.image) {
        try {
          const storageRef = ref(storage, `incidents/${report.id}`);
          const snapshot = await uploadString(storageRef, report.image, 'data_url');
          imageURL = await getDownloadURL(snapshot.ref);
        } catch (imgError) {
          console.error(`Failed to upload image for ${report.id}:`, imgError);
        }
      }

      // 2. Call Gemini for analysis
      const analysis = await analyzeIncident(report.description, report.image);

      // 3. Persist to Firestore
      await addDoc(collection(db, "reports"), {
        id: report.id,
        description: report.description,
        location: report.location,
        incidentType: analysis.incidentType || report.type,
        timestamp: report.timestamp,
        status: 'synced',
        imageURL: imageURL,
        severity: analysis.severity,
        urgencyScore: analysis.urgencyScore,
        summary: analysis.summary
      });

      console.log(`Successfully synced report ${report.id}`);
    } catch (error) {
      console.error(`Failed to sync report ${report.id}:`, error);
      // Keep in queue for next attempt
      remaining.push(report);
    }
  }

  localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
}

// Attach automatic listener
window.addEventListener('online', syncOfflineReports);
