# Leaderboard Feature Demo 🏆

## How Thought Grouping Works

The leaderboard automatically groups similar thoughts together by:

1. **Normalizing content**: Removing punctuation, converting to lowercase, normalizing spaces
2. **Grouping identical normalized thoughts**: Thoughts that become the same after normalization are grouped
3. **Counting occurrences**: Shows how many people are thinking similar things
4. **Displaying examples**: Shows up to 3 example thoughts from each group

## Example Groupings

### Input Thoughts:
```
"I'm thinking about coffee"
"Coffee is on my mind"
"COFFEE!!!"
"Need some coffee..."
"Thinking about work deadlines"
"Work stress is killing me"
"Can't stop thinking about work"
"Banana smoothie sounds good"
"I want a banana"
"Bananas are the best fruit"
"Cheese pizza tonight"
"Thinking about cheese"
```

### How They Get Grouped:

**Theme: "thinking about coffee"** (Count: 4)
- Examples: "I'm thinking about coffee", "Coffee is on my mind", "COFFEE!!!"

**Theme: "thinking about work"** (Count: 3)  
- Examples: "Thinking about work deadlines", "Work stress is killing me", "Can't stop thinking about work"

**Theme: "banana"** (Count: 3)
- Examples: "Banana smoothie sounds good", "I want a banana", "Bananas are the best fruit"

**Theme: "cheese"** (Count: 2)
- Examples: "Cheese pizza tonight", "Thinking about cheese"

## Real-Time Features

- **Live Updates**: Leaderboard updates in real-time as new thoughts are posted
- **24-Hour Window**: Only shows themes from the last 24 hours
- **Minimum Threshold**: Groups only appear when they have 2+ similar thoughts
- **Newest First**: Groups are ordered by count, then by most recent activity
- **Visual Indicators**: New themes get highlighted animations

## API Endpoints

- `GET /api/leaderboard` - Get current trending themes
- WebSocket `leaderboardUpdate` - Real-time theme updates

## Database Structure

The system stores both original and normalized content:
- `content`: Original thought text
- `normalized_content`: Processed version for grouping
- Index on `normalized_content` for fast grouping queries

## Testing the Feature

1. Open the application in multiple browser windows
2. Post similar thoughts with different wording
3. Watch the leaderboard update in real-time
4. See how punctuation and capitalization don't affect grouping

This creates a fascinating view into the collective consciousness - showing what topics are most on people's minds at any given moment! 