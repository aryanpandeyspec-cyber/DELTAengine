-- =====================================================================
-- DELTA ENGINE — SUPABASE POSTGRESQL COMPLETE DATABASE SCHEMA & SEED
-- =====================================================================
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/frlrazzskbzmtlqrswjl/sql/new
-- =====================================================================

-- 1. Create Speakers Table
CREATE TABLE IF NOT EXISTS public.speakers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    avatar TEXT,
    bio TEXT,
    delay INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Halls Table
CREATE TABLE IF NOT EXISTS public.halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Topics Table
CREATE TABLE IF NOT EXISTS public.topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    speaker_id TEXT REFERENCES public.speakers(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    interest INTEGER DEFAULT 100,
    duration INTEGER DEFAULT 60,
    summary TEXT,
    slides_uploaded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Schedule Mappings Table
CREATE TABLE IF NOT EXISTS public.schedule_mappings (
    slot_id TEXT NOT NULL,
    hall_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (slot_id, hall_id)
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_mappings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for anon client hydration)
DROP POLICY IF EXISTS "Allow public read access on speakers" ON public.speakers;
CREATE POLICY "Allow public read access on speakers" ON public.speakers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on halls" ON public.halls;
CREATE POLICY "Allow public read access on halls" ON public.halls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on topics" ON public.topics;
CREATE POLICY "Allow public read access on topics" ON public.topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on schedule_mappings" ON public.schedule_mappings;
CREATE POLICY "Allow public read access on schedule_mappings" ON public.schedule_mappings FOR SELECT USING (true);

-- Allow all operations for service role & authenticated users
DROP POLICY IF EXISTS "Allow service role on speakers" ON public.speakers;
CREATE POLICY "Allow service role on speakers" ON public.speakers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role on halls" ON public.halls;
CREATE POLICY "Allow service role on halls" ON public.halls FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role on topics" ON public.topics;
CREATE POLICY "Allow service role on topics" ON public.topics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role on schedule_mappings" ON public.schedule_mappings;
CREATE POLICY "Allow service role on schedule_mappings" ON public.schedule_mappings FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- INITIAL DATA SEEDING (DELTA ENGINE CONFERENCE GRAPH)
-- =====================================================================

INSERT INTO public.speakers (id, name, role, avatar, bio, delay)
VALUES
    ('speaker-1', 'Dr. Aditi Sharma', 'AI Research Director', '🧑‍🔬', 'Pioneering agentic swarm coordination models.', 0),
    ('speaker-2', 'Vikramaditya Verma', 'Graphics Engineer', '💻', 'Ex-Mozilla WebGPU core contributor.', 0),
    ('speaker-3', 'Priya Nair', 'DevOps Architect', '☁️', 'Specialist in cloud-native self-healing nodes.', 0)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    avatar = EXCLUDED.avatar,
    bio = EXCLUDED.bio,
    delay = EXCLUDED.delay;

INSERT INTO public.halls (id, name, capacity)
VALUES
    ('hall-1', 'Turing Hall', 250),
    ('hall-2', 'Lovelace Suite', 120),
    ('hall-3', 'Hopper Room', 60),
    ('hall-4', 'Keynote Arena', 500)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    capacity = EXCLUDED.capacity;

INSERT INTO public.topics (id, title, speaker_id, tags, interest, duration, summary, slides_uploaded)
VALUES
    ('topic-1', 'Autonomous Agent Swarms: Coordination without Controllers', 'speaker-1', ARRAY['AI', 'Agentic', 'Swarms'], 210, 60, 'Peer-to-peer LLM negotiation without central controllers.', true),
    ('topic-2', 'WebGPU Deep Dive: Raytracing in the Browser', 'speaker-2', ARRAY['Graphics', 'WebGPU', 'JS'], 140, 60, 'Rendering hardware-accelerated 3D graphs at 60 FPS.', true),
    ('topic-3', 'Kubernetes Auto-Healing Runtimes under Load Stress', 'speaker-3', ARRAY['DevOps', 'K8s', 'Cloud'], 180, 60, 'Self-correcting pod scheduling during high traffic spikes.', true)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    speaker_id = EXCLUDED.speaker_id,
    tags = EXCLUDED.tags,
    interest = EXCLUDED.interest,
    duration = EXCLUDED.duration,
    summary = EXCLUDED.summary,
    slides_uploaded = EXCLUDED.slides_uploaded;

INSERT INTO public.schedule_mappings (slot_id, hall_id, topic_id)
VALUES
    ('slot-1', 'hall-1', 'topic-1'),
    ('slot-2', 'hall-2', 'topic-2'),
    ('slot-3', 'hall-3', 'topic-3')
ON CONFLICT (slot_id, hall_id) DO UPDATE SET
    topic_id = EXCLUDED.topic_id;
