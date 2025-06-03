import React from 'react';
import { PieceColor, PieceType } from '../types/chess-types';

interface PawnPromotionDialogProps {
  isOpen: boolean;
  color: PieceColor;
  onPromotion: (pieceType: PieceType) => void;
  onCancel: () => void;
}

const PawnPromotionDialog: React.FC<PawnPromotionDialogProps> = ({
  isOpen,
  color,
  onPromotion,
  onCancel
}) => {
  if (!isOpen) return null;

  const pieces = [
    { type: 'queen' as PieceType, symbol: color === 'white' ? '♕' : '♛', name: 'Queen' },
    { type: 'rook' as PieceType, symbol: color === 'white' ? '♖' : '♜', name: 'Rook' },
    { type: 'bishop' as PieceType, symbol: color === 'white' ? '♗' : '♝', name: 'Bishop' },
    { type: 'knight' as PieceType, symbol: color === 'white' ? '♘' : '♞', name: 'Knight' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Pawn Promotion
          </h2>
          <p className="text-gray-600">
            Choose a piece to promote your pawn to:
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          {pieces.map((piece) => (
            <button
              key={piece.type}
              onClick={() => onPromotion(piece.type)}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform duration-200">
                {piece.symbol}
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                {piece.name}
              </span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PawnPromotionDialog;
