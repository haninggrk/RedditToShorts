import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDb();
  }
  return db;
}

function initializeDb() {
  const database = db!;
  
  // Settings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      preferred_duration INTEGER DEFAULT 60,
      target_audience TEXT DEFAULT 'General audience interested in entertaining content',
      tone TEXT DEFAULT 'Engaging, conversational, and slightly dramatic',
      additional_preferences TEXT DEFAULT '',
      gemini_api_key TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add gemini_api_key column if it doesn't exist (migration for existing DBs)
  try {
    database.exec(`ALTER TABLE settings ADD COLUMN gemini_api_key TEXT DEFAULT ''`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add gemini_model column if it doesn't exist (migration for existing DBs)
  try {
    database.exec(`ALTER TABLE settings ADD COLUMN gemini_model TEXT DEFAULT 'gemini-2.5-flash'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add AI provider settings columns
  const providerColumns = [
    { name: 'ai_provider', default: 'gemini' },
    { name: 'copilot_api_url', default: 'http://localhost:4141' },
    { name: 'copilot_model', default: 'gpt-4.1' },
  ];
  for (const col of providerColumns) {
    try {
      database.exec(`ALTER TABLE settings ADD COLUMN ${col.name} TEXT DEFAULT '${col.default}'`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
  
  // Add Reddit API columns if they don't exist (migration for existing DBs)
  const redditColumns = [
    'reddit_client_id',
    'reddit_client_secret', 
    'reddit_username',
    'reddit_password'
  ];
  for (const col of redditColumns) {
    try {
      database.exec(`ALTER TABLE settings ADD COLUMN ${col} TEXT DEFAULT ''`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
  
  // Insert default settings if not exists
  database.exec(`
    INSERT OR IGNORE INTO settings (id) VALUES (1)
  `);
  
  // Generated ideas table
  database.exec(`
    CREATE TABLE IF NOT EXISTS generated_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subreddit TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      thread_title TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      transcript TEXT NOT NULL,
      scenes TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create index for faster lookups
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_generated_ideas_subreddit ON generated_ideas(subreddit)
  `);
  
  // Add youtube_link and views columns if they don't exist (migration)
  const ideaColumns = ['youtube_link', 'views', 'voice_style', 'music_style', 'pinned_comment', 'thumbnail_prompts'];
  for (const col of ideaColumns) {
    try {
      database.exec(`ALTER TABLE generated_ideas ADD COLUMN ${col} TEXT DEFAULT ''`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
  
  // Viral references table
  database.exec(`
    CREATE TABLE IF NOT EXISTS viral_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      transcript TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      idea_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export interface Settings {
  id: number;
  preferred_duration: number;
  target_audience: string;
  tone: string;
  additional_preferences: string;
  ai_provider: 'gemini' | 'copilot';
  gemini_api_key: string;
  gemini_model: string;
  copilot_api_url: string;
  copilot_model: string;
  reddit_client_id: string;
  reddit_client_secret: string;
  reddit_username: string;
  reddit_password: string;
}

export interface GeneratedIdea {
  id: number;
  subreddit: string;
  thread_id: string;
  thread_title: string;
  title: string;
  description: string;
  transcript: string;
  scenes: string;
  voice_style?: string;
  music_style?: string;
  pinned_comment?: string;
  thumbnail_prompts?: string;
  youtube_link?: string;
  views?: number;
  created_at: string;
}

export function getSettings(): Settings {
  const db = getDb();
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings;
}

export function updateSettings(settings: Partial<Settings>): Settings {
  const db = getDb();
  const current = getSettings();
  
  const updated = {
    ...current,
    ...settings,
  };
  
  db.prepare(`
    UPDATE settings 
    SET preferred_duration = ?, target_audience = ?, tone = ?, additional_preferences = ?, ai_provider = ?, gemini_api_key = ?, gemini_model = ?, copilot_api_url = ?, copilot_model = ?, reddit_client_id = ?, reddit_client_secret = ?, reddit_username = ?, reddit_password = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    updated.preferred_duration, 
    updated.target_audience, 
    updated.tone, 
    updated.additional_preferences, 
    updated.ai_provider || 'gemini',
    updated.gemini_api_key,
    updated.gemini_model || 'gemini-2.5-flash',
    updated.copilot_api_url || 'http://localhost:4141',
    updated.copilot_model || 'gpt-4.1',
    updated.reddit_client_id || '',
    updated.reddit_client_secret || '',
    updated.reddit_username || '',
    updated.reddit_password || ''
  );
  
  return getSettings();
}

export function saveGeneratedIdea(idea: Omit<GeneratedIdea, 'id' | 'created_at'>): GeneratedIdea {
  const db = getDb();
  
  const result = db.prepare(`
    INSERT INTO generated_ideas (subreddit, thread_id, thread_title, title, description, transcript, scenes, voice_style, music_style, pinned_comment, thumbnail_prompts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(idea.subreddit, idea.thread_id, idea.thread_title, idea.title, idea.description, idea.transcript, idea.scenes, idea.voice_style || '', idea.music_style || '', idea.pinned_comment || '', idea.thumbnail_prompts || '');
  
  return db.prepare('SELECT * FROM generated_ideas WHERE id = ?').get(result.lastInsertRowid) as GeneratedIdea;
}

export function getGeneratedIdeas(limit: number = 50): GeneratedIdea[] {
  const db = getDb();
  return db.prepare('SELECT * FROM generated_ideas ORDER BY created_at DESC LIMIT ?').all(limit) as GeneratedIdea[];
}

export function getGeneratedIdeaById(id: number): GeneratedIdea | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM generated_ideas WHERE id = ?').get(id) as GeneratedIdea | undefined;
}

export function deleteGeneratedIdea(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM generated_ideas WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateGeneratedIdea(id: number, updates: Partial<Omit<GeneratedIdea, 'id' | 'created_at'>>): GeneratedIdea | undefined {
  const db = getDb();
  const current = getGeneratedIdeaById(id);
  if (!current) return undefined;
  
  const updated = { ...current, ...updates };
  
  db.prepare(`
    UPDATE generated_ideas 
    SET title = ?, description = ?, transcript = ?, scenes = ?, voice_style = ?, music_style = ?, pinned_comment = ?, thumbnail_prompts = ?, youtube_link = ?, views = ?
    WHERE id = ?
  `).run(
    updated.title,
    updated.description,
    updated.transcript,
    updated.scenes,
    updated.voice_style || '',
    updated.music_style || '',
    updated.pinned_comment || '',
    updated.thumbnail_prompts || '',
    updated.youtube_link || '',
    updated.views || '',
    id
  );
  
  return getGeneratedIdeaById(id);
}

// Viral References
export interface ViralReference {
  id: number;
  title: string;
  transcript: string;
  source: 'marked' | 'manual';
  idea_id?: number;
  created_at: string;
}

export function getViralReferences(): ViralReference[] {
  const db = getDb();
  return db.prepare('SELECT * FROM viral_references ORDER BY created_at DESC').all() as ViralReference[];
}

export function addViralReference(ref: { title: string; transcript: string; source: 'marked' | 'manual'; idea_id?: number }): ViralReference {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO viral_references (title, transcript, source, idea_id) VALUES (?, ?, ?, ?)'
  ).run(ref.title, ref.transcript, ref.source, ref.idea_id ?? null);
  return db.prepare('SELECT * FROM viral_references WHERE id = ?').get(result.lastInsertRowid) as ViralReference;
}

export function deleteViralReference(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM viral_references WHERE id = ?').run(id);
  return result.changes > 0;
}

export function isIdeaMarkedViral(ideaId: number): boolean {
  const db = getDb();
  const row = db.prepare('SELECT id FROM viral_references WHERE idea_id = ? LIMIT 1').get(ideaId);
  return !!row;
}
