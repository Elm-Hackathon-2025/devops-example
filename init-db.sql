-- Initialize database schema
-- This script runs automatically when PostgreSQL container starts

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    team_name VARCHAR(100),
    service_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    team_name VARCHAR(100),
    service_name VARCHAR(100),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_team_name ON tasks(team_name);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_team_name ON metrics(team_name);
CREATE INDEX IF NOT EXISTS idx_metrics_metric_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON metrics(recorded_at);

-- Insert sample data
INSERT INTO tasks (title, description, status, team_name, service_name) VALUES
    ('Setup Project', 'Initialize the project structure', 'completed', 'expo-1st', 'api'),
    ('Database Schema', 'Design and implement database schema', 'in-progress', 'expo-1st', 'api'),
    ('API Endpoints', 'Create RESTful API endpoints', 'pending', 'expo-1st', 'api'),
    ('Frontend Integration', 'Connect frontend with backend', 'pending', 'expo-1st', 'frontend');

INSERT INTO metrics (metric_name, metric_value, team_name, service_name) VALUES
    ('requests_total', 150, 'expo-1st', 'api'),
    ('response_time_ms', 45.3, 'expo-1st', 'api'),
    ('active_users', 12, 'expo-1st', 'frontend'),
    ('error_count', 3, 'expo-1st', 'api');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
