import React from 'react';
import { ChessPiece } from '../types/chess-types';
import { getPieceSymbol } from '../utils/chess-utils';

interface CapturedPiecesProps {
  capturedPieces: {
    white: ChessPiece[];
    black: ChessPiece[];
  };
}

const CapturedPieces: React.FC<CapturedPiecesProps> = ({ capturedPieces }) => {
  // Calculate material advantage based on standard piece values
  const getPieceValue = (piece: ChessPiece): number => {
    const values: Record<string, number> = {
      pawn: 1,
      knight: 3,
      bishop: 3,
      rook: 5,
      queen: 9,
      king: 0, // King is not typically captured
    };
    return values[piece.type] || 0;
  };

  const whiteMaterialValue = capturedPieces.white.reduce(
    (total, piece) => total + getPieceValue(piece), 0
  );
  
  const blackMaterialValue = capturedPieces.black.reduce(
    (total, piece) => total + getPieceValue(piece), 0
  );
  
  const advantage = blackMaterialValue - whiteMaterialValue;

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-100 rounded-lg shadow">
      <div>
        <h3 className="font-bold mb-1">Captured by White</h3>
        <div className="flex flex-wrap gap-1">
          {capturedPieces.black.map((piece, index) => (
            <span key={index} className="text-2xl">
              {getPieceSymbol(piece)}
            </span>
          ))}
          {capturedPieces.black.length === 0 && (
            <span className="text-gray-500 italic">None</span>
          )}
        </div>
      </div>
      
      <div>
        <h3 className="font-bold mb-1">Captured by Black</h3>
        <div className="flex flex-wrap gap-1">
          {capturedPieces.white.map((piece, index) => (
            <span key={index} className="text-2xl">
              {getPieceSymbol(piece)}
            </span>
          ))}
          {capturedPieces.white.length === 0 && (
            <span className="text-gray-500 italic">None</span>
          )}
        </div>
      </div>
      
      {advantage !== 0 && (
        <div className="mt-2">
          <span className="font-bold">
            Material advantage: {advantage > 0 ? 'White' : 'Black'} (+{Math.abs(advantage)})
          </span>
        </div>
      )}
    </div>
  );
};

export default CapturedPieces;
