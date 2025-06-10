import React, { useState, useEffect } from 'react';
import { openAIService, CHESS_SKILL_LEVELS } from '../services/openAIService';
import { AutoResponseSettings, ChessSkillLevel } from '../types/chess-types';

interface AutoResponseSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const AutoResponseSettingsComponent: React.FC<AutoResponseSettingsProps> = ({ 
  isOpen, 
  onClose, 
  onSettingsUpdated 
}) => {
  const [settings, setSettings] = useState<AutoResponseSettings>({
    enabled: false,
    skillLevel: 'intermediate',
    responseDelay: 1000
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCurrentSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadCurrentSettings = async () => {
    try {
      const currentSettings = await openAIService.getAutoResponseSettings();
      setSettings(currentSettings);
    } catch (error) {
      setError('Failed to load auto-response settings');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Check if OpenAI is configured when enabling auto-response
      if (settings.enabled) {
        const apiKey = await openAIService.getApiKey();
        if (!apiKey) {
          setError('Please configure OpenAI API key first');
          setIsLoading(false);
          return;
        }
      }

      await openAIService.setAutoResponseSettings(settings);
      onSettingsUpdated();
      onClose();
    } catch (error) {
      setError('Failed to save auto-response settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await openAIService.clearAutoResponseSettings();
      setSettings({
        enabled: false,
        skillLevel: 'intermediate',
        responseDelay: 1000
      });
      onSettingsUpdated();
    } catch (error) {
      setError('Failed to clear auto-response settings');
    }
  };

  const getSkillLevelInfo = (skillLevel: ChessSkillLevel) => {
    return CHESS_SKILL_LEVELS.find(level => level.id === skillLevel);
  };

  if (!isOpen) return null;

  return (    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Auto-Response Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable Auto-Response */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Enable Auto-Response</h3>
              <p className="text-sm text-gray-600">
                AI will automatically respond to your moves
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({...settings, enabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Skill Level Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              AI Skill Level
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {CHESS_SKILL_LEVELS.map((level) => (
                <label
                  key={level.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    settings.skillLevel === level.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="skillLevel"
                    value={level.id}
                    checked={settings.skillLevel === level.id}
                    onChange={(e) => setSettings({...settings, skillLevel: e.target.value as ChessSkillLevel})}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{level.name}</span>
                      <span className="text-sm text-blue-600 font-mono">{level.rating}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{level.description}</p>
                  </div>
                  {settings.skillLevel === level.id && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-3">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Response Delay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Delay: {settings.responseDelay / 1000}s
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
              value={settings.responseDelay}
              onChange={(e) => setSettings({...settings, responseDelay: parseInt(e.target.value)})}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5s</span>
              <span>5s</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Delay before AI responds to your moves (makes it feel more natural)
            </p>
          </div>

          {/* Current Selection Preview */}
          {settings.skillLevel && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-1">Selected Configuration</h4>
              <div className="text-sm text-blue-800">
                <div><strong>Level:</strong> {getSkillLevelInfo(settings.skillLevel)?.name}</div>
                <div><strong>Rating:</strong> {getSkillLevelInfo(settings.skillLevel)?.rating}</div>
                <div><strong>Delay:</strong> {settings.responseDelay / 1000} seconds</div>
                <div><strong>Status:</strong> {settings.enabled ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoResponseSettingsComponent;
