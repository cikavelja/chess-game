import { ChessMove, GameState, ChessSkillLevel, AutoResponseSettings, ChessSkillLevelInfo, PieceColor, ChessPosition } from '../types/chess-types';
import { dbService } from './indexedDBService';
import { signalRService, MoveRequestDto, AnalysisRequestDto } from './signalRService';

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface MoveAnalysis {
  move: ChessMove;
  reasoning: string;
  confidence: number;
}

export interface GameAnalysis {
  boardAnalysis: string;
  threats: string[];
  opportunities: string[];
  positionEvaluation: string;
}

export const CHESS_SKILL_LEVELS: ChessSkillLevelInfo[] = [
  { id: 'beginner', name: 'Beginner', rating: '< 1000', description: 'Learning basic rules and moves' },
  { id: 'novice', name: 'Novice', rating: '1000-1199', description: 'Understanding basic tactics' },
  { id: 'intermediate', name: 'Intermediate', rating: '1200-1599', description: 'Solid tactical understanding' },
  { id: 'advanced', name: 'Advanced', rating: '1600-1999', description: 'Strong positional play' },
  { id: 'expert', name: 'Expert', rating: '2000-2199', description: 'Tournament-level player' },
  { id: 'cm', name: 'Candidate Master', rating: '≥ 2200', description: 'Candidate Master level' },
  { id: 'fm', name: 'FIDE Master', rating: '≥ 2300', description: 'FIDE Master level' },
  { id: 'im', name: 'International Master', rating: '≥ 2400', description: 'International Master level' },
  { id: 'gm', name: 'Grandmaster', rating: '≥ 2500', description: 'Grandmaster level' }
];

