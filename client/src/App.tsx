import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import styled from 'styled-components';
import { Send, Brain, Clock, Users, Timer, TrendingUp, Hash } from 'lucide-react';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

// Configure axios to include credentials (cookies)
axios.defaults.withCredentials = true;

interface Thought {
  id: number;
  content: string;
  timestamp: string;
}

interface Stats {
  totalThoughts: number;
  todayThoughts: number;
  uniqueThemes: number;
}

interface RateLimitStatus {
  canPost: boolean;
  nextAllowedAt: string | null;
  waitTimeMinutes: number;
}

interface LeaderboardItemData {
  theme: string;
  count: number;
  latestTimestamp: string;
  examples: string[];
}

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

const Header = styled.header`
  text-align: center;
  padding: 3rem 1rem 2rem;
  color: white;
`;

const Title = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  opacity: 0.9;
  margin: 0;
`;

const StatsContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem 0;
  flex-wrap: wrap;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 1.5rem;
  text-align: center;
  color: white;
  min-width: 150px;
`;

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const MainContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const RightColumn = styled.div`
  @media (max-width: 768px) {
    order: -1;
  }
`;

const SubmissionCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 15px;
  font-size: 1rem;
  resize: vertical;
  outline: none;
  transition: border-color 0.3s ease;
  
  &:focus {
    border-color: #667eea;
  }
  
  &::placeholder {
    color: #999;
  }
`;

const SubmitButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #ccc;
  }
`;

const CharCount = styled.div<{ isNearLimit: boolean }>`
  text-align: right;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: ${props => props.isNearLimit ? '#e74c3c' : '#666'};
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  border: 1px solid #fcc;
`;

const SuccessMessage = styled.div`
  background: #efe;
  color: #363;
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  border: 1px solid #cfc;
`;

const RateLimitInfo = styled.div`
  background: #fff3cd;
  color: #856404;
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  border: 1px solid #ffeaa7;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CountdownTimer = styled.span`
  font-weight: bold;
  color: #e74c3c;
`;

const ThoughtsContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const LeaderboardContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  height: fit-content;
  position: sticky;
  top: 2rem;
`;

const SectionHeader = styled.h2`
  margin: 0 0 1.5rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ThoughtItem = styled.div<{ isNew?: boolean }>`
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
  transition: all 0.3s ease;
  animation: ${props => props.isNew ? 'fadeInSlide 0.5s ease-out' : 'none'};
  
  &:last-child {
    border-bottom: none;
  }
  
  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(-20px);
      background-color: #f0f8ff;
    }
    to {
      opacity: 1;
      transform: translateY(0);
      background-color: transparent;
    }
  }
`;

const ThoughtContent = styled.div`
  font-size: 1.1rem;
  line-height: 1.6;
  color: #333;
  margin-bottom: 0.5rem;
`;

const ThoughtTime = styled.div`
  font-size: 0.9rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const LiveIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #27ae60;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #fff;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const LeaderboardItem = styled.div<{ isNew?: boolean }>`
  padding: 1rem;
  border-bottom: 1px solid #eee;
  transition: all 0.3s ease;
  animation: ${props => props.isNew ? 'fadeInSlide 0.5s ease-out' : 'none'};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: #f8f9fa;
  }
`;

const LeaderboardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const ThemeText = styled.div`
  font-weight: 600;
  color: #333;
  font-size: 1rem;
`;

const ThemeCount = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: bold;
`;

const ExampleThoughts = styled.div`
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
  margin-top: 0.5rem;
`;

const ExampleThought = styled.div`
  margin-bottom: 0.25rem;
  &:last-child {
    margin-bottom: 0;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem;
`;

