import React from 'react';
import { PieceColor } from '../types/chess-types';

interface GameEndDialogProps {
  isOpen: boolean;
  winner: PieceColor | 'draw' | null;
  status: string;
  onNewGame: () => void;
}

const GameEndDialog: React.FC<GameEndDialogProps> = ({
  isOpen,
  winner,
  status,
  onNewGame,
}) => {
  if (!isOpen) return null;

  let title = '';
  let message = '';

  if (winner === 'white' || winner === 'black') {
    title = `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;
    message = status === 'checkmate' ? 'by checkmate' : '';
  } else if (winner === 'draw') {
    title = 'Game Drawn';
    message = status === 'stalemate' ? 'by stalemate' : 'by insufficient material';
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
        <p className="text-center mb-6">{message}</p>
        <div className="flex justify-center">
          <button
            onClick={onNewGame}
            className="bg-blue-500 text-white py-2 px-6 rounded hover:bg-blue-600 transition"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEndDialog;
