import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { initDatabase } from './db/db.js';
import { startScheduler } from './services/scheduler.js';

// Import routes
import threadsRouter from './routes/threads.js';
import repliesRouter from './routes/replies.js';
import analyticsRouter from './routes/analytics.js';
import settingsRouter from './routes/settings.js';
import activityRouter from './routes/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security headers middleware
app.use((req, res, next) => {
    // Content Security Policy - allows Tailwind CDN
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'"
    );
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Body parsing middleware
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '../dashboard')));

// API routes
app.use('/api/threads', threadsRouter);
app.use('/api/replies', repliesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/activity', activityRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../dashboard/index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: config.nodeEnv === 'development' ? err.message : undefined
    });
});

// Try to listen on a specific port, returns Promise with the actual port or rejects
function tryListen(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port);
        server.on('listening', () => resolve({ server, port }));
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(err);
            } else {
                reject(err);
            }
        });
    });
}

// Initialize and start server
async function start() {
    try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized');

        // Try ports in order: configured port, then fallbacks
        const portsToTry = [config.port, 3001, 3002];
        let actualPort = null;

        for (const port of portsToTry) {
            try {
                const { server, port: boundPort } = await tryListen(port);
                actualPort = boundPort;

                if (port !== config.port) {
                    console.log(`Port ${config.port} in use, using port ${actualPort} instead`);
                }

                console.log(`grok-engage running at http://localhost:${actualPort}`);

                // Start the scheduler for background tasks
                startScheduler().catch(err => {
                    console.error('Failed to start scheduler:', err);
                });

                // Open browser in development mode
                if (config.openBrowser && config.nodeEnv !== 'production') {
                    import('open').then(open => {
                        open.default(`http://localhost:${actualPort}`).catch(() => {
                            // Silently fail if browser can't be opened
                        });
                    }).catch(() => {
                        // open package not available, skip
                    });
                }

                break; // Successfully started, exit the loop
            } catch (err) {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is in use, trying next port...`);
                    continue;
                }
                throw err; // Re-throw non-EADDRINUSE errors
            }
        }

        if (actualPort === null) {
            throw new Error(`All ports (${portsToTry.join(', ')}) are in use`);
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

export default app;
