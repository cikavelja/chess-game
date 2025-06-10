import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import ChessSquare from './ChessSquare';
import PawnPromotionDialog from './PawnPromotionDialog';
import { ChessMove, ChessPosition, GameState, PieceColor, ChessPiece, PieceType } from '../types/chess-types';
import { initializeBoard } from '../utils/chess-utils';
import { getValidMoves, isCheckmate, isKingInCheck, isStalemate } from '../utils/move-validation';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface ChessBoardProps {
  onMove?: (move: ChessMove) => void;
  onGameEnd?: (winner: PieceColor | 'draw') => void;
  onGameStateChange?: (gameState: GameState) => void;
}

const ChessBoard = forwardRef<{resetBoard: () => void, undoLastMove: () => void, getGameState: () => GameState, makeMove: (move: ChessMove) => void}, ChessBoardProps>(
  ({ onMove, onGameEnd, onGameStateChange }, ref) => {
  const [gameState, setGameState] = useState<GameState>({
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

  // Pawn promotion state
  const [showPawnPromotion, setShowPawnPromotion] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: ChessPosition;
    to: ChessPosition;
    color: PieceColor;
  } | null>(null);
  // Add sound effects
  const { playMove, playCapture, playCheck, playCastle, playGameEnd } = useSoundEffects();

  // Call onGameStateChange whenever gameState changes
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState);
    }
  }, [gameState, onGameStateChange]);

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
      );      if (isValidMove) {
        // Check for pawn promotion
        const movingPiece = gameState.board[selectedPosition.row][selectedPosition.col];
        const isPromotionMove = movingPiece?.type === 'pawn' && 
          ((movingPiece.color === 'white' && position.row === 0) ||
           (movingPiece.color === 'black' && position.row === 7));
        
        if (isPromotionMove) {
          // Show pawn promotion dialog
          setPendingPromotion({
            from: selectedPosition,
            to: position,
            color: movingPiece.color
          });
          setShowPawnPromotion(true);
          // Clear selection but don't make the move yet
          setGameState({
            ...gameState,
            selectedPosition: null,
            validMoves: [],
          });
        } else {
          makeMove(selectedPosition, position);
        }
      }
    }
  };  // Execute a chess move
  const makeMove = (from: ChessPosition, to: ChessPosition, promotionPiece?: PieceType) => {
    // Validate input positions
    if (!from || !to || 
        from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
        to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
      console.error('Invalid move positions:', { from, to });
      return;
    }

    const { board, currentTurn, moveHistory, capturedPieces } = gameState;
    const newBoard = board.map(row => [...row]);
    
    const movingPiece = newBoard[from.row][from.col];
    if (!movingPiece) {
      console.error('No piece found at position:', from);
      return;
    }

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
    
    // Handle pawn promotion
    const isPromotion = movingPiece.type === 'pawn' && 
      ((movingPiece.color === 'white' && to.row === 0) ||
       (movingPiece.color === 'black' && to.row === 7));
    
    // Move the piece with appropriate flags and handle promotion
    if (isPromotion && promotionPiece) {
      newBoard[to.row][to.col] = { 
        type: promotionPiece,
        color: movingPiece.color,
        hasMoved: true
      };
    } else {
      newBoard[to.row][to.col] = { 
        ...movingPiece, 
        hasMoved: true,
        justMovedTwo: isMovingTwoSquares
      };
    }
    newBoard[from.row][from.col] = null;    // Record the move
    const move: ChessMove = {
      from,
      to,
      capturedPiece: isEnPassant ? capturedPiece || newBoard[from.row][to.col] : capturedPiece,
      promotion: isPromotion ? promotionPiece : undefined,
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

  // Pawn promotion handlers
  const handlePawnPromotion = (pieceType: PieceType) => {
    if (!pendingPromotion) return;
    
    const { from, to } = pendingPromotion;
    setShowPawnPromotion(false);
    setPendingPromotion(null);
    
    // Execute the move with promotion
    makeMove(from, to, pieceType);
  };
  
  const handlePromotionCancel = () => {
    setShowPawnPromotion(false);
    setPendingPromotion(null);
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
    
    // Reset pawn promotion state
    setShowPawnPromotion(false);
    setPendingPromotion(null);
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
      // Handle pawn promotion undo - restore original pawn
      if (lastMove.promotion) {
        newBoard[lastMove.from.row][lastMove.from.col] = {
          type: 'pawn',
          color: movingPiece.color,
          hasMoved: true, // Pawn that reached promotion had moved
        };
      } else {
        // Reset the hasMoved flag if this was the piece's first move
        const wasFirstMove = !movingPiece.hasMoved || moveHistory.length === 1;
        newBoard[lastMove.from.row][lastMove.from.col] = {
          ...movingPiece,
          hasMoved: wasFirstMove ? false : true,
        };
      }
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
    getGameState: () => gameState,    makeMove: (move: ChessMove) => {
      // Validate the move object structure
      if (!move || !move.from || !move.to) {
        console.error('Invalid move object:', move);
        return;
      }
      
      // Validate position properties
      if (typeof move.from.row !== 'number' || typeof move.from.col !== 'number' ||
          typeof move.to.row !== 'number' || typeof move.to.col !== 'number') {
        console.error('Invalid move positions - non-numeric values:', move);
        return;
      }
      
      makeMove(move.from, move.to, move.promotion);
    },
  }));

  return (
    <div className="inline-block p-4 bg-gray-100 rounded-lg shadow-lg">
      {renderBoardNotation()}
      <div className="mt-2 text-center font-bold">
        {gameState.status === 'check' && `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)} is in check!`}
        {gameState.status === 'checkmate' && `Checkmate! ${gameState.currentTurn === 'white' ? 'Black' : 'White'} wins!`}
        {gameState.status === 'stalemate' && 'Stalemate! The game is a draw.'}
        {gameState.status === 'playing' && `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}'s turn`}
      </div>      {/* Pawn Promotion Dialog */}
      {showPawnPromotion && pendingPromotion && (
        <PawnPromotionDialog 
          isOpen={showPawnPromotion}
          color={pendingPromotion.color}
          onPromotion={handlePawnPromotion}
          onCancel={handlePromotionCancel}
        />
      )}
    </div>
  );
});

export default ChessBoard;
