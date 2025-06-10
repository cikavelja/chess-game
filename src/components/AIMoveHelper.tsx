import React, { useState } from 'react';
import { openAIService, MoveAnalysis, GameAnalysis } from '../services/openAIService';
import { GameState, ChessMove } from '../types/chess-types';

interface AIMoveHelperProps {
  gameState: GameState;
  moveHistory: ChessMove[];
  onMoveSelected: (move: ChessMove) => void;
  isVisible: boolean;
}

const AIMoveHelper: React.FC<AIMoveHelperProps> = ({ 
  gameState, 
  moveHistory, 
  onMoveSelected, 
  isVisible 
}) => {
  const [moveAnalysis, setMoveAnalysis] = useState<MoveAnalysis | null>(null);
  const [positionAnalysis, setPositionAnalysis] = useState<GameAnalysis | null>(null);
  const [isGettingMove, setIsGettingMove] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleGetMove = async () => {
    setIsGettingMove(true);
    setError('');
    setMoveAnalysis(null);

    try {
      const apiKey = await openAIService.getApiKey();
      if (!apiKey) {
        setError('OpenAI API key not configured. Please set up OpenAI integration first.');
        return;
      }

      const analysis = await openAIService.getNextMove(gameState, moveHistory);
      setMoveAnalysis(analysis);
    } catch (error) {
      setError('Failed to get AI move suggestion. Please check your OpenAI settings.');
      console.error('Error getting AI move:', error);
    } finally {
      setIsGettingMove(false);
    }
  };

  const handleAnalyzePosition = async () => {
    setIsAnalyzing(true);
    setError('');
    setPositionAnalysis(null);

    try {
      const apiKey = await openAIService.getApiKey();
      if (!apiKey) {
        setError('OpenAI API key not configured. Please set up OpenAI integration first.');
        return;
      }

      const analysis = await openAIService.analyzePosition(gameState);
      setPositionAnalysis(analysis);
    } catch (error) {
      setError('Failed to analyze position. Please check your OpenAI settings.');
      console.error('Error analyzing position:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseMove = () => {
    if (moveAnalysis?.move) {
      onMoveSelected(moveAnalysis.move);
      setMoveAnalysis(null);
    }
  };

  const formatPosition = (position: any) => {
    const file = String.fromCharCode('a'.charCodeAt(0) + position.col);
    const rank = (8 - position.row).toString();
    return file + rank;
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-80">
      <h3 className="text-lg font-bold mb-4 text-center">AI Assistant</h3>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={handleGetMove}
            disabled={isGettingMove}
            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            {isGettingMove ? 'Getting Move...' : 'Get AI Move'}
          </button>
          <button
            onClick={handleAnalyzePosition}
            disabled={isAnalyzing}
            className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {moveAnalysis && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-bold text-sm mb-2">Suggested Move</h4>
            <div className="text-sm space-y-2">
              <div>
                <strong>Move:</strong> {formatPosition(moveAnalysis.move.from)} → {formatPosition(moveAnalysis.move.to)}
              </div>
              <div>
                <strong>Confidence:</strong> {(moveAnalysis.confidence * 100).toFixed(0)}%
              </div>
              <div>
                <strong>Reasoning:</strong> {moveAnalysis.reasoning}
              </div>
              <button
                onClick={handleUseMove}
                className="w-full px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Use This Move
              </button>
            </div>
          </div>
        )}

        {positionAnalysis && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="font-bold text-sm mb-2">Position Analysis</h4>
            <div className="text-sm space-y-2">
              <div>
                <strong>Evaluation:</strong> {positionAnalysis.positionEvaluation}
              </div>
              <div>
                <strong>Analysis:</strong> {positionAnalysis.boardAnalysis}
              </div>
              {positionAnalysis.threats.length > 0 && (
                <div>
                  <strong>Threats:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {positionAnalysis.threats.map((threat, index) => (
                      <li key={index} className="text-xs">{threat}</li>
                    ))}
                  </ul>
                </div>
              )}
              {positionAnalysis.opportunities.length > 0 && (
                <div>
                  <strong>Opportunities:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {positionAnalysis.opportunities.map((opportunity, index) => (
                      <li key={index} className="text-xs">{opportunity}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          Model: {openAIService.getSelectedModel()}
        </div>
      </div>
    </div>
  );
};

export default AIMoveHelper;
