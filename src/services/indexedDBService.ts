import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChessMove, PieceColor, GameState } from '../types/chess-types';

// Define the database schema
interface ChessGameDB extends DBSchema {
  settings: {
    key: string;
    value: {
      id: string;
      value: any;
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: { 'createdAt': Date };
  };
  matches: {
    key: string;
    value: {
      id: string;
      startTime: Date;
      endTime?: Date;
      moves: ChessMove[];
      modelUsed: string;
      userColor: PieceColor;
      result: 'win' | 'loss' | 'draw' | 'ongoing';
      gameState: GameState;
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: { 
      'startTime': Date;
      'result': 'win' | 'loss' | 'draw' | 'ongoing';
      'userColor': PieceColor;
    };
  };
}

class IndexedDBService {
  private db: IDBPDatabase<ChessGameDB> | null = null;
  private readonly dbName = 'ChessGameDB';
  private readonly dbVersion = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<ChessGameDB>(this.dbName, this.dbVersion, {
      upgrade(db) {        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
          settingsStore.createIndex('createdAt', 'createdAt');
        }

        // Create matches store
        if (!db.objectStoreNames.contains('matches')) {
          const matchesStore = db.createObjectStore('matches', { keyPath: 'id' });
          matchesStore.createIndex('startTime', 'startTime');
          matchesStore.createIndex('result', 'result');
          matchesStore.createIndex('userColor', 'userColor');
        }
      },
    });
  }

  // Settings methods
  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    const setting = {
      id: key,
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db!.put('settings', setting);
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    const setting = await this.db!.get('settings', key);
    return setting?.value;
  }

  async deleteSetting(key: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('settings', key);
  }

  // Match methods
  async saveMatch(matchData: {
    id: string;
    startTime: Date;
    endTime?: Date;
    moves: ChessMove[];
    modelUsed: string;
    userColor: PieceColor;
    result: 'win' | 'loss' | 'draw' | 'ongoing';
    gameState: GameState;
  }): Promise<void> {
    if (!this.db) await this.init();

    const match = {
      ...matchData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db!.put('matches', match);
  }

  async getMatch(id: string): Promise<any> {
    if (!this.db) await this.init();
    return await this.db!.get('matches', id);
  }

  async getAllMatches(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('matches');
  }

  async getMatchesByResult(result: 'win' | 'loss' | 'draw' | 'ongoing'): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAllFromIndex('matches', 'result', result);
  }

  async deleteMatch(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('matches', id);
  }

  async clearAllMatches(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('matches');
  }

  // Utility methods
  async exportData(): Promise<{ settings: any[], matches: any[] }> {
    if (!this.db) await this.init();
    
    const settings = await this.db!.getAll('settings');
    const matches = await this.db!.getAll('matches');
    
    return { settings, matches };
  }

  async importData(data: { settings: any[], matches: any[] }): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['settings', 'matches'], 'readwrite');
    
    // Clear existing data
    await tx.objectStore('settings').clear();
    await tx.objectStore('matches').clear();
    
    // Import new data
    for (const setting of data.settings) {
      await tx.objectStore('settings').put(setting);
    }
    
    for (const match of data.matches) {
      await tx.objectStore('matches').put(match);
    }
    
    await tx.done;
  }
}

export const dbService = new IndexedDBService();
