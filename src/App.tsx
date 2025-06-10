import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import ChessBoard from './components/ChessBoard';
import CapturedPieces from './components/CapturedPieces';
import MoveHistory from './components/MoveHistory';
import GameControls from './components/GameControls';
import ChessClock from './components/ChessClock';
import GameEndDialog from './components/GameEndDialog';
import OpenAISettings from './components/OpenAISettings';
import AutoResponseSettingsComponent from './components/AutoResponseSettings';
import MatchHistory from './components/MatchHistory';
import AIMoveHelper from './components/AIMoveHelper';
import GameStatistics from './components/GameStatistics';
import { ChessMove, PieceColor, GameState, AutoResponseSettings as AutoResponseSettingsType } from './types/chess-types';
import { openAIService } from './services/openAIService';
import { matchService } from './services/matchService';
import { signalRService } from './services/signalRService';

function App() {
  const [aiOpeningMoveError, setAIOpeningMoveError] = useState<string | null>(null);
  const [signalRConnected, setSignalRConnected] = useState(false);
  // Game state is managed in the ChessBoard component
  const [moveHistory, setMoveHistory] = useState<ChessMove[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{white: any[], black: any[]}>({
    white: [],
    black: []
  });
  const [gameStatus, setGameStatus] = useState<string>('playing');
  const [showGameEndDialog, setShowGameEndDialog] = useState(false);
  const [gameWinner, setGameWinner] = useState<PieceColor | 'draw' | null>(null);
  const [timeControl, setTimeControl] = useState(10 * 60); // 10 minutes in seconds
  const chessBoardRef = useRef<any>(null);
  
  // OpenAI and Match Management
  const [showOpenAISettings, setShowOpenAISettings] = useState(false);
  const [showAutoResponseSettings, setShowAutoResponseSettings] = useState(false);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showAIMoveHelper, setShowAIMoveHelper] = useState(false);
  const [showGameStatistics, setShowGameStatistics] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [userColor, setUserColor] = useState<PieceColor>('white');
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [autoResponseSettings, setAutoResponseSettings] = useState<AutoResponseSettingsType>({
    enabled: false,
    skillLevel: 'intermediate',
    responseDelay: 1000
  });  useEffect(() => {
    const loadAppSettings = async () => {
      // Initialize OpenAI service (which will also initialize SignalR)
      await openAIService.init();
      const apiKey = await openAIService.getApiKey();
      setHasOpenAIKey(!!apiKey);
      
      // Load auto-response settings
      try {
        const settings = await openAIService.getAutoResponseSettings();
        setAutoResponseSettings(settings);
      } catch (error) {
        console.error('Failed to load auto-response settings:', error);
      }

      // Set up SignalR connection status handlers
      const unsubscribeConnected = signalRService.onConnected(() => {
        console.log('✅ SignalR connected');
        setSignalRConnected(true);
      });

      const unsubscribeDisconnected = signalRService.onDisconnected(() => {
        console.log('❌ SignalR disconnected');
        setSignalRConnected(false);
      });

      // Cleanup function to unsubscribe when component unmounts
      return () => {
        unsubscribeConnected();
        unsubscribeDisconnected();
      };
    };

    loadAppSettings();
    
    // Cleanup SignalR connection on unmount
    return () => {
      signalRService.disconnect().catch(console.error);
    };
  }, []);

  const handleMove = async (move: ChessMove) => {
    setMoveHistory(prev => [...prev, move]);
    
    // Update captured pieces
    if (move.capturedPiece) {
      setCapturedPieces(prev => ({
        ...prev,
        [move.capturedPiece!.color]: [...prev[move.capturedPiece!.color], move.capturedPiece!]
      }));
    }
      // Record move for current match
    if (currentMatchId) {
      try {
        await matchService.addMove(move);
      } catch (error) {
        console.error('Failed to record move:', error);
      }
    }    // Auto-response: Generate AI move if enabled and the move was made by the user
    if (autoResponseSettings.enabled) {
      // Only generate AI response if it's now the AI's turn (i.e., not the user's turn)
      const currentState = chessBoardRef.current?.getGameState();
      if (currentState && currentState.currentTurn !== userColor) {
        try {
          setTimeout(async () => {
            const aiMove = await openAIService.generateMoveForSkillLevel(
              currentState,
              moveHistory, // Use updated move history
              autoResponseSettings.skillLevel
            );
            if (aiMove) {
              // Validate AI move before applying
              console.log('AI move generated:', aiMove);
              if (
                aiMove.from && aiMove.to &&
                typeof aiMove.from.row === 'number' && typeof aiMove.from.col === 'number' &&
                typeof aiMove.to.row === 'number' && typeof aiMove.to.col === 'number' &&
                chessBoardRef.current
              ) {
                chessBoardRef.current.makeMove(aiMove);
              } else {
                console.error('Invalid AI move structure:', aiMove);
              }
            } else {
              console.error('AI failed to generate a move');
            }
          }, autoResponseSettings.responseDelay);
        } catch (error) {
          console.error('Failed to generate AI move:', error);
        }
      }
    }
  };
    const handleGameEnd = async (winner: PieceColor | 'draw') => {
    const status = winner === 'draw' ? 'stalemate' : 'checkmate';
    setGameStatus(status);
    setGameWinner(winner);
    setShowGameEndDialog(true);
    
    // End current match
    if (currentMatchId) {
      let result: 'win' | 'loss' | 'draw';
      if (winner === 'draw') {
        result = 'draw';
      } else if (winner === userColor) {
        result = 'win';
      } else {
        result = 'loss';
      }
      await matchService.endMatch(result);
      setCurrentMatchId(null);
    }
    
    console.log('Game ended. Winner:', winner);
  };
    const handleTimeUp = async (color: PieceColor) => {
    // The player whose time ran out loses
    const winner = color === 'white' ? 'black' : 'white';
    setGameStatus('timeout');
    setGameWinner(winner);
    setShowGameEndDialog(true);
    
    // End current match
    if (currentMatchId) {
      const result = winner === userColor ? 'win' : 'loss';
      await matchService.endMatch(result);
      setCurrentMatchId(null);
    }
  };
  const handleNewGame = async () => {
    setMoveHistory([]);
    setCapturedPieces({ white: [], black: [] });
    setGameStatus('playing');
    setShowGameEndDialog(false);
    setGameWinner(null);
    setAIOpeningMoveError(null);

    // Reset the board
    if (chessBoardRef.current) {
      chessBoardRef.current.resetBoard();
      const gameState = chessBoardRef.current.getGameState();
      setCurrentGameState(gameState);

      // Start new match if OpenAI is configured
      if (hasOpenAIKey) {
        try {
          const matchId = await matchService.startNewMatch(userColor, gameState);
          setCurrentMatchId(matchId);
        } catch (error) {
          console.error('Failed to start new match:', error);
        }
      }
      // If user is playing as Black and auto-response is enabled, AI should make the first move as White
      if (userColor === 'black' && autoResponseSettings.enabled && hasOpenAIKey) {
        setAIOpeningMoveError(null);
        let aiMoveMade = false;
        console.log('🎯 Starting AI opening move for Black player...');
        try {
          // Use a longer delay to ensure the board is completely reset
          setTimeout(async () => {
            try {              const currentSettings = await openAIService.getAutoResponseSettings();
              const currentState = chessBoardRef.current?.getGameState();
              if (currentState && currentState.currentTurn === 'white' && currentSettings.enabled) {
                console.log('✅ Generating AI opening move...');
                try {                  const aiMove = await openAIService.generateMoveForSkillLevel(
                    currentState,
                    [],
                    currentSettings.skillLevel
                  );
                  
                  if (aiMove) {
                    // Validate AI move structure
                    console.log('AI opening move generated:', aiMove);
                    if (aiMove.from && aiMove.to && 
                        typeof aiMove.from.row === 'number' && typeof aiMove.from.col === 'number' &&
                        typeof aiMove.to.row === 'number' && typeof aiMove.to.col === 'number' &&
                        chessBoardRef.current) {
                      aiMoveMade = true;
                      chessBoardRef.current.makeMove(aiMove);
                      setAIOpeningMoveError(null);
                      console.log('✅ AI opening move completed!');
                    } else {
                      setAIOpeningMoveError('AI generated invalid move structure. Please check your OpenAI settings.');
                      console.error('❌ Invalid AI move structure:', aiMove);
                    }
                  } else {
                    setAIOpeningMoveError('AI failed to generate a valid opening move. Please check your OpenAI settings.');
                    console.error('❌ Failed to generate AI move or missing board reference');
                  }
                } catch (moveError) {
                  setAIOpeningMoveError(`AI opening move error: ${moveError instanceof Error ? moveError.message : String(moveError)}`);
                  console.error('❌ Error generating AI opening move:', moveError);
                }
              } else {
                setAIOpeningMoveError('AI opening move conditions not met (auto-response disabled or wrong turn).');
                console.error('❌ Invalid conditions for AI move');
              }
            } catch (error) {
              setAIOpeningMoveError('Error during AI opening move: ' + (error instanceof Error ? error.message : String(error)));
              console.error('❌ Error in AI opening move:', error);
            }
          }, 1500);
          // Fallback: after 3 seconds, if no move was made, show error
          setTimeout(() => {
            if (!aiMoveMade) {
              setAIOpeningMoveError('AI did not make the opening move. Please check your OpenAI settings or try again.');
            }
          }, 3000);
        } catch (error) {
          setAIOpeningMoveError('Failed to setup AI opening move: ' + (error instanceof Error ? error.message : String(error)));
          console.error('Failed to setup AI opening move:', error);
        }
      }
    }
  };
  
  const handleUndo = () => {
    if (moveHistory.length === 0) return;
    
    // Remove the last move
    const newHistory = [...moveHistory];
    const lastMove = newHistory.pop();
    setMoveHistory(newHistory);
    
    // Update captured pieces if a piece was captured in the last move
    if (lastMove?.capturedPiece) {
      setCapturedPieces(prev => {
        if (lastMove.capturedPiece?.color === 'white') {
          return {
            ...prev,
            white: prev.white.slice(0, -1)
          };
        } else {
          return {
            ...prev,
            black: prev.black.slice(0, -1)
          };
        }
      });
    }
    
    // Undo the move on the board
    setGameStatus('playing');
    if (chessBoardRef.current) {
      chessBoardRef.current.undoLastMove();
    }
  };
  const handleTimeControlChange = (minutes: number) => {
    setTimeControl(minutes * 60);
  };

  const handleOpenAISettingsUpdated = async () => {
    const apiKey = await openAIService.getApiKey();
    setHasOpenAIKey(!!apiKey);
  };

  const handleAutoResponseSettingsUpdated = async () => {
    try {
      const settings = await openAIService.getAutoResponseSettings();
      setAutoResponseSettings(settings);
    } catch (error) {
      console.error('Failed to load auto-response settings:', error);
    }
  };

  const handleGameStateChange = async (gameState: GameState) => {
    setCurrentGameState(gameState);
    
    // Update match with current game state
    if (currentMatchId) {
      await matchService.updateGameState(gameState);
    }
  };
  const handleAIMoveSelected = (move: ChessMove) => {
    // Validate move object before passing to ChessBoard
    if (!move) {
      console.error('Received null/undefined move from AI');
      return;
    }
    
    if (!move.from || !move.to) {
      console.error('Received move with missing from/to positions:', move);
      return;
    }
    
    if (typeof move.from.row !== 'number' || typeof move.from.col !== 'number' ||
        typeof move.to.row !== 'number' || typeof move.to.col !== 'number') {
      console.error('Received move with invalid position values:', move);
      return;
    }
    
    if (chessBoardRef.current) {
      chessBoardRef.current.makeMove(move);
    }
  };

  const handleReplayMatch = (match: any) => {
    // Close match history dialog
    setShowMatchHistory(false);
    
    // Reset game
    handleNewGame();
    
    // TODO: Implement replay functionality
    // This would involve replaying moves one by one
    console.log('Replaying match:', match);
  };
  const toggleUserColor = async () => {
    const newColor: PieceColor = userColor === 'white' ? 'black' : 'white';
    setUserColor(newColor);
    
    // If there's an active game, restart it with the new color
    if (moveHistory.length > 0 || gameStatus === 'playing') {
      // Small delay to let the color state update
      setTimeout(() => {
        handleNewGame();
      }, 100);
    }  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className="flex justify-between items-center mb-8">
        <h1 className='text-4xl font-bold'>Chess Game</h1>
          {/* Header Controls */}        <div className="flex gap-2">          {/* SignalR Connection Status */}
          <div className={`px-2 py-1 rounded text-xs ${
            signalRService.isConnectionEstablished
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {signalRService.isConnectionEstablished ? '🔗 SignalR Connected' : '⚠️ Direct Mode'}
          </div>
          
          <button
            onClick={() => setShowOpenAISettings(true)}
            className={`px-3 py-2 rounded text-sm ${
              hasOpenAIKey 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            {hasOpenAIKey ? '🤖 AI Settings' : '⚠️ Setup AI'}
          </button>
          
          <button
            onClick={() => setShowAutoResponseSettings(true)}
            disabled={!hasOpenAIKey}
            className={`px-3 py-2 rounded text-sm ${
              autoResponseSettings.enabled
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            } disabled:opacity-50`}
          >
            {autoResponseSettings.enabled ? '🎯 Auto: ON' : '⏸️ Auto: OFF'}
          </button>
          
          <button
            onClick={() => setShowMatchHistory(true)}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            📊 Match History
          </button>
          
          <button
            onClick={() => setShowAIMoveHelper(!showAIMoveHelper)}
            disabled={!hasOpenAIKey}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 text-sm"
          >
            {showAIMoveHelper ? 'Hide AI Helper' : '🧠 AI Helper'}
          </button>
            <button
            onClick={() => setShowGameStatistics(!showGameStatistics)}
            className="px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
          >
            📈 Stats          </button>
        </div>
      </div>
      
      <div className='flex flex-col lg:flex-row gap-8 justify-center items-start relative'>
        <div className="relative">
          <ChessBoard
            ref={chessBoardRef}
            onMove={handleMove}
            onGameEnd={handleGameEnd}
            onGameStateChange={handleGameStateChange}
          />
          
          <div className='mt-4'>
            <ChessClock
              key={`${timeControl}-${gameStatus}-${moveHistory.length}`}
              currentTurn={moveHistory.length % 2 === 0 ? 'white' : 'black'}
              isGameActive={gameStatus === 'playing'}
              initialTime={timeControl}
              onTimeUp={handleTimeUp}
            />
          </div>          {/* User Color Selection */}
          <div className='mt-4 p-3 bg-gray-100 rounded-lg'>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Playing as:</span>
              <button
                onClick={toggleUserColor}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  userColor === 'white' 
                    ? 'bg-white text-black border-2 border-gray-400 hover:bg-gray-50' 
                    : 'bg-black text-white border-2 border-gray-400 hover:bg-gray-800'
                }`}
              >
                {userColor === 'white' ? '♔ White' : '♚ Black'}
              </button>
            </div>
            
            {/* Color Selection Info */}
            <div className="text-xs text-gray-600 mb-2">
              {userColor === 'white' ? (
                <div className="flex items-center gap-1">
                  <span>🎯</span>
                  <span>You move first</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span>⏳</span>
                  <span>AI moves first{autoResponseSettings.enabled ? '' : ' (enable auto-response)'}</span>
                </div>
              )}
            </div>
            
            {/* Auto-Response Status */}
            {autoResponseSettings.enabled && (
              <div className="text-xs text-gray-600 bg-purple-50 border border-purple-200 rounded p-2">
                <div className="flex items-center justify-between">
                  <span>🎯 Auto-Response:</span>
                  <span className="font-medium text-purple-700">
                    {autoResponseSettings.skillLevel.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  AI will respond in {autoResponseSettings.responseDelay / 1000}s
                </div>
                {userColor === 'black' && (
                  <div className="text-xs text-purple-600 mt-1 font-medium">
                    ⚡ AI will make opening move
                  </div>
                )}
                {userColor === 'black' && aiOpeningMoveError && (
                  <div className="text-xs text-red-600 mt-2 font-bold">
                    {aiOpeningMoveError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Move Helper */}
          {showAIMoveHelper && currentGameState && (
            <div className="absolute top-0 right-0 transform translate-x-full ml-4">
              <AIMoveHelper
                gameState={currentGameState}
                moveHistory={moveHistory}
                onMoveSelected={handleAIMoveSelected}
                isVisible={showAIMoveHelper}
              />
            </div>
          )}
        </div>
        
        <div className='flex flex-col gap-6 w-full lg:w-80'>
          <CapturedPieces 
            capturedPieces={capturedPieces}
          />
          
          <MoveHistory moves={moveHistory} />
          
          <GameControls
            onNewGame={handleNewGame}
            onUndo={handleUndo}
            canUndo={moveHistory.length > 0}
            gameStatus={gameStatus}
          />
          
          {/* Time Control Settings */}
          <div className='p-4 bg-gray-100 rounded-lg shadow'>
            <h3 className='font-bold mb-2'>Time Control</h3>
            <select 
              value={timeControl / 60}
              onChange={(e) => handleTimeControlChange(Number(e.target.value))}
              className='w-full p-2 border rounded'
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
            <p className='text-xs text-gray-500 mt-1'>
              Time control applies to new games
            </p>
          </div>

          {/* Game Statistics */}
          <GameStatistics isVisible={showGameStatistics} />
        </div>
      </div>
      
      {/* Dialogs */}
      <GameEndDialog
        isOpen={showGameEndDialog}
        winner={gameWinner}
        status={gameStatus}
        onNewGame={handleNewGame}
      />      <OpenAISettings
        isOpen={showOpenAISettings}
        onClose={() => setShowOpenAISettings(false)}
        onSettingsUpdated={handleOpenAISettingsUpdated}
      />      <AutoResponseSettingsComponent
        isOpen={showAutoResponseSettings}
        onClose={() => setShowAutoResponseSettings(false)}
        onSettingsUpdated={handleAutoResponseSettingsUpdated}
      />

      <MatchHistory
        isOpen={showMatchHistory}
        onClose={() => setShowMatchHistory(false)}
        onReplayMatch={handleReplayMatch}
      />
    </div>
  );
}

export default App;