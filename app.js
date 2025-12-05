const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || 'unknown';

// Middleware
app.use(express.json());

// Health check endpoint (REQUIRED)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    team: TEAM_NAME
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: `Hello from ${TEAM_NAME}!`,
    team: TEAM_NAME,
    environment: process.env.ENVIRONMENT || 'local',
    timestamp: new Date().toISOString()
  });
});

// Example API endpoint
app.get('/api/info', (req, res) => {
  res.json({
    team: TEAM_NAME,
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server on 0.0.0.0 (important for container networking)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Team: ${TEAM_NAME}`);
  console.log(`Environment: ${process.env.ENVIRONMENT || 'local'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
