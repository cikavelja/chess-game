import { ChessBoard, ChessMove, ChessPiece, ChessPosition, PieceColor } from '../types/chess-types';
import { isValidPosition } from './chess-utils';

export function getValidMoves(
  board: ChessBoard,
  position: ChessPosition,
  checkForCheck: boolean = true
): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  let moves: ChessPosition[] = [];

  switch (piece.type) {
    case 'pawn':
      moves = getPawnMoves(board, position);
      break;
    case 'rook':
      moves = getRookMoves(board, position);
      break;
    case 'knight':
      moves = getKnightMoves(board, position);
      break;
    case 'bishop':
      moves = getBishopMoves(board, position);
      break;
    case 'queen':
      moves = getQueenMoves(board, position);
      break;
    case 'king':
      moves = getKingMoves(board, position);
      break;
  }

  // Filter moves that would put or leave the king in check
  if (checkForCheck) {
    moves = moves.filter(move => {
      const tempBoard = simulateMove(board, { from: position, to: move });
      return !isKingInCheck(tempBoard, piece.color);
    });
  }

  return moves;
}

function getPawnMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const direction = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 6 : 1;

  // Move forward one square
  const oneForward = { row: position.row + direction, col: position.col };
  if (isValidPosition(oneForward) && !board[oneForward.row][oneForward.col]) {
    moves.push(oneForward);

    // Move forward two squares from starting position
    if (position.row === startRow) {
      const twoForward = { row: position.row + 2 * direction, col: position.col };
      if (!board[twoForward.row][twoForward.col]) {
        moves.push(twoForward);
      }
    }
  }

  // Capture diagonally
  const capturePositions = [
    { row: position.row + direction, col: position.col - 1 },
    { row: position.row + direction, col: position.col + 1 },
  ];

  capturePositions.forEach(pos => {
    if (isValidPosition(pos)) {
      const targetPiece = board[pos.row][pos.col];
      if (targetPiece && targetPiece.color !== piece.color) {
        moves.push(pos);
      }
      
      // En passant logic
      // Check if there's a pawn next to this pawn that just moved two squares
      const enPassantTarget = {
        row: position.row,
        col: pos.col
      };
      
      if (isValidPosition(enPassantTarget)) {
        const adjacentPiece = board[enPassantTarget.row][enPassantTarget.col];
        
        // If the adjacent piece is an opponent's pawn
        if (
          adjacentPiece && 
          adjacentPiece.type === 'pawn' && 
          adjacentPiece.color !== piece.color &&
          adjacentPiece.justMovedTwo // This will be added to the ChessPiece type
        ) {
          moves.push(pos); // Allow capture via en passant
        }
      }
    }
  });

  return moves;
}

function getRookMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  return getStraightMoves(board, position);
}

function getKnightMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const knightOffsets = [
    { row: -2, col: -1 }, { row: -2, col: 1 },
    { row: -1, col: -2 }, { row: -1, col: 2 },
    { row: 1, col: -2 }, { row: 1, col: 2 },
    { row: 2, col: -1 }, { row: 2, col: 1 },
  ];

  knightOffsets.forEach(offset => {
    const targetRow = position.row + offset.row;
    const targetCol = position.col + offset.col;
    const targetPos = { row: targetRow, col: targetCol };

    if (isValidPosition(targetPos)) {
      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push(targetPos);
      }
    }
  });

  return moves;
}

function getBishopMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  return getDiagonalMoves(board, position);
}

function getQueenMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  return [...getStraightMoves(board, position), ...getDiagonalMoves(board, position)];
}

function getKingMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const directions = [
    { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
    { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 },
  ];
  directions.forEach(dir => {
    const targetRow = position.row + dir.row;
    const targetCol = position.col + dir.col;
    const targetPos = { row: targetRow, col: targetCol };

    if (isValidPosition(targetPos)) {
      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push(targetPos);
      }
    }
  });

  // Castling logic
  if (!piece.hasMoved) {
    const row = piece.color === 'white' ? 7 : 0;
    
    // Check kingside castling
    if (canCastle(board, piece.color, 'kingside')) {
      moves.push({ row, col: position.col + 2 });
    }
    
    // Check queenside castling
    if (canCastle(board, piece.color, 'queenside')) {
      moves.push({ row, col: position.col - 2 });
    }
  }

  return moves;
}

function getStraightMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const directions = [
    { row: -1, col: 0 }, // up
    { row: 1, col: 0 },  // down
    { row: 0, col: -1 }, // left
    { row: 0, col: 1 },  // right
  ];

  directions.forEach(dir => {
    let currentRow = position.row + dir.row;
    let currentCol = position.col + dir.col;

    while (isValidPosition({ row: currentRow, col: currentCol })) {
      const currentPiece = board[currentRow][currentCol];
      
      if (!currentPiece) {
        // Empty square
        moves.push({ row: currentRow, col: currentCol });
      } else {
        // Found a piece
        if (currentPiece.color !== piece.color) {
          // Can capture opponent's piece
          moves.push({ row: currentRow, col: currentCol });
        }
        break; // Stop in this direction
      }

      currentRow += dir.row;
      currentCol += dir.col;
    }
  });

  return moves;
}

function getDiagonalMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const directions = [
    { row: -1, col: -1 }, // up-left
    { row: -1, col: 1 },  // up-right
    { row: 1, col: -1 },  // down-left
    { row: 1, col: 1 },   // down-right
  ];

  directions.forEach(dir => {
    let currentRow = position.row + dir.row;
    let currentCol = position.col + dir.col;

    while (isValidPosition({ row: currentRow, col: currentCol })) {
      const currentPiece = board[currentRow][currentCol];
      
      if (!currentPiece) {
        // Empty square
        moves.push({ row: currentRow, col: currentCol });
      } else {
        // Found a piece
        if (currentPiece.color !== piece.color) {
          // Can capture opponent's piece
          moves.push({ row: currentRow, col: currentCol });
        }
        break; // Stop in this direction
      }

      currentRow += dir.row;
      currentCol += dir.col;
    }
  });

  return moves;
}

export function isKingInCheck(board: ChessBoard, color: PieceColor): boolean {
  // Find the king's position
  let kingPosition: ChessPosition | null = null;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  if (!kingPosition) return false; // Should not happen in a valid game

  // Check if any opponent's piece can capture the king
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color !== color) {
        const moves = getValidMoves(board, { row, col }, false);
        if (moves.some(move => move.row === kingPosition!.row && move.col === kingPosition!.col)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function simulateMove(board: ChessBoard, move: Partial<ChessMove>): ChessBoard {
  if (!move.from || !move.to) return board;
  
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from.row][move.from.col];
  
  // Move the piece
  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;
  
  return newBoard;
}

export function isCheckmate(board: ChessBoard, color: PieceColor): boolean {
  // If the king is not in check, it's not checkmate
  if (!isKingInCheck(board, color)) return false;

  // Check if any move by any piece can get the king out of check
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col });
        if (moves.length > 0) {
          return false;
        }
      }
    }
  }

  // No moves available, it's checkmate
  return true;
}

export function isStalemate(board: ChessBoard, color: PieceColor): boolean {
  // If the king is in check, it's not stalemate
  if (isKingInCheck(board, color)) return false;

  // Check if any move is available
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col });
        if (moves.length > 0) {
          return false;
        }
      }
    }
  }

  // No moves available but not in check, it's stalemate
  return true;
}

/**
 * Check if castling is possible for the specified side
 */
function canCastle(board: ChessBoard, color: PieceColor, side: 'kingside' | 'queenside'): boolean {
  const row = color === 'white' ? 7 : 0;
  const kingCol = 4;
  
  // Check if king is in the right position
  const king = board[row][kingCol];
  if (!king || king.type !== 'king' || king.color !== color || king.hasMoved) {
    return false;
  }
  
  // Check for rook and empty squares between king and rook
  if (side === 'kingside') {
    const rookCol = 7;
    const rook = board[row][rookCol];
    
    // Check if rook exists, is the right color, and hasn't moved
    if (!rook || rook.type !== 'rook' || rook.color !== color || rook.hasMoved) {
      return false;
    }
    
    // Check for empty squares between king and rook
    for (let col = kingCol + 1; col < rookCol; col++) {
      if (board[row][col] !== null) {
        return false;
      }
    }
    
    // Check if king would move through or into check
    for (let col = kingCol; col <= kingCol + 2; col++) {
      if (isPositionUnderAttack(board, { row, col }, color)) {
        return false;
      }
    }
    
    return true;
  } else { // queenside
    const rookCol = 0;
    const rook = board[row][rookCol];
    
    // Check if rook exists, is the right color, and hasn't moved
    if (!rook || rook.type !== 'rook' || rook.color !== color || rook.hasMoved) {
      return false;
    }
    
    // Check for empty squares between king and rook
    for (let col = rookCol + 1; col < kingCol; col++) {
      if (board[row][col] !== null) {
        return false;
      }
    }
    
    // Check if king would move through or into check
    for (let col = kingCol; col >= kingCol - 2; col--) {
      if (isPositionUnderAttack(board, { row, col }, color)) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Check if a position is under attack by any opponent pieces
 */
function isPositionUnderAttack(board: ChessBoard, position: ChessPosition, color: PieceColor): boolean {
  // Check all opponent pieces to see if they can attack this position
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color !== color) {
        const moves = getValidMovesWithoutRecursion(board, { row, col });
        if (moves.some(move => move.row === position.row && move.col === position.col)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Get valid moves without checking for check (to avoid infinite recursion)
 */
function getValidMovesWithoutRecursion(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(board, position);
    case 'rook':
      return getRookMoves(board, position);
    case 'knight':
      return getKnightMoves(board, position);
    case 'bishop':
      return getBishopMoves(board, position);
    case 'queen':
      return getQueenMoves(board, position);
    case 'king':
      return getBasicKingMoves(board, position); // Only basic moves, no castling
    default:
      return [];
  }
}

/**
 * Get basic king moves without castling (to avoid infinite recursion)
 */
function getBasicKingMoves(board: ChessBoard, position: ChessPosition): ChessPosition[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const moves: ChessPosition[] = [];
  const directions = [
    { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
    { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 },
  ];

  directions.forEach(dir => {
    const targetRow = position.row + dir.row;
    const targetCol = position.col + dir.col;
    const targetPos = { row: targetRow, col: targetCol };

    if (isValidPosition(targetPos)) {
      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push(targetPos);
      }
    }
  });

  return moves;
}
