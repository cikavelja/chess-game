import React, { useState, useEffect } from 'react';
import { dbService } from '../services/indexedDBService';
import { openAIService } from '../services/openAIService';
import { ChessMove, PieceColor } from '../types/chess-types';

interface Match {
  id: string;
  startTime: Date;
  endTime?: Date;
  moves: ChessMove[];
  modelUsed: string;
  userColor: PieceColor;
  result: 'win' | 'loss' | 'draw' | 'ongoing';
  createdAt: Date;
}

interface MatchHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayMatch: (match: Match) => void;
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ isOpen, onClose, onReplayMatch }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'draw' | 'ongoing'>('all');
  useEffect(() => {
    if (isOpen) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filter]);

  const loadMatches = async () => {
    setIsLoading(true);
    try {
      let matchList: Match[];
      if (filter === 'all') {
        matchList = await dbService.getAllMatches();
      } else {
        matchList = await dbService.getMatchesByResult(filter);
      }
      
      // Sort by start time (newest first)
      matchList.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setMatches(matchList);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeMatch = async (match: Match) => {
    setSelectedMatch(match);
    setIsAnalyzing(true);
    setAnalysis('');

    try {
      const apiKey = await openAIService.getApiKey();
      if (!apiKey) {
        setAnalysis('OpenAI API key not configured. Please set up OpenAI integration first.');
        return;
      }

      const gameAnalysis = await openAIService.analyzeGame(match.moves, match.result);
      setAnalysis(gameAnalysis);
    } catch (error) {
      setAnalysis('Failed to analyze game. Please check your OpenAI settings.');
      console.error('Error analyzing match:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      try {
        await dbService.deleteMatch(matchId);
        await loadMatches();
        if (selectedMatch?.id === matchId) {
          setSelectedMatch(null);
          setAnalysis('');
        }
      } catch (error) {
        console.error('Failed to delete match:', error);
      }
    }
  };

  const handleClearAllMatches = async () => {
    if (window.confirm('Are you sure you want to delete all match history? This cannot be undone.')) {
      try {
        await dbService.clearAllMatches();
        setMatches([]);
        setSelectedMatch(null);
        setAnalysis('');
      } catch (error) {
        console.error('Failed to clear matches:', error);
      }
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (match: Match) => {
    if (!match.endTime) return 'Ongoing';
    const duration = new Date(match.endTime).getTime() - new Date(match.startTime).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'text-green-600';
      case 'loss': return 'text-red-600';
      case 'draw': return 'text-yellow-600';
      case 'ongoing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const convertMoveHistoryToText = (moves: ChessMove[]) => {
    let text = '';
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moveToAlgebraic(moves[i]);
      const blackMove = i + 1 < moves.length ? moveToAlgebraic(moves[i + 1]) : '';
      
      text += `${moveNumber}. ${whiteMove}`;
      if (blackMove) {
        text += ` ${blackMove}`;
      }
      text += ' ';
    }
    return text.trim();
  };

  const moveToAlgebraic = (move: ChessMove) => {
    const fromFile = String.fromCharCode('a'.charCodeAt(0) + move.from.col);
    const fromRank = (8 - move.from.row).toString();
    const toFile = String.fromCharCode('a'.charCodeAt(0) + move.to.col);
    const toRank = (8 - move.to.row).toString();
    return fromFile + fromRank + toFile + toRank;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 h-5/6 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Match History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Match List */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="flex gap-2 items-center mb-3">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="all">All Matches</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="draw">Draws</option>
                  <option value="ongoing">Ongoing</option>
                </select>
                
                <button
                  onClick={handleClearAllMatches}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center">Loading matches...</div>
              ) : matches.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No matches found
                </div>
              ) : (
                <div className="divide-y">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 ${
                        selectedMatch?.id === match.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedMatch(match)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-medium">
                          {formatDate(match.startTime)}
                        </div>
                        <span className={`text-sm font-medium ${getResultColor(match.result)}`}>
                          {match.result.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Model: {match.modelUsed}</div>
                        <div>Playing as: {match.userColor}</div>
                        <div>Duration: {formatDuration(match)}</div>
                        <div>Moves: {match.moves.length}</div>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReplayMatch(match);
                          }}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        >
                          Replay
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnalyzeMatch(match);
                          }}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                        >
                          Analyze
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMatch(match.id);
                          }}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Match Details / Analysis */}
          <div className="w-1/2 flex flex-col">
            {selectedMatch ? (
              <>
                <div className="p-4 border-b">
                  <h3 className="font-bold mb-2">Match Details</h3>
                  <div className="text-sm space-y-1">
                    <div><strong>Date:</strong> {formatDate(selectedMatch.startTime)}</div>
                    <div><strong>Result:</strong> <span className={getResultColor(selectedMatch.result)}>{selectedMatch.result.toUpperCase()}</span></div>
                    <div><strong>Model:</strong> {selectedMatch.modelUsed}</div>
                    <div><strong>Your Color:</strong> {selectedMatch.userColor}</div>
                    <div><strong>Duration:</strong> {formatDuration(selectedMatch)}</div>
                    <div><strong>Total Moves:</strong> {selectedMatch.moves.length}</div>
                  </div>
                </div>

                <div className="p-4 border-b">
                  <h4 className="font-bold mb-2">Move History</h4>
                  <div className="text-xs font-mono bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                    {convertMoveHistoryToText(selectedMatch.moves) || 'No moves recorded'}
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                  <h4 className="font-bold mb-2">AI Analysis</h4>
                  {isAnalyzing ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      <p className="text-sm text-gray-600 mt-2">Analyzing game...</p>
                    </div>
                  ) : analysis ? (
                    <div className="text-sm whitespace-pre-wrap">{analysis}</div>
                  ) : (
                    <div className="text-gray-500 text-sm">
                      Click "Analyze" to get AI analysis of this game
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a match to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchHistory;
