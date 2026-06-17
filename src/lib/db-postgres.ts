import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Necessary for connection to Supabase database clusters
  }
})

let isBootstrapped = false

/**
 * Bootstraps the PostgreSQL database tables if they do not exist.
 */
export async function bootstrapDb() {
  if (isBootstrapped) return
  
  const client = await pool.connect()
  try {
    // 1. Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        last_updated BIGINT
      );
    `)

    // 2. Create chapters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        created_at BIGINT,
        updated_at BIGINT,
        word_goal INTEGER
      );
    `)

    // 3. Create bible_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bible_entries (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        content TEXT,
        created_at BIGINT,
        updated_at BIGINT
      );
    `)

    // 4. Create brain_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS brain_entries (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        highlighted_text TEXT,
        ai_summary TEXT,
        chapter_title VARCHAR(255),
        chapter_id VARCHAR(255),
        created_at BIGINT,
        updated_at BIGINT
      );
    `)

    await client.query(`
      ALTER TABLE brain_entries
      ADD COLUMN IF NOT EXISTS chapter_number INTEGER;
    `)

    await client.query(`
      ALTER TABLE brain_entries
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS entity_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS importance VARCHAR(50),
      ADD COLUMN IF NOT EXISTS connections JSONB;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS arc_seeds (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        why_it_matters TEXT,
        future_payoff TEXT,
        evidence TEXT,
        chapter_title VARCHAR(255),
        chapter_id VARCHAR(255),
        chapter_number INTEGER,
        related_characters JSONB,
        related_entities JSONB,
        status VARCHAR(50),
        created_at BIGINT,
        updated_at BIGINT
      );
    `)

    await client.query(`
      ALTER TABLE chapters
      ADD COLUMN IF NOT EXISTS volume_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION;
    `)

    await client.query(`
      ALTER TABLE bible_entries
      ADD COLUMN IF NOT EXISTS group_ids JSONB;
    `)

    await client.query(`
      ALTER TABLE bible_entries
      ADD COLUMN IF NOT EXISTS timeline_facts JSONB;
    `)

    await client.query(`
      ALTER TABLE bible_entries
      ADD COLUMN IF NOT EXISTS character_details JSONB;
    `)

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS volumes JSONB,
      ADD COLUMN IF NOT EXISTS bible_groups JSONB;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS progression_profiles (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        profile_data JSONB NOT NULL,
        created_at BIGINT,
        updated_at BIGINT
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS progression_system (
        project_id VARCHAR(255) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        system_data JSONB NOT NULL,
        updated_at BIGINT
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_library (
        project_id VARCHAR(255) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        updated_at BIGINT
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS name_forge_data (
        project_id VARCHAR(255) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        updated_at BIGINT
      );
    `)
    
    isBootstrapped = true
    console.log("Postgres database tables checked/created successfully.")
  } catch (error) {
    console.error("Failed to bootstrap PostgreSQL database tables:", error)
    throw error
  } finally {
    client.release()
  }
}

export default pool
