import React from 'react';
import { ChessPiece, ChessPosition } from '../types/chess-types';
import { getPieceSymbol } from '../utils/chess-utils';

interface ChessSquareProps {
  piece: ChessPiece | null;
  position: ChessPosition;
  isSelected: boolean;
  isValidMove: boolean;
  isCheck: boolean;
  onClick: (position: ChessPosition) => void;
}

const ChessSquare: React.FC<ChessSquareProps> = ({
  piece,
  position,
  isSelected,
  isValidMove,
  isCheck,
  onClick,
}) => {
  const { row, col } = position;
  const isDarkSquare = (row + col) % 2 === 1;
    const baseClasses = "w-16 h-16 flex items-center justify-center text-4xl relative";
  const colorClasses = isDarkSquare 
    ? "bg-emerald-800 hover:bg-emerald-700" 
    : "bg-emerald-200 hover:bg-emerald-100";
  const selectedClass = isSelected ? "ring-4 ring-blue-500" : "";
  const validMoveClass = isValidMove 
    ? "after:absolute after:w-4 after:h-4 after:rounded-full after:bg-gray-500/50" 
    : "";
  const checkClass = isCheck ? "bg-red-200 dark-square:bg-red-700" : "";
  
  // Highlight last move
  const lastMoveClass = false ? "ring-2 ring-yellow-400" : "";
  
  return (    <div 
      className={`${baseClasses} ${colorClasses} ${selectedClass} ${checkClass} ${validMoveClass} ${lastMoveClass} transition-colors duration-200 cursor-pointer`}
      onClick={() => onClick(position)}
    >
      {piece && (
        <span className={`${piece.color === 'white' ? 'text-white' : 'text-black'}`}>
          {getPieceSymbol(piece)}
        </span>
      )}
      {isValidMove && <div className={validMoveClass}></div>}
    </div>
  );
};

export default ChessSquare;
