const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const app = express();

const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || 'unknown';
const SERVICE_NAME = process.env.SERVICE_NAME || 'api';

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hackathon',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
let redisClient;
try {
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    },
  });
  redisClient.connect().catch(console.error);
} catch (error) {
  console.warn('Redis not available:', error.message);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Database initialization
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        team_name VARCHAR(100),
        service_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS metrics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC,
        team_name VARCHAR(100),
        service_name VARCHAR(100),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Health check endpoint (REQUIRED for ALB)
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    team: TEAM_NAME,
    service: SERVICE_NAME,
    checks: {}
  };

  // Database health check
  try {
    await pool.query('SELECT 1');
    health.checks.database = 'connected';
  } catch (error) {
    health.checks.database = 'disconnected';
    health.status = 'degraded';
  }

  // Redis health check
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      health.checks.redis = 'connected';
    } catch (error) {
      health.checks.redis = 'disconnected';
    }
  } else {
    health.checks.redis = 'not configured';
  }

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${TEAM_NAME} - ${SERVICE_NAME}`,
    team: TEAM_NAME,
    service: SERVICE_NAME,
    environment: process.env.ENVIRONMENT || 'local',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      tasks: '/api/tasks',
      metrics: '/api/metrics',
      cache: '/api/cache',
      info: '/api/info'
    }
  });
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE team_name = $1 ORDER BY created_at DESC LIMIT 100',
      [TEAM_NAME]
    );
    res.json({ tasks: rows, count: rows.length });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create a new task
app.post('/api/tasks', async (req, res) => {
  const { title, description, status } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (title, description, status, team_name, service_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, status || 'pending', TEAM_NAME, SERVICE_NAME]
    );
    
    // Invalidate cache
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(`tasks:${TEAM_NAME}`);
    }
    
    res.status(201).json({ task: rows[0] });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get a specific task
app.get('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND team_name = $2',
      [id, TEAM_NAME]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: rows[0] });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update a task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;

  try {
    const { rows } = await pool.query(
      'UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND team_name = $5 RETURNING *',
      [title, description, status, id, TEAM_NAME]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Invalidate cache
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(`tasks:${TEAM_NAME}`);
    }

    res.json({ task: rows[0] });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND team_name = $2 RETURNING *',
      [id, TEAM_NAME]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Invalidate cache
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(`tasks:${TEAM_NAME}`);
    }

    res.json({ message: 'Task deleted', task: rows[0] });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Record a metric
app.post('/api/metrics', async (req, res) => {
  const { metric_name, metric_value } = req.body;

  if (!metric_name || metric_value === undefined) {
    return res.status(400).json({ error: 'metric_name and metric_value are required' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO metrics (metric_name, metric_value, team_name, service_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [metric_name, metric_value, TEAM_NAME, SERVICE_NAME]
    );
    res.status(201).json({ metric: rows[0] });
  } catch (error) {
    console.error('Error recording metric:', error);
    res.status(500).json({ error: 'Failed to record metric' });
  }
});

// Get metrics
app.get('/api/metrics', async (req, res) => {
  const { metric_name, limit = 100 } = req.query;

  try {
    let query = 'SELECT * FROM metrics WHERE team_name = $1';
    const params = [TEAM_NAME];

    if (metric_name) {
      query += ' AND metric_name = $2';
      params.push(metric_name);
    }

    query += ' ORDER BY recorded_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const { rows } = await pool.query(query, params);
    res.json({ metrics: rows, count: rows.length });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Cache operations
app.get('/api/cache/:key', async (req, res) => {
  const { key } = req.params;

  if (!redisClient || !redisClient.isOpen) {
    return res.status(503).json({ error: 'Redis not available' });
  }

  try {
    const value = await redisClient.get(`${TEAM_NAME}:${key}`);
    if (value === null) {
      return res.status(404).json({ error: 'Key not found' });
    }
    res.json({ key, value: JSON.parse(value) });
  } catch (error) {
    console.error('Error getting cache:', error);
    res.status(500).json({ error: 'Failed to get cache' });
  }
});

app.post('/api/cache', async (req, res) => {
  const { key, value, ttl = 3600 } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  if (!redisClient || !redisClient.isOpen) {
    return res.status(503).json({ error: 'Redis not available' });
  }

  try {
    await redisClient.setEx(`${TEAM_NAME}:${key}`, ttl, JSON.stringify(value));
    res.json({ message: 'Cached successfully', key, ttl });
  } catch (error) {
    console.error('Error setting cache:', error);
    res.status(500).json({ error: 'Failed to set cache' });
  }
});

// System info
app.get('/api/info', async (req, res) => {
  try {
    // Get database stats
    const { rows: taskCount } = await pool.query(
      'SELECT COUNT(*) as count FROM tasks WHERE team_name = $1',
      [TEAM_NAME]
    );
    
    const { rows: metricCount } = await pool.query(
      'SELECT COUNT(*) as count FROM metrics WHERE team_name = $1',
      [TEAM_NAME]
    );

    res.json({
      team: TEAM_NAME,
      service: SERVICE_NAME,
      version: '2.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.ENVIRONMENT || 'local',
      stats: {
        tasks: parseInt(taskCount[0].count),
        metrics: parseInt(metricCount[0].count)
      },
      database: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      },
      redis: {
        available: redisClient && redisClient.isOpen
      }
    });
  } catch (error) {
    console.error('Error fetching info:', error);
    res.status(500).json({ error: 'Failed to fetch info' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

// Start server
async function start() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Team: ${TEAM_NAME}`);
    console.log(`Service: ${SERVICE_NAME}`);
    console.log(`Environment: ${process.env.ENVIRONMENT || 'local'}`);
  });
}

start().catch(console.error);
