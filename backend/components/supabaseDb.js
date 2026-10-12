// --- SUPABASE POSTGRESQL PERSISTENCE & HYDRATION CONNECTOR ---
require('dotenv').config({ quiet: true });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Hydrate In-Memory Graph from Supabase PostgreSQL on Server Boot
async function loadGraphFromSupabase(dbContainer) {
  if (!supabase) {
    return false;
  }

  try {
    const { data: speakers, error: errS } = await supabase.from('speakers').select('*');
    const { data: topics, error: errT } = await supabase.from('topics').select('*');
    const { data: halls, error: errH } = await supabase.from('halls').select('*');
    const { data: schedule, error: errM } = await supabase.from('schedule_mappings').select('*');

    if (errS || errT || errH) {
      console.warn('[Supabase Warning] Could not fetch tables. Ensure SQL schema script was executed:', errS?.message || errT?.message || errH?.message);
      return false;
    }

    if (speakers && speakers.length > 0) {
      speakers.forEach(s => { dbContainer.graph.speakers[s.id] = { ...s, delay: s.delay || 0 }; });
      topics.forEach(t => { 
        dbContainer.graph.topics[t.id] = { 
          ...t, 
          speakerId: t.speakerId || t.speaker_id,
          slidesUploaded: t.slidesUploaded !== undefined ? t.slidesUploaded : (t.slides_uploaded ?? true)
        }; 
      });
      halls.forEach(h => { dbContainer.graph.halls[h.id] = h; });
      
      if (schedule && schedule.length > 0) {
        schedule.forEach(item => {
          if (dbContainer.schedule[item.slot_id]) {
            dbContainer.schedule[item.slot_id][item.hall_id] = item.topic_id;
          }
        });
      }
      dbContainer.syncScheduleEdges();
      console.log('✅ [Supabase] Successfully loaded & hydrated graph data from PostgreSQL!');
      return true;
    }
  } catch (err) {
    console.error('[Supabase Error]:', err.message);
  }
  return false;
}

// Persist schedule changes back to Supabase PostgreSQL
async function saveScheduleToSupabase(slotId, hallId, topicId) {
  if (!supabase) return;
  try {
    await supabase.from('schedule_mappings').upsert({
      slot_id: slotId,
      hall_id: hallId,
      topic_id: topicId
    });
  } catch (err) {
    console.error('[Supabase Upsert Error]:', err.message);
  }
}

module.exports = { supabase, loadGraphFromSupabase, saveScheduleToSupabase };
