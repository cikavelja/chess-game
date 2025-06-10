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

export type ChessSkillLevel = 
  | 'beginner'      // < 1000
  | 'novice'        // 1000-1199
  | 'intermediate'  // 1200-1599
  | 'advanced'      // 1600-1999
  | 'expert'        // 2000-2199
  | 'cm'            // Candidate Master ≥ 2200
  | 'fm'            // FIDE Master ≥ 2300
  | 'im'            // International Master ≥ 2400
  | 'gm';           // Grandmaster ≥ 2500

export interface ChessSkillLevelInfo {
  id: ChessSkillLevel;
  name: string;
  rating: string;
  description: string;
}

export interface AutoResponseSettings {
  enabled: boolean;
  skillLevel: ChessSkillLevel;
  responseDelay: number; // milliseconds
}
