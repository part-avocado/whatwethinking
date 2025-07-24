const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Initialize SQLite database
const db = new sqlite3.Database('./thoughts.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS thoughts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL,
    normalized_content TEXT NOT NULL
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS user_rate_limits (
    user_id TEXT PRIMARY KEY,
    last_submission DATETIME NOT NULL,
    next_allowed DATETIME NOT NULL
  )`);
  
  // Create index for faster grouping queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_normalized_content ON thoughts(normalized_content)`);
});

// Function to normalize thought content for grouping
function normalizeThought(content) {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

// Function to find similar thoughts using simple keyword matching
function findSimilarThoughts(content) {
  const normalized = normalizeThought(content);
  const words = normalized.split(' ').filter(word => word.length > 2); // Only words longer than 2 chars
  
  if (words.length === 0) return normalized;
  
  // For now, use exact normalized match
  // Could be enhanced with fuzzy matching, stemming, etc.
  return normalized;
}

// Middleware to ensure user has a unique ID
const ensureUserId = (req, res, next) => {
  let userId = req.cookies.userId;
  
  if (!userId) {
    userId = uuidv4();
    // Set cookie for 1 year with httpOnly and secure flags
    res.cookie('userId', userId, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }
  
  req.userId = userId;
  next();
};

// Cookie-based rate limiting middleware
const cookieRateLimit = (req, res, next) => {
  const userId = req.userId;
  const now = new Date();
  
  db.get(
    'SELECT last_submission, next_allowed FROM user_rate_limits WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (row) {
        const nextAllowed = new Date(row.next_allowed);
        
        if (now < nextAllowed) {
          const waitTime = Math.ceil((nextAllowed - now) / (1000 * 60)); // minutes
          return res.status(429).json({ 
            error: `Please wait ${waitTime} minute${waitTime !== 1 ? 's' : ''} before posting again.`,
            nextAllowedAt: nextAllowed.toISOString(),
            waitTimeMinutes: waitTime
          });
        }
      }
      
      next();
    }
  );
};

// Helper function to update rate limit
const updateRateLimit = (userId) => {
  const now = new Date();
  const nextAllowed = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  
  db.run(
    'INSERT OR REPLACE INTO user_rate_limits (user_id, last_submission, next_allowed) VALUES (?, ?, ?)',
    [userId, now.toISOString(), nextAllowed.toISOString()],
    (err) => {
      if (err) {
        console.error('Failed to update rate limit:', err);
      }
    }
  );
};

// API Routes
app.post('/api/thoughts', ensureUserId, cookieRateLimit, (req, res) => {
  const { content } = req.body;
  const userId = req.userId;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Thought content cannot be empty' });
  }
  
  if (content.length > 500) {
    return res.status(400).json({ error: 'Thought must be 500 characters or less' });
  }
  
  const normalizedContent = findSimilarThoughts(content.trim());
  const timestamp = new Date().toISOString();
  
  // Insert thought
  db.run(
    'INSERT INTO thoughts (content, user_id, normalized_content) VALUES (?, ?, ?)',
    [content.trim(), userId, normalizedContent],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save thought' });
      }
      
      const newThought = {
        id: this.lastID,
        content: content.trim(),
        timestamp: timestamp
      };
      
      // Update rate limit for this user
      updateRateLimit(userId);
      
      // Broadcast to all connected clients
      io.emit('newThought', newThought);
      
      // Also broadcast updated leaderboard
      getLeaderboardData((leaderboard) => {
        io.emit('leaderboardUpdate', leaderboard);
      });
      
      res.json({ success: true, thought: newThought });
    }
  );
});

// Get recent thoughts
app.get('/api/thoughts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  
  db.all(
    'SELECT id, content, timestamp FROM thoughts ORDER BY timestamp DESC LIMIT ?',
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch thoughts' });
      }
      res.json(rows);
    }
  );
});

// Helper function to get leaderboard data
const getLeaderboardData = (callback) => {
  db.all(`
    SELECT 
      normalized_content,
      COUNT(*) as count,
      MAX(timestamp) as latest_timestamp,
      GROUP_CONCAT(DISTINCT content, '|||') as examples
    FROM thoughts 
    WHERE datetime(timestamp) >= datetime('now', '-24 hours')
    GROUP BY normalized_content 
    HAVING count >= 2
    ORDER BY count DESC, latest_timestamp DESC 
    LIMIT 20
  `, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return callback([]);
    }
    
    const leaderboard = rows.map(row => ({
      theme: row.normalized_content,
      count: row.count,
      latestTimestamp: row.latest_timestamp,
      examples: row.examples.split('|||').slice(0, 3) // Show up to 3 examples
    }));
    
    callback(leaderboard);
  });
};

// Get thought leaderboard
app.get('/api/leaderboard', (req, res) => {
  getLeaderboardData((leaderboard) => {
    res.json(leaderboard);
  });
});

// Get stats
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM thoughts', (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
    
    db.get(
      'SELECT COUNT(*) as today FROM thoughts WHERE date(timestamp) = date("now")',
      (err2, row2) => {
        if (err2) {
          console.error('Database error:', err2);
          return res.status(500).json({ error: 'Failed to fetch stats' });
        }
        
        db.get(
          'SELECT COUNT(DISTINCT normalized_content) as unique_themes FROM thoughts WHERE datetime(timestamp) >= datetime("now", "-24 hours")',
          (err3, row3) => {
            if (err3) {
              console.error('Database error:', err3);
              return res.status(500).json({ error: 'Failed to fetch stats' });
            }
            
            res.json({
              totalThoughts: row.total,
              todayThoughts: row2.today,
              uniqueThemes: row3.unique_themes || 0
            });
          }
        );
      }
    );
  });
});

// Get user's rate limit status
app.get('/api/rate-limit-status', ensureUserId, (req, res) => {
  const userId = req.userId;
  const now = new Date();
  
  db.get(
    'SELECT next_allowed FROM user_rate_limits WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (row) {
        const nextAllowed = new Date(row.next_allowed);
        const canPost = now >= nextAllowed;
        const waitTime = canPost ? 0 : Math.ceil((nextAllowed - now) / (1000 * 60));
        
        res.json({
          canPost,
          nextAllowedAt: nextAllowed.toISOString(),
          waitTimeMinutes: waitTime
        });
      } else {
        res.json({
          canPost: true,
          nextAllowedAt: null,
          waitTimeMinutes: 0
        });
      }
    }
  );
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected');
  
  // Send current leaderboard to new user
  getLeaderboardData((leaderboard) => {
    socket.emit('leaderboardUpdate', leaderboard);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  server.close(() => {
    process.exit(0);
  });
}); 