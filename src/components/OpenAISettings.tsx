import React, { useState, useEffect } from 'react';
import { openAIService, OpenAIModel } from '../services/openAIService';

interface OpenAISettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const OpenAISettings: React.FC<OpenAISettingsProps> = ({ isOpen, onClose, onSettingsUpdated }) => {  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [responseTimeout, setResponseTimeout] = useState(30); // Default 30 seconds
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  useEffect(() => {
    if (isOpen) {
      loadCurrentSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const loadCurrentSettings = async () => {
    try {
      const currentKey = await openAIService.getApiKey();
      const currentModel = openAIService.getSelectedModel();
      const currentTimeout = await openAIService.getResponseTimeout();
      
      setApiKey(currentKey || '');
      setSelectedModel(currentModel);
      setResponseTimeout(currentTimeout || 30);
      
      if (currentKey) {
        await loadModels(currentKey);
      }
    } catch (error) {
      setError('Failed to load current settings');
    }
  };

  const loadModels = async (key: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      await openAIService.setApiKey(key);
      const availableModels = await openAIService.fetchAvailableModels();
      setModels(availableModels);
      
      // If no model is selected, default to gpt-4 or first available
      if (!selectedModel) {
        const defaultModel = availableModels.find(m => m.id === 'gpt-4') || availableModels[0];
        if (defaultModel) {
          setSelectedModel(defaultModel.id);
        }
      }
    } catch (error) {
      setError('Failed to fetch models. Please check your API key.');
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsTestingKey(true);
    setError('');

    try {
      await loadModels(apiKey);
      setIsTestingKey(false);
    } catch (error) {
      setIsTestingKey(false);
      setError('Invalid API key or network error');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!selectedModel) {
      setError('Please select a model');
      return;
    }    try {
      await openAIService.setApiKey(apiKey);
      await openAIService.setSelectedModel(selectedModel);
      await openAIService.setResponseTimeout(responseTimeout);
      onSettingsUpdated();
      onClose();
    } catch (error) {
      setError('Failed to save settings');
    }
  };
  const handleClearKey = async () => {
    try {
      await openAIService.clearApiKey();
      await openAIService.clearResponseTimeout();
      setApiKey('');
      setModels([]);
      setSelectedModel('');
      setResponseTimeout(30);
      setError('');
    } catch (error) {
      setError('Failed to clear API key');
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">OpenAI Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleApiKeySubmit}
                disabled={isTestingKey || !apiKey.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isTestingKey ? 'Testing...' : 'Test'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your API key is stored securely in your browser's IndexedDB
            </p>
          </div>

          {models.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 overflow-y-auto"
              >
                <option value="">Select a model...</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AI Response Timeout Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Response Timeout
            </label>
            <select
              value={responseTimeout}
              onChange={(e) => setResponseTimeout(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={0}>Unlimited (no timeout)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How long to wait for AI responses before timing out
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="text-sm text-gray-600 mt-2">Loading models...</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || !selectedModel || isLoading}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Save Settings
            </button>
            <button
              onClick={handleClearKey}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Key
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

export default OpenAISettings;
