import React from 'react';

interface GameControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  canUndo: boolean;
  gameStatus: string;
}

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onUndo,
  canUndo,
  gameStatus,
}) => {
  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow flex flex-col gap-3">
      <h3 className="font-bold">Game Controls</h3>
      
      <button
        onClick={onNewGame}
        className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
      >
        New Game
      </button>
      
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`py-2 px-4 rounded transition ${
          canUndo
            ? 'bg-gray-300 hover:bg-gray-400'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        Undo Move
      </button>
      
      {gameStatus === 'checkmate' && (
        <div className="mt-2 text-red-600 font-bold">
          Checkmate!
        </div>
      )}
      
      {gameStatus === 'stalemate' && (
        <div className="mt-2 text-amber-600 font-bold">
          Stalemate!
        </div>
      )}
      
      {gameStatus === 'check' && (
        <div className="mt-2 text-orange-600 font-bold">
          Check!
        </div>
      )}
    </div>
  );
};

export default GameControls;
