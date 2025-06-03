import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ChessSquare from './ChessSquare';
import { ChessBoard as ChessBoardType, ChessMove, ChessPosition, GameState, PieceColor, ChessPiece } from '../types/chess-types';
import { initializeBoard, isValidPosition } from '../utils/chess-utils';
import { getValidMoves, isCheckmate, isKingInCheck, isStalemate } from '../utils/move-validation';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface ChessBoardProps {
  onMove?: (move: ChessMove) => void;
  onGameEnd?: (winner: PieceColor | 'draw') => void;
}

const ChessBoard = forwardRef<{resetBoard: () => void, undoLastMove: () => void}, ChessBoardProps>(
  ({ onMove, onGameEnd }, ref) => {  const [gameState, setGameState] = useState<GameState>({
    board: initializeBoard(),
    currentTurn: 'white',
    status: 'playing',
    selectedPosition: null,
    validMoves: [],
    moveHistory: [],
    capturedPieces: {
      white: [] as ChessPiece[],
      black: [] as ChessPiece[],
    },
  });

  // Add sound effects
  const { playMove, playCapture, playCheck, playCastle, playGameEnd } = useSoundEffects();

  // Handle square click
  const handleSquareClick = (position: ChessPosition) => {
    const { board, currentTurn, selectedPosition, validMoves } = gameState;
    const clickedPiece = board[position.row][position.col];

    // If no piece is selected and player clicked on their own piece, select it
    if (!selectedPosition && clickedPiece && clickedPiece.color === currentTurn) {
      const newValidMoves = getValidMoves(board, position);
      setGameState({
        ...gameState,
        selectedPosition: position,
        validMoves: newValidMoves,
      });
      return;
    }

    // If a piece is already selected
    if (selectedPosition) {
      // Clicking on the same piece deselects it
      if (position.row === selectedPosition.row && position.col === selectedPosition.col) {
        setGameState({
          ...gameState,
          selectedPosition: null,
          validMoves: [],
        });
        return;
      }

      // Clicking on another of their own pieces changes selection
      if (clickedPiece && clickedPiece.color === currentTurn) {
        const newValidMoves = getValidMoves(board, position);
        setGameState({
          ...gameState,
          selectedPosition: position,
          validMoves: newValidMoves,
        });
        return;
      }

      // Check if the move is valid
      const isValidMove = validMoves.some(
        move => move.row === position.row && move.col === position.col
      );

      if (isValidMove) {
        makeMove(selectedPosition, position);
      }
    }
  };

  // Execute a chess move
  const makeMove = (from: ChessPosition, to: ChessPosition) => {
    const { board, currentTurn, moveHistory, capturedPieces } = gameState;
    const newBoard = board.map(row => [...row]);
    
    const movingPiece = newBoard[from.row][from.col]!;
    const capturedPiece = newBoard[to.row][to.col];
      // Record the captured piece
    const newCapturedPieces = { 
      white: [...capturedPieces.white],
      black: [...capturedPieces.black]
    };
    
    if (capturedPiece) {
      if (capturedPiece.color === 'white') {
        newCapturedPieces.white.push(capturedPiece);
      } else {
        newCapturedPieces.black.push(capturedPiece);
      }
    }// Check for castling when king moves two squares horizontally
    let isCastle = false;
    if (movingPiece.type === 'king' && Math.abs(from.col - to.col) === 2) {
      isCastle = true;
      
      // Move the rook as well
      const isKingside = to.col > from.col;
      const rookFromCol = isKingside ? 7 : 0;
      const rookToCol = isKingside ? from.col + 1 : from.col - 1;
      
      // Get the rook
      const rook = newBoard[from.row][rookFromCol];
      if (rook) {
        // Move the rook
        newBoard[from.row][rookToCol] = { ...rook, hasMoved: true };
        newBoard[from.row][rookFromCol] = null;
      }
      
      // Play castle sound
      playCastle();
    }    // Reset justMovedTwo flag for all pawns of current player
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = newBoard[row][col];
        if (piece && piece.type === 'pawn' && piece.color === currentTurn && piece.justMovedTwo) {
          newBoard[row][col] = { ...piece, justMovedTwo: false };
        }
      }
    }
    
    // Check for en passant capture
    let isEnPassant = false;
    if (
      movingPiece.type === 'pawn' && 
      from.col !== to.col && 
      !capturedPiece
    ) {
      // This is a diagonal move without a capture - must be en passant
      isEnPassant = true;
      // Remove the pawn that is being captured via en passant
      const capturedPawnRow = from.row;
      const capturedPawnCol = to.col;
      const capturedPawn = newBoard[capturedPawnRow][capturedPawnCol];
      
      if (capturedPawn) {
        // Record the captured piece
        if (capturedPawn.color === 'white') {
          newCapturedPieces.white.push(capturedPawn);
        } else {
          newCapturedPieces.black.push(capturedPawn);
        }
        
        // Remove the captured pawn
        newBoard[capturedPawnRow][capturedPawnCol] = null;
      }
    }
    
    // Check if a pawn just moved two squares (for future en passant captures)
    const isMovingTwoSquares = 
      movingPiece.type === 'pawn' && 
      Math.abs(from.row - to.row) === 2;
    
    // Move the piece with appropriate flags
    newBoard[to.row][to.col] = { 
      ...movingPiece, 
      hasMoved: true,
      justMovedTwo: isMovingTwoSquares
    };
    newBoard[from.row][from.col] = null;    // Record the move
    const move: ChessMove = {
      from,
      to,
      capturedPiece: isEnPassant ? capturedPiece || newBoard[from.row][to.col] : capturedPiece,
      isCastle,
      isEnPassant,
    };
    
    const newMoveHistory = [...moveHistory, move];
    const nextTurn = currentTurn === 'white' ? 'black' : 'white';
    
    // Check game status
    let newStatus = gameState.status;
    
    // Check if king is in check
    const isInCheck = isKingInCheck(newBoard, nextTurn);
    
    // Check for checkmate or stalemate
    if (isCheckmate(newBoard, nextTurn)) {
      newStatus = 'checkmate';
      if (onGameEnd) onGameEnd(currentTurn);
    } else if (isStalemate(newBoard, nextTurn)) {
      newStatus = 'stalemate';
      if (onGameEnd) onGameEnd('draw');
    } else if (isInCheck) {
      newStatus = 'check';
    } else {
      newStatus = 'playing';
    }

  // Play appropriate sound
    if (capturedPiece) {
      playCapture();
    } else if (newStatus === 'checkmate') {
      playGameEnd();
    } else if (newStatus === 'stalemate') {
      playGameEnd();
    } else if (newStatus === 'check') {
      playCheck();
    } else {
      playMove();
    }

    // Update game state
    setGameState({
      board: newBoard,
      currentTurn: nextTurn,
      status: newStatus,
      selectedPosition: null,
      validMoves: [],
      moveHistory: newMoveHistory,
      capturedPieces: newCapturedPieces,
      lastMove: move,
    });
    
    if (onMove) onMove(move);

    // Play sound effects
    playMove();
    if (capturedPiece) playCapture();
    if (newStatus === 'check') playCheck();
    if (newStatus === 'checkmate') playGameEnd();
    if (newStatus === 'stalemate') playGameEnd();
  };

  // Determine if a square is a valid move destination
  const isSquareValidMove = (position: ChessPosition) => {
    return gameState.validMoves.some(
      move => move.row === position.row && move.col === position.col
    );
  };
  // Determine if a square contains the king in check
  const isKingInCheckSquare = (position: ChessPosition): boolean => {
    const { board, status } = gameState;
    if (status !== 'check' && status !== 'checkmate') return false;
    
    const piece = board[position.row][position.col];
    return Boolean(piece && 
           piece.type === 'king' && 
           piece.color === gameState.currentTurn);
  };

  // Render the board
  const renderBoard = () => {
    const rows = [];
    for (let row = 0; row < 8; row++) {
      const cols = [];
      for (let col = 0; col < 8; col++) {
        const position = { row, col };
        const piece = gameState.board[row][col];
        const isSelected = gameState.selectedPosition?.row === row && 
                           gameState.selectedPosition?.col === col;
        
        cols.push(
          <ChessSquare
            key={`${row}-${col}`}
            piece={piece}
            position={position}
            isSelected={isSelected}
            isValidMove={isSquareValidMove(position)}
            isCheck={isKingInCheckSquare(position)}
            onClick={handleSquareClick}
          />
        );
      }
      rows.push(
        <div key={row} className="flex">
          {cols}
        </div>
      );
    }
    return rows;
  };

  const renderBoardNotation = () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    return (
      <>
        <div className="flex ml-6">
          {files.map(file => (
            <div key={file} className="w-16 text-center">
              {file}
            </div>
          ))}
        </div>
        <div className="flex">
          <div className="flex flex-col justify-around h-[32rem] w-6">
            {ranks.map(rank => (
              <div key={rank} className="text-center">
                {rank}
              </div>
            ))}
          </div>
          <div>{renderBoard()}</div>
        </div>
      </>
    );
  };

    // Reset the board to initial state
  const resetBoard = () => {
    setGameState({
      board: initializeBoard(),
      currentTurn: 'white',
      status: 'playing',
      selectedPosition: null,
      validMoves: [],
      moveHistory: [],
      capturedPieces: {
        white: [] as ChessPiece[],
        black: [] as ChessPiece[],
      },
    });
  };

  // Undo the last move
  const undoLastMove = () => {
    const { moveHistory, capturedPieces } = gameState;
    
    if (moveHistory.length === 0) return;
    
    // Get the last move
    const lastMove = moveHistory[moveHistory.length - 1];
    const newMoveHistory = moveHistory.slice(0, -1);
    
    // Create a new board
    const newBoard = gameState.board.map(row => [...row]);
    
    // Move the piece back
    const movingPiece = newBoard[lastMove.to.row][lastMove.to.col];
    if (movingPiece) {
      // Reset the hasMoved flag if this was the piece's first move
      const wasFirstMove = !movingPiece.hasMoved || moveHistory.length === 1;
      newBoard[lastMove.from.row][lastMove.from.col] = {
        ...movingPiece,
        hasMoved: wasFirstMove ? false : true,
      };
    }
    
    // Restore captured piece if any
    if (lastMove.capturedPiece) {
      newBoard[lastMove.to.row][lastMove.to.col] = lastMove.capturedPiece;
    } else {
      newBoard[lastMove.to.row][lastMove.to.col] = null;
    }
      // Handle castling undo
    if (lastMove.isCastle) {
      const row = lastMove.from.row;
      const isKingside = lastMove.to.col > lastMove.from.col;
      
      // Move the rook back
      const rookFromCol = isKingside ? lastMove.from.col + 1 : lastMove.from.col - 1;
      const rookToCol = isKingside ? 7 : 0;
      
      const rook = newBoard[row][rookFromCol];
      if (rook && rook.type === 'rook') {
        newBoard[row][rookToCol] = { ...rook, hasMoved: false };
        newBoard[row][rookFromCol] = null;
      }
    }
    
    // Handle en passant undo
    if (lastMove.isEnPassant && lastMove.capturedPiece) {
      // For en passant, the captured piece position is different from the destination
      const capturedPawnRow = lastMove.from.row;
      const capturedPawnCol = lastMove.to.col;
      
      // Restore the captured pawn to its original position
      newBoard[capturedPawnRow][capturedPawnCol] = lastMove.capturedPiece;
    }
    
    // Create new captured pieces state
    const newCapturedPieces = { 
      white: [...capturedPieces.white], 
      black: [...capturedPieces.black] 
    };
    
    // Remove the last captured piece if any
    if (lastMove.capturedPiece) {
      if (lastMove.capturedPiece.color === 'white') {
        newCapturedPieces.white = newCapturedPieces.white.slice(0, -1);
      } else {
        newCapturedPieces.black = newCapturedPieces.black.slice(0, -1);
      }
    }
    
    // Update game state
    const prevTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    
    setGameState({
      ...gameState,
      board: newBoard,
      currentTurn: prevTurn,
      status: 'playing', // Reset the status
      selectedPosition: null,
      validMoves: [],
      moveHistory: newMoveHistory,
      capturedPieces: newCapturedPieces,
    });
    
    // Play move sound
    playMove();
  };
  
  // Expose functions via ref
  useImperativeHandle(ref, () => ({
    resetBoard,
    undoLastMove,
  }));

  return (
    <div className="inline-block p-4 bg-gray-100 rounded-lg shadow-lg">
      {renderBoardNotation()}
      <div className="mt-2 text-center font-bold">
        {gameState.status === 'check' && `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)} is in check!`}
        {gameState.status === 'checkmate' && `Checkmate! ${gameState.currentTurn === 'white' ? 'Black' : 'White'} wins!`}
        {gameState.status === 'stalemate' && 'Stalemate! The game is a draw.'}
        {gameState.status === 'playing' && `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}'s turn`}
      </div>
    </div>
  );
});

export default ChessBoard;
