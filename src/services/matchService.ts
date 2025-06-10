import { ChessMove, PieceColor, GameState } from '../types/chess-types';
import { dbService } from './indexedDBService';
import { openAIService } from './openAIService';

export interface Match {
  id: string;
  startTime: Date;
  endTime?: Date;
  moves: ChessMove[];
  modelUsed: string;
  userColor: PieceColor;
  result: 'win' | 'loss' | 'draw' | 'ongoing';
  gameState: GameState;
}

class MatchService {
  private currentMatch: Match | null = null;

  async startNewMatch(userColor: PieceColor, gameState: GameState): Promise<string> {
    const matchId = this.generateMatchId();
    const modelUsed = openAIService.getSelectedModel();
    
    const match: Match = {
      id: matchId,
      startTime: new Date(),
      moves: [],
      modelUsed,
      userColor,
      result: 'ongoing',
      gameState: this.cloneGameState(gameState),
    };

    this.currentMatch = match;
    await dbService.saveMatch(match);
    
    return matchId;
  }

  async addMove(move: ChessMove): Promise<void> {
    if (!this.currentMatch) {
      console.warn('No active match to add move to');
      return;
    }

    this.currentMatch.moves.push(move);
    await dbService.saveMatch(this.currentMatch);
  }

  async updateGameState(gameState: GameState): Promise<void> {
    if (!this.currentMatch) {
      console.warn('No active match to update game state');
      return;
    }

    this.currentMatch.gameState = this.cloneGameState(gameState);
    await dbService.saveMatch(this.currentMatch);
  }

  async endMatch(result: 'win' | 'loss' | 'draw'): Promise<void> {
    if (!this.currentMatch) {
      console.warn('No active match to end');
      return;
    }

    this.currentMatch.result = result;
    this.currentMatch.endTime = new Date();
    await dbService.saveMatch(this.currentMatch);
    
    this.currentMatch = null;
  }

  getCurrentMatch(): Match | null {
    return this.currentMatch;
  }

  async loadMatch(matchId: string): Promise<Match | null> {
    try {
      const match = await dbService.getMatch(matchId);
      return match;
    } catch (error) {
      console.error('Failed to load match:', error);
      return null;
    }
  }

  async getAllMatches(): Promise<Match[]> {
    try {
      return await dbService.getAllMatches();
    } catch (error) {
      console.error('Failed to get all matches:', error);
      return [];
    }
  }

  async getMatchStatistics(): Promise<{
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  }> {
    try {
      const matches = await dbService.getAllMatches();
      const completedMatches = matches.filter(m => m.result !== 'ongoing');
      
      const wins = completedMatches.filter(m => m.result === 'win').length;
      const losses = completedMatches.filter(m => m.result === 'loss').length;
      const draws = completedMatches.filter(m => m.result === 'draw').length;
      
      const winRate = completedMatches.length > 0 ? (wins / completedMatches.length) * 100 : 0;

      return {
        totalGames: completedMatches.length,
        wins,
        losses,
        draws,
        winRate,
      };
    } catch (error) {
      console.error('Failed to get match statistics:', error);
      return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      };
    }
  }

  private generateMatchId(): string {
    return `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private cloneGameState(gameState: GameState): GameState {
    return JSON.parse(JSON.stringify(gameState));
  }
}

export const matchService = new MatchService();
