import React, { useState, useEffect } from 'react';
import { PieceColor } from '../types/chess-types';

interface ChessClockProps {
  currentTurn: PieceColor;
  isGameActive: boolean;
  initialTime: number; // in seconds
  onTimeUp: (color: PieceColor) => void;
}

const ChessClock: React.FC<ChessClockProps> = ({
  currentTurn,
  isGameActive,
  initialTime,
  onTimeUp
}) => {
  const [whiteTime, setWhiteTime] = useState(initialTime);
  const [blackTime, setBlackTime] = useState(initialTime);

  // Reset timers when game state changes
  useEffect(() => {
    if (!isGameActive) {
      return;
    }
  }, [isGameActive]);

  // Timer effect
  useEffect(() => {
    if (!isGameActive) return;
    
    const timer = setInterval(() => {
      if (currentTurn === 'white') {
        setWhiteTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onTimeUp('white');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onTimeUp('black');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTurn, isGameActive, onTimeUp]);

  // Format time as mm:ss
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 rounded-lg shadow">
      <div className={`p-3 rounded-lg ${currentTurn === 'white' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-white'}`}>
        <div className="text-sm text-gray-700">White</div>
        <div className="text-xl font-mono font-bold">{formatTime(whiteTime)}</div>
      </div>
      <div className={`p-3 rounded-lg ${currentTurn === 'black' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-white'}`}>
        <div className="text-sm text-gray-700">Black</div>
        <div className="text-xl font-mono font-bold">{formatTime(blackTime)}</div>
      </div>
    </div>
  );
};

export default ChessClock;
