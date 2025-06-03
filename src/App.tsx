import React, { useRef, useState } from 'react';
import './App.css';
import ChessBoard from './components/ChessBoard';
import CapturedPieces from './components/CapturedPieces';
import MoveHistory from './components/MoveHistory';
import GameControls from './components/GameControls';
import GameEndDialog from './components/GameEndDialog';
import ChessClock from './components/ChessClock';
import { ChessMove, PieceColor } from './types/chess-types';

function App() {
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
  
  const handleMove = (move: ChessMove) => {
    setMoveHistory(prev => [...prev, move]);
    
    // Update captured pieces
    if (move.capturedPiece) {
      setCapturedPieces(prev => {
        if (move.capturedPiece?.color === 'white') {
          return { ...prev, white: [...prev.white, move.capturedPiece] };
        } else {
          return { ...prev, black: [...prev.black, move.capturedPiece] };
        }
      });
    }
  };
  
  const handleGameEnd = (winner: PieceColor | 'draw') => {
    const status = winner === 'draw' ? 'stalemate' : 'checkmate';
    setGameStatus(status);
    setGameWinner(winner);
    setShowGameEndDialog(true);
    console.log('Game ended. Winner:', winner);
  };
  
  const handleTimeUp = (color: PieceColor) => {
    // The player whose time ran out loses
    const winner = color === 'white' ? 'black' : 'white';
    setGameStatus('timeout');
    setGameWinner(winner);
    setShowGameEndDialog(true);
  };
  
  const handleNewGame = () => {
    setMoveHistory([]);
    setCapturedPieces({ white: [], black: [] });
    setGameStatus('playing');
    setShowGameEndDialog(false);
    setGameWinner(null);
    
    // Reset the board
    if (chessBoardRef.current) {
      chessBoardRef.current.resetBoard();
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

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-4xl font-bold text-center mb-8'>Chess Game</h1>
      
      <div className='flex flex-col lg:flex-row gap-8 justify-center items-start'>
        <div>
          <ChessBoard
            ref={chessBoardRef}
            onMove={handleMove}
            onGameEnd={handleGameEnd}
          />
          
          <div className='mt-4'>
            <ChessClock
              key={`${timeControl}-${gameStatus}-${moveHistory.length}`}
              currentTurn={moveHistory.length % 2 === 0 ? 'white' : 'black'}
              isGameActive={gameStatus === 'playing'}
              initialTime={timeControl}
              onTimeUp={handleTimeUp}
            />
          </div>
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
        </div>
      </div>
      
      <GameEndDialog
        isOpen={showGameEndDialog}
        winner={gameWinner}
        status={gameStatus}
        onNewGame={handleNewGame}
      />
    </div>
  );
}

export default App;