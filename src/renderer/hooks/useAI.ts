import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AIMessage, ActiveContext, Note } from '@shared/types';

function buildSystemPrompt(context: ActiveContext, notes: Note[]): string {
  return `You are an expert penetration tester AI assistant embedded inside Prowl, an intelligent pentester terminal application.

Primary Target: ${context.primaryTarget || 'not set'}
Discovered Ports: ${context.discoveredPorts.join(', ') || 'none yet'}
Scanned Services: ${context.scannedServices.join(', ') || 'none yet'}
Recent Commands: ${context.recentCommands.slice(0, 5).join(', ') || 'none'}
Recent Terminal Output:
${context.lastCommandOutput.slice(-1500) || '(none)'}

Session Notes:
${notes.map(n => `- ${n.title}: ${n.content.slice(0, 200)}`).join('\n') || '(none)'}

Provide concise, actionable penetration testing guidance. Format commands in code blocks using \`\`\` syntax. Be direct and technical. Focus on the current target context when relevant. Do not provide warnings about legality unless specifically asked — assume the user has authorization.`;
}

export interface UseAIReturn {
  messages: AIMessage[];
  isThinking: boolean;
  hasApiKey: boolean;
  showApiKeyModal: boolean;
  sendMessage: (content: string, context: ActiveContext, notes: Note[]) => Promise<void>;
  saveApiKey: (key: string) => void;
  dismissModal: () => void;
  openModal: () => void;
  clearMessages: () => void;
  appendMessage: (role: 'user' | 'assistant', content: string) => void;
}

export function useAI(): UseAIReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Check if API key exists on mount
  useEffect(() => {
    window.electronAPI.ai.getApiKey().then(setHasApiKey);
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    await window.electronAPI.ai.setApiKey(key);
    setHasApiKey(true);
    setShowApiKeyModal(false);
  }, []);

  const dismissModal = useCallback(() => {
    setShowApiKeyModal(false);
  }, []);

  const openModal = useCallback(() => {
    setShowApiKeyModal(true);
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: AIMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    context: ActiveContext,
    notes: Note[]
  ) => {
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    // Add user message
    const userMsg: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Build messages array for API (include last 10 messages for context)
      const recentMsgs = [...messages, userMsg].slice(-10);
      const apiMessages = recentMsgs.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const systemPrompt = buildSystemPrompt(context, notes);

      // Call through main process proxy — API key never touches renderer
      const assistantContent = await window.electronAPI.ai.send(apiMessages, systemPrompt);

      const assistantMsg: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';

      // If auth error, prompt for new key
      if (errMsg.includes('401') || errMsg.toLowerCase().includes('invalid') || errMsg.toLowerCase().includes('api key')) {
        await window.electronAPI.ai.deleteApiKey();
        setHasApiKey(false);
        setShowApiKeyModal(true);
      }

      const errAssistant: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `Error: ${errMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errAssistant]);
    } finally {
      setIsThinking(false);
    }
  }, [messages, hasApiKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isThinking,
    hasApiKey,
    showApiKeyModal,
    sendMessage,
    saveApiKey,
    dismissModal,
    openModal,
    clearMessages,
    appendMessage,
  };
}
