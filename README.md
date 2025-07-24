# What We Thinking 🧠

A live anonymous thoughts dashboard where users can share what they're thinking right now. No login required, rate-limited to 1 thought per hour per IP address.

## Features

- **Anonymous Posting**: No registration or login required
- **Cookie-Based Rate Limiting**: 1 thought per hour per user (fair per-device limiting)
- **Real-time Updates**: Live dashboard with WebSocket connections
- **Modern UI**: Beautiful, responsive design with smooth animations
- **Live Stats**: Shows total thoughts and daily contributions
- **Character Limit**: 500 character limit per thought
- **Timestamp Display**: Shows relative time for each thought
- **Live Countdown**: Shows exactly when users can post their next thought
- **Thought Grouping**: Similar thoughts are automatically grouped together
- **Live Leaderboard**: Real-time trending themes showing what people are thinking about most
- **Theme Analytics**: Track unique themes and collective consciousness patterns

## Tech Stack

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time communication
- **SQLite** database for persistence
- **Rate limiting** with express-rate-limit
- **Security** with Helmet.js and CORS

### Frontend
- **React** with TypeScript
- **Styled Components** for CSS-in-JS styling
- **Socket.IO Client** for real-time updates
- **Axios** for HTTP requests
- **Lucide React** for icons

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd whatwethinking
```

2. Install all dependencies:
```bash
npm run install-all
```

### Development

To run both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend development server on `http://localhost:3000`

### Individual Commands

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

### Production

1. Build the frontend:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The server will serve both the API and the built React app.

## API Endpoints

### POST /api/thoughts
Submit a new thought (rate limited to 1 per hour per user via cookies)

**Request Body:**
```json
{
  "content": "Your thought here..."
}
```

**Response:**
```json
{
  "success": true,
  "thought": {
    "id": 1,
    "content": "Your thought here...",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Rate Limit Error:**
```json
{
  "error": "Please wait 45 minutes before posting again.",
  "nextAllowedAt": "2024-01-01T13:00:00.000Z",
  "waitTimeMinutes": 45
}
```

### GET /api/thoughts
Get recent thoughts (default: 50, max: 100)

**Query Parameters:**
- `limit`: Number of thoughts to return (optional)

**Response:**
```json
[
  {
    "id": 1,
    "content": "A thought...",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
]
```

### GET /api/stats
Get platform statistics

**Response:**
```json
{
  "totalThoughts": 1234,
  "todayThoughts": 42
}
```

### GET /api/rate-limit-status
Get current user's rate limit status

**Response:**
```json
{
  "canPost": false,
  "nextAllowedAt": "2024-01-01T13:00:00.000Z",
  "waitTimeMinutes": 45
}
```

## WebSocket Events

### newThought
Broadcasted when a new thought is posted

**Payload:**
```json
{
  "id": 1,
  "content": "New thought...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Database Schema

### thoughts
```sql
CREATE TABLE thoughts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL
);
```

### user_rate_limits
```sql
CREATE TABLE user_rate_limits (
  user_id TEXT PRIMARY KEY,
  last_submission DATETIME NOT NULL,
  next_allowed DATETIME NOT NULL
);
```

## Security Features

- **Cookie-Based Rate Limiting**: Fair per-user rate limiting (1 request per hour)
- **Input Validation**: Content length and format validation
- **Secure Cookies**: HttpOnly, secure cookies with unique user identifiers
- **CORS Protection**: Configured for development and production
- **Helmet.js**: Security headers and protections
- **Content Sanitization**: Basic XSS protection
- **Anonymous User IDs**: UUIDs for user identification without personal data

## Deployment

### Environment Variables

Create a `.env` file in the server directory:
```
NODE_ENV=production
PORT=3001
```

### Docker (Optional)

You can containerize this application:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Privacy & Data

- No personal information is collected
- Anonymous user identification via secure cookies with UUIDs
- Thoughts cannot be traced back to real users
- Database only stores: thought content, timestamp, and anonymous user ID
- Cookies are used solely for rate limiting, not tracking
- User IDs are completely random and contain no personal information

---

Built with ❤️ for anonymous expression and collective consciousness. 