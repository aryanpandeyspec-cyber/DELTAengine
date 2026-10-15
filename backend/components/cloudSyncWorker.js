// --- AUTONOMOUS OUTBOX CLOUD SYNC WORKER (DELTA ENGINE v3.7) ---
// Guarantees seamless synchronization between offline SQLite edge node and Supabase Cloud.
// If venue internet cuts out, telemetry queues in SQLite. When internet returns, it reconciles automatically.

const { supabase } = require('./supabaseDb');
const sqliteStore = require('./sqliteStore');

let syncInterval = null;
let isSyncing = false;
let lastSyncSuccess = null;
let lastSyncError = null;
let totalSyncedRecords = 0;

let lastSyncedTelemetryId = 0;
let lastSyncedPassageId = 0;
let cursorsLoaded = false;

/**
 * Initializes the background cloud outbox sync loop.
 */
function startCloudSyncWorker(intervalMs = 6000) {
  if (syncInterval) return;

  console.log(`☁️ [Cloud Sync Worker] Outbox worker initialized (Interval: ${intervalMs / 1000}s)`);

  syncInterval = setInterval(async () => {
    if (isSyncing || !supabase) return;
    isSyncing = true;

    try {
      const db = sqliteStore.initSqliteStore();
      if (!db) {
        isSyncing = false;
        return;
      }

      if (!cursorsLoaded) {
        lastSyncedTelemetryId = sqliteStore.getSyncCursor('telemetry') || 0;
        lastSyncedPassageId = sqliteStore.getSyncCursor('door_passage') || 0;
        cursorsLoaded = true;
      }

      // 1. Fetch un-synced telemetry ticks
      const unSyncedTelemetry = db.prepare(`
        SELECT id, hall_id, camera_id, people_detected, capacity, occupied_percent, status, source, created_at
        FROM sensor_telemetry
        WHERE id > ?
        ORDER BY id ASC
        LIMIT 25
      `).all(lastSyncedTelemetryId);

      if (unSyncedTelemetry && unSyncedTelemetry.length > 0) {
        // Attempt pushing batch to Supabase edge_telemetry_logs
        const rowsToInsert = unSyncedTelemetry.map(row => ({
          hall_id: row.hall_id,
          camera_id: row.camera_id,
          occupancy: row.people_detected,
          capacity: row.capacity,
          occupied_percent: row.occupied_percent,
          status: row.status,
          source: row.source,
          recorded_at: row.created_at
        }));

        const { error } = await supabase.from('edge_telemetry_logs').insert(rowsToInsert);

        if (!error) {
          const maxId = unSyncedTelemetry[unSyncedTelemetry.length - 1].id;
          lastSyncedTelemetryId = maxId;
          sqliteStore.setSyncCursor('telemetry', maxId);
          totalSyncedRecords += unSyncedTelemetry.length;
          lastSyncSuccess = new Date().toISOString();
          lastSyncError = null;
        } else {
          // If table doesn't exist yet in user's Supabase instance, record soft notice without crash
          lastSyncError = error.message;
        }
      }

      // 2. Fetch un-synced door passages
      const unSyncedPassages = db.prepare(`
        SELECT id, gate_id, direction, current_count, created_at
        FROM door_passages
        WHERE id > ?
        ORDER BY id ASC
        LIMIT 25
      `).all(lastSyncedPassageId);

      if (unSyncedPassages && unSyncedPassages.length > 0) {
        const passageRows = unSyncedPassages.map(p => ({
          gate_id: p.gate_id,
          direction: p.direction,
          occupancy: p.current_count,
          recorded_at: p.created_at
        }));

        const { error } = await supabase.from('edge_door_logs').insert(passageRows);
        if (!error) {
          const maxPassageId = unSyncedPassages[unSyncedPassages.length - 1].id;
          lastSyncedPassageId = maxPassageId;
          sqliteStore.setSyncCursor('door_passage', maxPassageId);
          totalSyncedRecords += unSyncedPassages.length;
          lastSyncSuccess = new Date().toISOString();
          lastSyncError = null;
        } else {
          lastSyncError = error.message;
        }
      }

    } catch (err) {
      lastSyncError = err.message;
    } finally {
      isSyncing = false;
    }
  }, intervalMs);
}

/**
 * Stops cloud sync loop on shutdown.
 */
function stopCloudSyncWorker() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('☁️ [Cloud Sync Worker] Outbox worker stopped cleanly.');
  }
}

/**
 * Returns diagnostic metrics for the Cloud Sync Engine.
 */
function getSyncMetrics() {
  return {
    engine: 'Outbox-SQLite-to-Supabase',
    enabled: !!supabase,
    isSyncing,
    lastSyncSuccess,
    lastSyncError,
    totalSyncedRecords,
    cursors: {
      telemetryId: lastSyncedTelemetryId,
      passageId: lastSyncedPassageId
    }
  };
}

module.exports = {
  startCloudSyncWorker,
  stopCloudSyncWorker,
  getSyncMetrics
};
