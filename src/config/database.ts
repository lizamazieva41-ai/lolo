import Database from 'better-sqlite3';
import path from 'path';

// Use SQLite for testing
const dbPath = path.join(__dirname, '../../test.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    data_limit VARCHAR(50) NOT NULL,
    validity_days INTEGER NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    price_khr DECIMAL(10,2) NOT NULL,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    amount_usd DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS esim_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    iccid VARCHAR(20) UNIQUE NOT NULL,
    imsi VARCHAR(15) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'suspended', 'terminated')),
    activated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(100) NOT NULL,
    payload TEXT,
    processed BOOLEAN DEFAULT 0,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log('Testing SQLite database connection...');
    // Test connection by running a simple query
    db.prepare('SELECT 1').get();
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    let stmt;
    if (params && params.length > 0) {
      stmt = db.prepare(text);
      const result = stmt.all(...params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.length });
      return { rows: result, rowCount: result.length };
    } else {
      stmt = db.prepare(text);
      const result = stmt.all();
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.length });
      return { rows: result, rowCount: result.length };
    }
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

export const getClient = () => {
  return db;
};

export default db;
