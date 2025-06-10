import React, { useState, useEffect } from 'react';
import { matchService } from '../services/matchService';

interface GameStatisticsProps {
  isVisible: boolean;
}

const GameStatistics: React.FC<GameStatisticsProps> = ({ isVisible }) => {
  const [stats, setStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadStatistics();
    }
  }, [isVisible]);

  const loadStatistics = async () => {
    setIsLoading(true);
    try {
      const statistics = await matchService.getMatchStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-bold mb-4 text-center">Game Statistics</h3>
      
      {isLoading ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
              <div className="text-sm text-gray-600">Total Games</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{stats.winRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-green-100 rounded">
              <div className="text-xl font-bold text-green-700">{stats.wins}</div>
              <div className="text-xs text-gray-600">Wins</div>
            </div>
            <div className="text-center p-2 bg-red-100 rounded">
              <div className="text-xl font-bold text-red-700">{stats.losses}</div>
              <div className="text-xs text-gray-600">Losses</div>
            </div>
            <div className="text-center p-2 bg-yellow-100 rounded">
              <div className="text-xl font-bold text-yellow-700">{stats.draws}</div>
              <div className="text-xs text-gray-600">Draws</div>
            </div>
          </div>

          {stats.totalGames > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">Performance Breakdown</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="relative h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 h-full float-left"
                    style={{ width: `${(stats.wins / stats.totalGames) * 100}%` }}
                  ></div>
                  <div 
                    className="bg-yellow-500 h-full float-left"
                    style={{ width: `${(stats.draws / stats.totalGames) * 100}%` }}
                  ></div>
                  <div 
                    className="bg-red-500 h-full float-left"
                    style={{ width: `${(stats.losses / stats.totalGames) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={loadStatistics}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Refresh Stats
          </button>
        </div>
      )}
    </div>
  );
};

export default GameStatistics;
