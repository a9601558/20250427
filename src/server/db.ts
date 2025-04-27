import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define query result type
export type QueryResult = any[];

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quizdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Helper function to execute SQL queries
export const db = {
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      const [results] = await pool.execute(sql, params);
      return results as QueryResult;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

// Test the database connection when the server starts
async function testConnection() {
  try {
    await db.query('SELECT 1');
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1); // Exit if we can't connect to the database
  }
}

// Run the test but don't block server startup
testConnection().catch(console.error);

export default db; 