export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
  justMovedTwo?: boolean;
}

export interface ChessPosition {
  row: number;
  col: number;
}

export interface ChessMove {
  from: ChessPosition;
  to: ChessPosition;
  capturedPiece?: ChessPiece | null;
  promotion?: PieceType;
  isCastle?: boolean;
  isEnPassant?: boolean;
}

export type ChessBoard = (ChessPiece | null)[][];

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface GameState {
  board: ChessBoard;
  currentTurn: PieceColor;
  status: GameStatus;
  selectedPosition: ChessPosition | null;
  validMoves: ChessPosition[];
  moveHistory: ChessMove[];
  capturedPieces: {
    white: ChessPiece[];
    black: ChessPiece[];
  };
  lastMove?: ChessMove;
}