function App() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [newThought, setNewThought] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState<Stats>({ totalThoughts: 0, todayThoughts: 0, uniqueThemes: 0 });

  const [newThoughtIds, setNewThoughtIds] = useState<Set<number>>(new Set());
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    canPost: true,
    nextAllowedAt: null,
    waitTimeMinutes: 0
  });
  const [countdown, setCountdown] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItemData[]>([]);
  const [newLeaderboardThemes, setNewLeaderboardThemes] = useState<Set<string>>(new Set());
  
  const thoughtsRef = useRef<HTMLDivElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_LENGTH = 500;

  useEffect(() => {
    // Initialize socket connection with credentials
    const newSocket = io(API_BASE, {
      withCredentials: true
    });

    // Load initial data
    loadThoughts();
    loadStats();
    loadRateLimitStatus();
    loadLeaderboard();

    // Listen for new thoughts
    newSocket.on('newThought', (thought: Thought) => {
      setThoughts(prev => [thought, ...prev]);
      setNewThoughtIds(prev => new Set([...prev, thought.id]));
      
      // Remove the new indicator after 3 seconds
      setTimeout(() => {
        setNewThoughtIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(thought.id);
          return newSet;
        });
      }, 3000);
      
      // Update stats
      loadStats();
    });

    // Listen for leaderboard updates
    newSocket.on('leaderboardUpdate', (updatedLeaderboard: LeaderboardItemData[]) => {
      setLeaderboard(prevLeaderboard => {
        const oldThemes = new Set(prevLeaderboard.map(item => item.theme));
        const newThemes = updatedLeaderboard
          .filter(item => !oldThemes.has(item.theme))
          .map(item => item.theme);
        
        if (newThemes.length > 0) {
          setNewLeaderboardThemes(new Set(newThemes));
          setTimeout(() => {
            setNewLeaderboardThemes(new Set());
          }, 3000);
        }
        
        return updatedLeaderboard;
      });
    });

    return () => {
      newSocket.close();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Set up countdown timer
    if (rateLimitStatus.nextAllowedAt && !rateLimitStatus.canPost) {
      const updateCountdown = () => {
        const now = new Date();
        const nextAllowed = new Date(rateLimitStatus.nextAllowedAt!);
        const diff = nextAllowed.getTime() - now.getTime();
        
        if (diff <= 0) {
          setCountdown('');
          loadRateLimitStatus();
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          if (hours > 0) {
            setCountdown(`${hours}h ${minutes}m ${seconds}s`);
          } else if (minutes > 0) {
            setCountdown(`${minutes}m ${seconds}s`);
          } else {
            setCountdown(`${seconds}s`);
          }
        }
      };
      
      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    } else {
      setCountdown('');
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [rateLimitStatus]);

  const loadThoughts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/thoughts`);
      setThoughts(response.data);
    } catch (err) {
      console.error('Failed to load thoughts:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadRateLimitStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/rate-limit-status`);
      setRateLimitStatus(response.data);
    } catch (err) {
      console.error('Failed to load rate limit status:', err);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/leaderboard`);
      setLeaderboard(response.data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newThought.trim()) {
      setError('Please enter your thought');
      return;
    }

    if (newThought.length > MAX_LENGTH) {
      setError(`Thought must be ${MAX_LENGTH} characters or less`);
      return;
    }

    if (!rateLimitStatus.canPost) {
      setError('Please wait before posting again.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${API_BASE}/api/thoughts`, {
        content: newThought.trim()
      });
      
      setNewThought('');
      setSuccess('Your thought has been shared! Thank you for contributing to the collective consciousness.');
      
      loadRateLimitStatus();
      
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to submit thought. Please try again.');
      }
      
      loadRateLimitStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const canSubmit = rateLimitStatus.canPost && newThought.trim() && !isSubmitting;

  return (
    <Container>
      <Header>
        <Title>
          <Brain size={48} />
          What We Thinking
        </Title>
        <Subtitle>
          Anonymous thoughts from the collective consciousness
        </Subtitle>
        
        <StatsContainer>
          <StatCard>
            <StatNumber>{stats.totalThoughts.toLocaleString()}</StatNumber>
            <StatLabel>
              <Users size={16} />
              Total Thoughts
            </StatLabel>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.todayThoughts.toLocaleString()}</StatNumber>
            <StatLabel>
              <Clock size={16} />
              Today
            </StatLabel>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.uniqueThemes.toLocaleString()}</StatNumber>
            <StatLabel>
              <Hash size={16} />
              Themes Today
            </StatLabel>
          </StatCard>
        </StatsContainer>
      </Header>

      <MainContent>
        <LeftColumn>
          <SubmissionCard>
            <form onSubmit={handleSubmit}>
              <TextArea
                value={newThought}
                onChange={(e) => setNewThought(e.target.value)}
                placeholder="What are you thinking right now? Share your thoughts anonymously..."
                maxLength={MAX_LENGTH}
                disabled={!rateLimitStatus.canPost}
              />
              <CharCount isNearLimit={newThought.length > MAX_LENGTH * 0.8}>
                {newThought.length}/{MAX_LENGTH}
              </CharCount>
              
              <SubmitButton type="submit" disabled={!canSubmit}>
                <Send size={16} />
                {isSubmitting ? 'Sharing...' : 'Share Thought'}
              </SubmitButton>
            </form>
            
            {!rateLimitStatus.canPost && countdown && (
              <RateLimitInfo>
                <Timer size={16} />
                You can share your next thought in <CountdownTimer>{countdown}</CountdownTimer>
              </RateLimitInfo>
            )}
            
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}
          </SubmissionCard>

          <ThoughtsContainer ref={thoughtsRef}>
            <LiveIndicator>
              Live Stream
            </LiveIndicator>
            
            <SectionHeader>
              <Brain size={24} />
              Recent Thoughts
            </SectionHeader>
            
            {thoughts.length === 0 ? (
              <ThoughtItem>
                <ThoughtContent style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                  No thoughts yet. Be the first to share what you're thinking!
                </ThoughtContent>
              </ThoughtItem>
            ) : (
              thoughts.map((thought) => (
                <ThoughtItem key={thought.id} isNew={newThoughtIds.has(thought.id)}>
                  <ThoughtContent>{thought.content}</ThoughtContent>
                  <ThoughtTime>
                    <Clock size={14} />
                    {formatTime(thought.timestamp)}
                  </ThoughtTime>
                </ThoughtItem>
              ))
            )}
          </ThoughtsContainer>
        </LeftColumn>

        <RightColumn>
          <LeaderboardContainer>
            <SectionHeader>
              <TrendingUp size={24} />
              Trending Thoughts
            </SectionHeader>
            
            {leaderboard.length === 0 ? (
              <EmptyState>
                No trending themes yet.<br />
                Similar thoughts will appear here!
              </EmptyState>
            ) : (
              leaderboard.map((item) => (
                <LeaderboardItem key={item.theme} isNew={newLeaderboardThemes.has(item.theme)}>
                  <LeaderboardHeader>
                    <ThemeText>{item.theme}</ThemeText>
                    <ThemeCount>{item.count}</ThemeCount>
                  </LeaderboardHeader>
                  <ExampleThoughts>
                    {item.examples.map((example, index) => (
                      <ExampleThought key={index}>
                        "{example}"
                      </ExampleThought>
                    ))}
                  </ExampleThoughts>
                </LeaderboardItem>
              ))
            )}
          </LeaderboardContainer>
        </RightColumn>
      </MainContent>
    </Container>
  );
}

export default App;
