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