class OpenAIService {
  private apiKey: string | null = null;
  private selectedModel: string = 'gpt-4';
  private baseUrl = 'https://api.openai.com/v1';
  async init(): Promise<void> {
    // Try to load API key from IndexedDB
    const storedKey = await dbService.getSetting('openai_api_key');
    if (storedKey) {
      this.apiKey = storedKey;
    }

    // Try to load selected model from IndexedDB
    const storedModel = await dbService.getSetting('openai_selected_model');
    if (storedModel) {
      this.selectedModel = storedModel;
    }

    // Initialize SignalR connection
    try {
      await signalRService.connect();
      console.log('✅ OpenAI Service initialized with SignalR');
    } catch (error) {
      console.warn('⚠️ SignalR connection failed, some features may not work:', error);
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    await dbService.saveSetting('openai_api_key', apiKey);
  }

  async getApiKey(): Promise<string | null> {
    if (!this.apiKey) {
      this.apiKey = await dbService.getSetting('openai_api_key');
    }
    return this.apiKey;
  }

  async clearApiKey(): Promise<void> {
    this.apiKey = null;
    await dbService.deleteSetting('openai_api_key');
  }

  async fetchAvailableModels(): Promise<OpenAIModel[]> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Filter to only include chat models
      const chatModels = data.data.filter((model: OpenAIModel) => 
        model.id.includes('gpt') && 
        !model.id.includes('instruct') && 
        !model.id.includes('vision') &&
        !model.id.includes('whisper')
      );

      return chatModels.sort((a: OpenAIModel, b: OpenAIModel) => a.id.localeCompare(b.id));
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      throw error;
    }
  }

  async setSelectedModel(modelId: string): Promise<void> {
    this.selectedModel = modelId;
    await dbService.saveSetting('openai_selected_model', modelId);
  }

  getSelectedModel(): string {
    return this.selectedModel;
  }  async getNextMove(gameState: GameState, moveHistory: ChessMove[]): Promise<MoveAnalysis> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    try {
      // First try SignalR if connected
      if (signalRService.isConnectionEstablished) {
        console.log('🎯 Attempting AI move analysis via SignalR...');        const request: MoveRequestDto = {
          gameState,
          difficulty: 'medium', // Default difficulty
          apiKey: this.apiKey,
          model: this.getSelectedModel()
        };

        try {
          const response = await signalRService.getNextMove(request);
          
          if (response.success && response.suggestedMove) {
            console.log('✅ AI move analysis received via SignalR');
            return {
              move: response.suggestedMove,
              reasoning: response.reasoning || 'No reasoning provided',
              confidence: response.confidence || 0.5
            };
          } else {
            console.warn('⚠️ SignalR returned unsuccessful response, falling back to direct API');
          }
        } catch (signalRError) {
          console.warn('⚠️ SignalR failed, falling back to direct OpenAI API:', signalRError);
        }
      } else {
        console.log('⚠️ SignalR not connected, using direct OpenAI API');
      }

      // Fallback to direct OpenAI API call
      console.log('🔄 Using direct OpenAI API for move analysis...');
      
      const fenPosition = this.convertGameStateToFEN(gameState);
      const moveHistoryText = this.convertMoveHistoryToText(moveHistory);
      
      const prompt = this.createMovePrompt(fenPosition, moveHistoryText, gameState.currentTurn);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a chess grandmaster AI. Analyze the position and suggest the best move.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      return this.parseMoveResponse(content, gameState);
    } catch (error) {
      console.error('Error getting move from AI:', error);
      throw error;
    }
  }  async analyzePosition(gameState: GameState): Promise<GameAnalysis> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    try {
      // First try SignalR if connected
      if (signalRService.isConnectionEstablished) {
        console.log('🎯 Attempting position analysis via SignalR...');
          try {          const request: AnalysisRequestDto = {
            gameState,
            apiKey: this.apiKey,
            model: this.getSelectedModel()
          };
          const analysis = await signalRService.analyzePosition(request);
          
          console.log('✅ Position analysis received via SignalR');
          return {
            boardAnalysis: analysis.boardAnalysis,
            threats: analysis.threats,
            opportunities: analysis.opportunities,
            positionEvaluation: analysis.positionEvaluation
          };
        } catch (signalRError) {
          console.warn('⚠️ SignalR failed, falling back to direct OpenAI API:', signalRError);
        }
      } else {
        console.log('⚠️ SignalR not connected, using direct OpenAI API');
      }

      // Fallback to direct OpenAI API call
      console.log('🔄 Using direct OpenAI API for position analysis...');
      
      const fenPosition = this.convertGameStateToFEN(gameState);
      const prompt = this.createAnalysisPrompt(fenPosition, gameState.currentTurn);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a chess analysis expert. Provide detailed position analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      return this.parseAnalysisResponse(content);
    } catch (error) {
      console.error('Error analyzing position:', error);
      throw error;
    }
  }

  async analyzeGame(moves: ChessMove[], result: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    try {
      const moveHistoryText = this.convertMoveHistoryToText(moves);
      const prompt = `Analyze this chess game and identify critical mistakes:

Game moves: ${moveHistoryText}
Game result: ${result}

Please provide:
1. Key turning points in the game
2. Critical mistakes made by both sides
3. Missed opportunities
4. Overall assessment of the game quality

Focus on the most important moments that decided the game.`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a chess grandmaster providing post-game analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing game with OpenAI:', error);
      throw error;
    }
  }  // Auto-response settings methods
  async setAutoResponseSettings(settings: AutoResponseSettings): Promise<void> {
    await dbService.saveSetting('autoResponseSettings', settings);
  }

  async getAutoResponseSettings(): Promise<AutoResponseSettings> {
    const settings = await dbService.getSetting('autoResponseSettings');
    return settings || {
      enabled: false,
      skillLevel: 'intermediate',
      responseDelay: 1000
    };
  }

  async clearAutoResponseSettings(): Promise<void> {
    await dbService.deleteSetting('autoResponseSettings');
  }

  // Response timeout settings methods
  async setResponseTimeout(timeout: number): Promise<void> {
    await dbService.saveSetting('openai_response_timeout', timeout.toString());
  }

  async getResponseTimeout(): Promise<number> {
    const timeout = await dbService.getSetting('openai_response_timeout');
    return timeout ? parseInt(timeout, 10) : 30; // Default 30 seconds
  }

  async clearResponseTimeout(): Promise<void> {
    await dbService.deleteSetting('openai_response_timeout');
  }  // Generate AI move with skill level consideration
  async generateMoveForSkillLevel(
    gameState: GameState,
    moveHistory: ChessMove[],
    skillLevel: ChessSkillLevel,
    retryCount = 0
  ): Promise<ChessMove | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Helper for board bounds
    const isPositionOnBoard = (pos: any) =>
      pos && typeof pos.row === 'number' && typeof pos.col === 'number' &&
      pos.row >= 0 && pos.row <= 7 && pos.col >= 0 && pos.col <= 7;

    try {
      // First try SignalR if connected
      if (signalRService.isConnectionEstablished) {
        console.log('🎯 Attempting AI move via SignalR...');
        // Map skill level to difficulty string
        const difficultyMap: Record<ChessSkillLevel, string> = {
          'beginner': 'easy',
          'novice': 'easy',
          'intermediate': 'medium',
          'advanced': 'medium',
          'expert': 'hard',
          'cm': 'hard',
          'fm': 'master',
          'im': 'master',
          'gm': 'master'
        };
        const request: MoveRequestDto = {
          gameState,
          difficulty: difficultyMap[skillLevel] || 'medium',
          apiKey,
          model: this.getSelectedModel()
        };

        try {
          const response = await signalRService.getNextMove(request);
          if (response.success && response.suggestedMove) {
            // Validate move structure and board bounds
            const move = response.suggestedMove;
            if (
              move.from && move.to &&
              isPositionOnBoard(move.from) && isPositionOnBoard(move.to)
            ) {
              console.log('✅ AI move received via SignalR');
              return move;
            } else {
              console.warn(`⚠️ Invalid move positions from SignalR (attempt ${retryCount + 1}/3):`, move);
              if (retryCount < 2) {
                return this.generateMoveForSkillLevel(gameState, moveHistory, skillLevel, retryCount + 1);
              }
              return null;
            }
          } else {
            console.warn('⚠️ SignalR returned unsuccessful response, falling back to direct API');
          }
        } catch (signalRError) {
          console.warn('⚠️ SignalR failed, falling back to direct OpenAI API:', signalRError);
        }
      } else {
        console.log('⚠️ SignalR not connected, using direct OpenAI API');
      }

      // Fallback to direct OpenAI API call
      console.log('🔄 Using direct OpenAI API for AI move...');

      const selectedModel = this.getSelectedModel();
      if (!selectedModel) {
        throw new Error('No AI model selected');
      }

      const fen = this.convertGameStateToFEN(gameState);
      const moveHistoryStr = this.convertMoveHistoryToText(moveHistory);
      const prompt = this.createSkillLevelMovePrompt(fen, moveHistoryStr, gameState.currentTurn, skillLevel);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a chess AI assistant. Always respond with a single chess move in algebraic notation (e.g., e2e4, Nf3, O-O).'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 50,
          temperature: this.getTemperatureForSkillLevel(skillLevel)
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const moveText = data.choices[0]?.message?.content?.trim();

      if (!moveText) {
        throw new Error('No move received from AI');
      }

      let move: ChessMove | null = null;
      try {
        move = this.parseSimpleAIMove(moveText);
      } catch (parseError) {
        console.warn('⚠️ Error parsing AI move, retrying...', parseError);
      }

      // Validate move structure and board bounds
      if (
        move &&
        move.from && move.to &&
        isPositionOnBoard(move.from) && isPositionOnBoard(move.to)
      ) {
        console.log('✅ AI move received via direct API');
        return move;
      } else {
        console.warn(`⚠️ Invalid move positions from OpenAI (attempt ${retryCount + 1}/3):`, moveText, move);
        if (retryCount < 2) {
          return this.generateMoveForSkillLevel(gameState, moveHistory, skillLevel, retryCount + 1);
        }
        return null;
      }
    } catch (error) {
      console.error('❌ Error generating AI move:', error);
      return null;
    }
  }

  private createMovePrompt(fen: string, moveHistory: string, currentTurn: PieceColor): string {
    return `Given the following chess position and move history:

FEN: ${fen}
Current turn: ${currentTurn}
Move history: ${moveHistory}

Please suggest the best move and respond in this exact JSON format:
{
  "move": "e2e4",
  "reasoning": "Brief explanation of why this move is good",
  "confidence": 0.85
}

The move should be in algebraic notation (from-square to-square, like 'e2e4').
Confidence should be between 0 and 1.`;
  }

  private createAnalysisPrompt(fen: string, currentTurn: PieceColor): string {
    return `Analyze this chess position:

FEN: ${fen}
Current turn: ${currentTurn}

Provide analysis in this JSON format:
{
  "boardAnalysis": "Overall position assessment",
  "threats": ["List of immediate threats"],
  "opportunities": ["List of tactical opportunities"],
  "positionEvaluation": "Advantage assessment"
}`;
  }

  private createSkillLevelMovePrompt(fen: string, moveHistory: string, currentTurn: PieceColor, skillLevel: ChessSkillLevel): string {
    const skillInfo = CHESS_SKILL_LEVELS.find(level => level.id === skillLevel);
    const skillDescription = skillInfo ? `${skillInfo.name} (${skillInfo.rating})` : 'Intermediate';
    
    let instructions = '';
    
    switch (skillLevel) {
      case 'beginner':
        instructions = 'Play like a beginner (rating < 1000). Focus on basic moves, avoid complex tactics, sometimes make suboptimal moves, prioritize piece development and simple threats.';
        break;
      case 'novice':
        instructions = 'Play like a novice (rating 1000-1199). Understand basic tactics like forks and pins, but occasionally miss them. Make generally sound moves with some inaccuracies.';
        break;
      case 'intermediate':
        instructions = 'Play like an intermediate player (rating 1200-1599). Use solid tactical understanding, recognize most basic patterns, but may miss deeper combinations.';
        break;
      case 'advanced':
        instructions = 'Play like an advanced player (rating 1600-1999). Show strong positional understanding, good tactical vision, and strategic planning.';
        break;
      case 'expert':
        instructions = 'Play like an expert (rating 2000-2199). Demonstrate tournament-level play with excellent tactics, positional understanding, and opening knowledge.';
        break;
      case 'cm':
        instructions = 'Play like a Candidate Master (rating ≥ 2200). Show master-level understanding of chess principles, deep calculation, and refined technique.';
        break;
      case 'fm':
        instructions = 'Play like a FIDE Master (rating ≥ 2300). Demonstrate professional-level chess understanding with precise calculation and strategic depth.';
        break;
      case 'im':
        instructions = 'Play like an International Master (rating ≥ 2400). Show near-grandmaster level play with exceptional tactical vision and positional mastery.';
        break;
      case 'gm':
        instructions = 'Play like a Grandmaster (rating ≥ 2500). Demonstrate the highest level of chess understanding with perfect technique, deep calculation, and creative solutions.';
        break;
      default:
        instructions = 'Play at an intermediate level with solid understanding of chess principles.';
    }

    return `
You are playing chess at the ${skillDescription} level.

${instructions}

Current position (FEN): ${fen}
Current turn: ${currentTurn}
Move history: ${moveHistory || 'Game start'}

IMPORTANT: Only suggest moves that are valid on a standard 8x8 chessboard. The move must use valid board coordinates (a-h for files, 1-8 for ranks). Do not suggest moves that are off the board or use invalid squares. The move should be in algebraic notation (e.g., e2e4, Nf3, O-O-O).

Please provide your next move in algebraic notation (e.g., e2e4, Nf3, O-O-O).
    `.trim();
  }

  private getTemperatureForSkillLevel(skillLevel: ChessSkillLevel): number {
    // Higher temperature for lower skill levels to introduce more variation/mistakes
    switch (skillLevel) {
      case 'beginner': return 0.9;
      case 'novice': return 0.8;
      case 'intermediate': return 0.6;
      case 'advanced': return 0.4;
      case 'expert': return 0.3;
      case 'cm': return 0.2;
      case 'fm': return 0.1;
      case 'im': return 0.05;
      case 'gm': return 0.0;
      default: return 0.6;
    }
  }

  private parseMoveResponse(content: string, gameState: GameState): MoveAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      const moveStr = jsonData.move;
      
      if (!moveStr || moveStr.length < 4) {
        throw new Error('Invalid move format');
      }      const fromSquare = moveStr.substring(0, 2);
      const toSquare = moveStr.substring(2, 4);

      const move: ChessMove = {
        from: this.algebraicToPosition(fromSquare),
        to: this.algebraicToPosition(toSquare),
        capturedPiece: null,
      };

      return {
        move,
        reasoning: jsonData.reasoning || 'No reasoning provided',
        confidence: jsonData.confidence || 0.5,
      };
    } catch (error) {
      console.error('Error parsing move response:', error);
      throw new Error('Failed to parse AI response');
    }
  }

  private parseAnalysisResponse(content: string): GameAnalysis {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fallback to plain text analysis
        return {
          boardAnalysis: content,
          threats: [],
          opportunities: [],
          positionEvaluation: 'Analysis provided',
        };
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      return {
        boardAnalysis: jsonData.boardAnalysis || 'No analysis provided',
        threats: jsonData.threats || [],
        opportunities: jsonData.opportunities || [],
        positionEvaluation: jsonData.positionEvaluation || 'Unknown',
      };
    } catch (error) {
      console.error('Error parsing analysis response:', error);
      return {
        boardAnalysis: content,
        threats: [],
        opportunities: [],
        positionEvaluation: 'Analysis provided',
      };
    }
  }
  private algebraicToPosition(notation: string): ChessPosition {
    if (!notation || notation.length < 2) {
      throw new Error(`Invalid algebraic notation: ${notation}`);
    }
    
    const file = notation.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(notation[1]);
    
    if (file < 0 || file > 7 || isNaN(rank) || rank < 1 || rank > 8) {
      throw new Error(`Invalid algebraic notation: ${notation} (file: ${file}, rank: ${rank})`);
    }
    
    const row = 8 - rank;
    return { row, col: file };
  }

  private positionToAlgebraic(position: ChessPosition): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + position.col);
    const rank = (8 - position.row).toString();
    return file + rank;
  }

  private convertGameStateToFEN(gameState: GameState): string {
    // Convert board to FEN notation
    let fen = '';
    
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += this.pieceToFEN(piece);
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (row < 7) {
        fen += '/';
      }
    }

    // Add turn, castling, en passant, halfmove, fullmove
    fen += ` ${gameState.currentTurn === 'white' ? 'w' : 'b'} - - 0 1`;
    
    return fen;
  }

  private pieceToFEN(piece: any): string {
    const typeMap: { [key: string]: string } = {
      'pawn': 'p',
      'rook': 'r',
      'knight': 'n',
      'bishop': 'b',
      'queen': 'q',
      'king': 'k',
    };

    const symbol = typeMap[piece.type] || 'p';
    return piece.color === 'white' ? symbol.toUpperCase() : symbol;
  }

  private convertMoveHistoryToText(moves: ChessMove[]): string {
    if (moves.length === 0) return 'Game start';
    
    let text = '';
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = this.moveToAlgebraic(moves[i]);
      const blackMove = i + 1 < moves.length ? this.moveToAlgebraic(moves[i + 1]) : '';
      
      text += `${moveNumber}. ${whiteMove}`;
      if (blackMove) {
        text += ` ${blackMove}`;
      }
      text += ' ';
    }
    
    return text.trim();
  }

  private moveToAlgebraic(move: ChessMove): string {
    const fromAlgebraic = this.positionToAlgebraic(move.from);
    const toAlgebraic = this.positionToAlgebraic(move.to);
    return fromAlgebraic + toAlgebraic;
  }

  private parseSimpleAIMove(moveText: string): ChessMove | null {
    try {
      // Remove any extra whitespace and extract move notation
      const cleanMove = moveText.trim().replace(/[^a-h1-8]/g, '').toLowerCase();
      if (cleanMove.length < 4) {
        return null;
      }

      const fromSquare = cleanMove.substring(0, 2);
      const toSquare = cleanMove.substring(2, 4);

      const from = this.algebraicToPosition(fromSquare);
      const to = this.algebraicToPosition(toSquare);

      // Validate that from and to are on the board
      if (
        from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
        to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7
      ) {
        console.warn('parseSimpleAIMove: Out-of-bounds move:', { from, to });
        return null;
      }

      return {
        from,
        to,
        capturedPiece: null,
      };
    } catch (error) {
      console.error('Error parsing AI move:', error);
      return null;
    }
  }
}

export const openAIService = new OpenAIService();
