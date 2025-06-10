import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { ChessMove, GameState } from '../types/chess-types';

export interface MoveResponseDto {
  suggestedMove?: ChessMove;
  reasoning?: string;
  success: boolean;
  error?: string;
  confidence?: number;
}

export interface GameAnalysisDto {
  boardAnalysis: string;
  threats: string[];
  opportunities: string[];
  positionEvaluation: string;
}

export interface MoveRequestDto {
  gameState: GameState;
  difficulty: string;
  apiKey: string;
  model: string;
}

export interface AnalysisRequestDto {
  gameState: GameState;
  apiKey: string;
  model: string;
}

export interface ValidateMoveRequest {
  move: ChessMove;
  gameState: GameState;
}

class SignalRService {
  private connection: HubConnection | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event handlers
  private onMoveGeneratedCallbacks: ((response: MoveResponseDto) => void)[] = [];
  private onPositionAnalyzedCallbacks: ((analysis: GameAnalysisDto) => void)[] = [];
  private onPlayerJoinedCallbacks: ((connectionId: string) => void)[] = [];
  private onPlayerLeftCallbacks: ((connectionId: string) => void)[] = [];
  private onMoveMadeCallbacks: ((move: ChessMove) => void)[] = [];
  private onGameStateUpdatedCallbacks: ((gameState: GameState) => void)[] = [];
  private onConnectedCallbacks: (() => void)[] = [];
  private onDisconnectedCallbacks: (() => void)[] = [];
  async connect(): Promise<void> {
    if (this.connection && this.isConnected) {
      return; // Already connected
    }

    try {
      this.connection = new HubConnectionBuilder()
        .withUrl('http://localhost:5243/chesshub', {
          withCredentials: false, // Set to false for localhost testing
          skipNegotiation: false
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
              return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            }
            return null; // Stop reconnecting
          }
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      await this.connection.start();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ SignalR Connected to ChessHub');
      this.onConnectedCallbacks.forEach(callback => callback());

    } catch (error) {
      console.error('❌ SignalR Connection Error:', error);
      this.isConnected = false;
      
      // Retry connection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Retrying connection in ${this.reconnectDelay * this.reconnectAttempts}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
      
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('MoveGenerated', (response: MoveResponseDto) => {
      this.onMoveGeneratedCallbacks.forEach(callback => callback(response));
    });

    this.connection.on('PositionAnalyzed', (analysis: GameAnalysisDto) => {
      this.onPositionAnalyzedCallbacks.forEach(callback => callback(analysis));
    });

    this.connection.on('PlayerJoined', (connectionId: string) => {
      this.onPlayerJoinedCallbacks.forEach(callback => callback(connectionId));
    });

    this.connection.on('PlayerLeft', (connectionId: string) => {
      this.onPlayerLeftCallbacks.forEach(callback => callback(connectionId));
    });

    this.connection.on('MoveMade', (move: ChessMove) => {
      this.onMoveMadeCallbacks.forEach(callback => callback(move));
    });

    this.connection.on('GameStateUpdated', (gameState: GameState) => {
      this.onGameStateUpdatedCallbacks.forEach(callback => callback(gameState));
    });

    this.connection.onclose((error) => {
      console.log('❌ SignalR Connection Closed:', error);
      this.isConnected = false;
      this.onDisconnectedCallbacks.forEach(callback => callback());
    });

    this.connection.onreconnecting((error) => {
      console.log('🔄 SignalR Reconnecting:', error);
      this.isConnected = false;
    });

    this.connection.onreconnected((connectionId) => {
      console.log('✅ SignalR Reconnected:', connectionId);
      this.isConnected = true;
      this.onConnectedCallbacks.forEach(callback => callback());
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection && this.isConnected) {
      await this.connection.stop();
      this.isConnected = false;
      console.log('🔌 SignalR Disconnected');
    }
  }
  // Chess-specific methods
  async getNextMove(request: MoveRequestDto): Promise<MoveResponseDto> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established. Please check your network connection.');
    }

    try {
      console.log('🎯 Requesting AI move via SignalR:', request);
      const response = await this.connection.invoke('GetNextMove', request);
      console.log('✅ Received AI move response:', response);
      return response;
    } catch (error) {
      console.error('❌ Error getting next move:', error);
      throw new Error(`Failed to get AI move: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async analyzePosition(request: AnalysisRequestDto): Promise<GameAnalysisDto> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established. Please check your network connection.');
    }

    try {
      console.log('🔍 Requesting position analysis via SignalR:', request);
      const response = await this.connection.invoke('AnalyzePosition', request);
      console.log('✅ Received position analysis:', response);
      return response;
    } catch (error) {
      console.error('❌ Error analyzing position:', error);
      throw new Error(`Failed to analyze position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateMove(request: ValidateMoveRequest): Promise<boolean> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established. Please check your network connection.');
    }

    try {
      console.log('✔️ Validating move via SignalR:', request);
      const response = await this.connection.invoke('ValidateMove', request);
      console.log('✅ Move validation result:', response);
      return response;
    } catch (error) {
      console.error('❌ Error validating move:', error);
      throw new Error(`Failed to validate move: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Game room methods
  async joinGame(gameId: string): Promise<void> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established');
    }

    try {
      await this.connection.invoke('JoinGame', gameId);
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }

  async leaveGame(gameId: string): Promise<void> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established');
    }

    try {
      await this.connection.invoke('LeaveGame', gameId);
    } catch (error) {
      console.error('Error leaving game:', error);
      throw error;
    }
  }

  async sendMove(gameId: string, move: ChessMove): Promise<void> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established');
    }

    try {
      await this.connection.invoke('SendMove', gameId, move);
    } catch (error) {
      console.error('Error sending move:', error);
      throw error;
    }
  }

  async sendGameState(gameId: string, gameState: GameState): Promise<void> {
    if (!this.connection || !this.isConnected) {
      throw new Error('SignalR connection not established');
    }

    try {
      await this.connection.invoke('SendGameState', gameId, gameState);
    } catch (error) {
      console.error('Error sending game state:', error);
      throw error;
    }
  }

  // Event subscription methods
  onMoveGenerated(callback: (response: MoveResponseDto) => void): () => void {
    this.onMoveGeneratedCallbacks.push(callback);
    return () => {
      const index = this.onMoveGeneratedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onMoveGeneratedCallbacks.splice(index, 1);
      }
    };
  }

  onPositionAnalyzed(callback: (analysis: GameAnalysisDto) => void): () => void {
    this.onPositionAnalyzedCallbacks.push(callback);
    return () => {
      const index = this.onPositionAnalyzedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onPositionAnalyzedCallbacks.splice(index, 1);
      }
    };
  }

  onPlayerJoined(callback: (connectionId: string) => void): () => void {
    this.onPlayerJoinedCallbacks.push(callback);
    return () => {
      const index = this.onPlayerJoinedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onPlayerJoinedCallbacks.splice(index, 1);
      }
    };
  }

  onPlayerLeft(callback: (connectionId: string) => void): () => void {
    this.onPlayerLeftCallbacks.push(callback);
    return () => {
      const index = this.onPlayerLeftCallbacks.indexOf(callback);
      if (index > -1) {
        this.onPlayerLeftCallbacks.splice(index, 1);
      }
    };
  }

  onMoveMade(callback: (move: ChessMove) => void): () => void {
    this.onMoveMadeCallbacks.push(callback);
    return () => {
      const index = this.onMoveMadeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onMoveMadeCallbacks.splice(index, 1);
      }
    };
  }

  onGameStateUpdated(callback: (gameState: GameState) => void): () => void {
    this.onGameStateUpdatedCallbacks.push(callback);
    return () => {
      const index = this.onGameStateUpdatedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onGameStateUpdatedCallbacks.splice(index, 1);
      }
    };
  }

  onConnected(callback: () => void): () => void {
    this.onConnectedCallbacks.push(callback);
    return () => {
      const index = this.onConnectedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectedCallbacks.splice(index, 1);
      }
    };
  }

  onDisconnected(callback: () => void): () => void {
    this.onDisconnectedCallbacks.push(callback);
    return () => {
      const index = this.onDisconnectedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onDisconnectedCallbacks.splice(index, 1);
      }
    };
  }
  // Utility methods
  get connectionState(): string {
    if (!this.connection) return 'Disconnected';
    return this.connection.state;
  }

  get isConnectionEstablished(): boolean {
    return this.isConnected && this.connection?.state === 'Connected';
  }

  async waitForConnection(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.isConnectionEstablished && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isConnectionEstablished) {
      throw new Error('SignalR connection timeout');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnectionEstablished) {
        return false;
      }
      
      // Try a simple ping to verify the connection
      await this.connection!.invoke('GetNextMove', {
        gameState: null,
        difficulty: 'test'
      });
      
      return true;
    } catch (error) {
      console.warn('Health check failed:', error);
      return false;
    }
  }

  getConnectionInfo(): object {
    return {
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      connectionId: this.connection?.connectionId || null
    };
  }
}

// Export singleton instance
export const signalRService = new SignalRService();
