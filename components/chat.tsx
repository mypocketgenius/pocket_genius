'use client';

// Phase 3, Task 3 & Part 4: Chat UI component with conversation management
// Displays message list, input field, and handles streaming responses

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

interface ChatProps {
  chatbotId: string;
}

/**
 * Chat component that displays messages and handles streaming responses
 * 
 * Features:
 * - Message list with user and assistant messages
 * - Input field for sending messages
 * - Streaming display for real-time response updates
 * - Conversation management (creates new conversation on first message)
 * - Loads existing messages when conversationId is provided
 * - Persists conversationId in localStorage
 * - Error handling and loading states
 */
export default function Chat({ chatbotId }: ChatProps) {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedMessages = useRef(false);

  // Get conversationId from URL params or localStorage on mount
  useEffect(() => {
    // Check URL params first (for sharing links)
    const urlConversationId = searchParams?.get('conversationId');
    if (urlConversationId) {
      setConversationId(urlConversationId);
      // Store in localStorage for persistence
      localStorage.setItem(`conversationId_${chatbotId}`, urlConversationId);
      return;
    }

    // Check localStorage for persisted conversationId
    const storedConversationId = localStorage.getItem(`conversationId_${chatbotId}`);
    if (storedConversationId) {
      setConversationId(storedConversationId);
    }
  }, [chatbotId, searchParams]);

  // Load existing messages when conversationId is available
  useEffect(() => {
    if (!conversationId || hasLoadedMessages.current) return;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      setError(null);

      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`);

        if (!response.ok) {
          // If conversation not found, clear conversationId and start fresh
          if (response.status === 404) {
            setConversationId(null);
            localStorage.removeItem(`conversationId_${chatbotId}`);
            setIsLoadingMessages(false);
            return;
          }

          const errorData = await response.json().catch(() => ({}));
          
          // Provide user-friendly error messages
          let errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
          
          if (response.status === 503) {
            errorMessage = 'Service temporarily unavailable. Please try again.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please refresh the page.';
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        }));

        setMessages(loadedMessages);
        hasLoadedMessages.current = true;
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
        // Clear invalid conversationId
        setConversationId(null);
        localStorage.removeItem(`conversationId_${chatbotId}`);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [conversationId, chatbotId]);

  // Persist conversationId to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(`conversationId_${chatbotId}`, conversationId);
    }
  }, [conversationId, chatbotId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field on mount (after messages are loaded)
  useEffect(() => {
    if (!isLoadingMessages) {
      inputRef.current?.focus();
    }
  }, [isLoadingMessages]);

  /**
   * Sends a message to the chat API and handles streaming response
   */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Create placeholder for assistant message (will be updated via streaming)
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Prepare messages array for API (includes conversation history)
      const messagesForAPI = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: userMessage.content,
        },
      ];

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForAPI,
          chatbotId,
          ...(conversationId && { conversationId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Provide user-friendly error messages based on status code
        let errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment before sending another message.';
        } else if (response.status === 503) {
          errorMessage = errorData.error || 'Service temporarily unavailable. Please try again in a moment.';
        } else if (response.status === 504) {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (response.status === 404) {
          errorMessage = errorData.error || 'Resource not found. Please refresh the page.';
        } else if (response.status >= 500) {
          errorMessage = errorData.error || 'Server error. Please try again later.';
        }
        
        throw new Error(errorMessage);
      }

      // Handle streaming response
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      // Read stream chunks
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk;

          // Update assistant message with streamed content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: streamedContent }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error('Error reading stream:', streamError);
        // If we got some content before the error, keep it
        if (streamedContent.trim().length > 0) {
          // Update message with partial content and error note
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: streamedContent + '\n\n[Response was interrupted. Please try again if needed.]' }
                : msg
            )
          );
        } else {
          // No content received, remove the message and show error
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
          throw new Error('Streaming error. Please try again.');
        }
      }

      // Store conversation ID from response headers
      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && newConversationId !== conversationId) {
        setConversationId(newConversationId);
        // Persist to localStorage
        localStorage.setItem(`conversationId_${chatbotId}`, newConversationId);
      }
    } catch (err) {
      console.error('Chat error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to send message';
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Handle network errors
        if (err.message.includes('Failed to fetch') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        
        // Handle timeout errors
        if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        }
      }
      
      setError(errorMessage);
      
      // Remove the empty assistant message on error (if it still exists)
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  /**
   * Handles Enter key press (sends message) and Shift+Enter (new line)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold">Chat</h1>
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}
        {!isLoadingMessages && messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Ask a question about The Art of War</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">
                {message.content || (message.role === 'assistant' && isLoading ? '...' : '')}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.role === 'assistant' && 
         messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{
              minHeight: '44px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isLoading ? 'Sending...' : 'Press Enter to send, Shift+Enter for new line'}
        </p>
      </div>
    </div>
  );
}
