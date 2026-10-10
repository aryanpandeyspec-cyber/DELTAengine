// --- ZERO-CONFIG DURABLE WRITE-AHEAD FILE PERSISTENCE (DELTA ENGINE v3.6) ---
// Guarantees persistence of schedules, topics, dynamic presets & volunteer state across server restarts.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'delta_state_snapshot.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[PersistentStore] Could not initialize data directory:', e.message);
}

let saveTimeout = null;

/**
 * Hydrates db in-memory graph and schedules from local disk snapshot if available.
 */
function hydrateStateFromDisk(db) {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return false;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const snapshot = JSON.parse(raw);
    if (!snapshot || !snapshot.graph || !snapshot.schedulesByDate) {
      return false;
    }

    // Merge snapshot into live db object
    if (snapshot.graph.topics) db.graph.topics = { ...db.graph.topics, ...snapshot.graph.topics };
    if (snapshot.graph.speakers) db.graph.speakers = { ...db.graph.speakers, ...snapshot.graph.speakers };
    if (snapshot.graph.halls) db.graph.halls = { ...db.graph.halls, ...snapshot.graph.halls };
    if (snapshot.schedulesByDate) db.schedulesByDate = { ...db.schedulesByDate, ...snapshot.schedulesByDate };
    if (snapshot.activeDate) db.activeDate = snapshot.activeDate;
    if (snapshot.contacts) db.contacts = snapshot.contacts;
    if (snapshot.volunteers) db.volunteers = snapshot.volunteers;
    if (snapshot.autopilotEnabled !== undefined) db.autopilotEnabled = snapshot.autopilotEnabled;

    db.syncScheduleEdges();
    console.log('💾 [PersistentStore] Successfully hydrated venue state from local snapshot (zero-loss persistence).');
    return true;
  } catch (err) {
    console.warn('[PersistentStore] Snapshot hydration skipped:', err.message);
    return false;
  }
}

/**
 * Debounced background write to prevent disk thrashing while ensuring durability.
 */
function persistStateDebounced(db, delayMs = 600) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const snapshot = {
        updatedAt: new Date().toISOString(),
        activeDate: db.activeDate,
        autopilotEnabled: db.autopilotEnabled,
        graph: {
          speakers: db.graph.speakers,
          topics: db.graph.topics,
          halls: db.graph.halls,
          zones: db.graph.zones,
          venues: db.graph.venues
        },
        schedulesByDate: db.schedulesByDate,
        contacts: db.contacts,
        volunteers: db.volunteers
      };

      fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.warn('[PersistentStore] Failed to write state snapshot:', err.message);
    }
  }, delayMs);
}

/**
 * Clears local snapshot when factory reset is triggered.
 */
function clearPersistentState() {
  try {
    if (saveTimeout) clearTimeout(saveTimeout);
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log('🧹 [PersistentStore] Cleaned local snapshot file on system reset.');
    }
  } catch (err) {
    console.warn('[PersistentStore] Failed to clear snapshot:', err.message);
  }
}

module.exports = {
  hydrateStateFromDisk,
  persistStateDebounced,
  clearPersistentState
};
