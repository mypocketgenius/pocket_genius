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

// Feedback state tracking
type FeedbackType = 'helpful' | 'not_helpful' | null;

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
  const [feedbackState, setFeedbackState] = useState<Record<string, FeedbackType>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<Record<string, 'helpful' | 'not_helpful' | null>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedMessages = useRef(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

      // Reload messages to get real database IDs (fixes feedback button issue)
      // This ensures message IDs match database IDs for feedback submission
      // Small delay to ensure database write has completed
      if (newConversationId || conversationId) {
        // Wait a brief moment for database write to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const messagesResponse = await fetch(
            `/api/conversations/${newConversationId || conversationId}/messages`
          );
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const loadedMessages: Message[] = messagesData.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
            }));
            setMessages(loadedMessages);
          }
        } catch (reloadError) {
          // Log but don't fail - messages are already displayed
          console.warn('Failed to reload messages with real IDs:', reloadError);
        }
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

  /**
   * Handles feedback submission (thumbs up/down)
   * Phase 4, Task 2: Thumbs up/down buttons in chat UI
   * Phase 4, Task 4: Visual feedback (button state, toast)
   */
  const handleFeedback = async (messageId: string, feedbackType: 'helpful' | 'not_helpful') => {
    // Prevent duplicate feedback
    if (feedbackState[messageId] || feedbackLoading[messageId]) {
      return;
    }

    // Set loading state for this specific button
    setFeedbackLoading((prev) => ({
      ...prev,
      [messageId]: feedbackType,
    }));

    // Clear any existing toast timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    try {
      const response = await fetch('/api/feedback/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedbackType,
        }),
      });

      if (!response.ok) {
        // Try to parse error response, but handle cases where response isn't JSON
        let errorMessage = 'Failed to submit feedback';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // If not JSON, try to get text
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use default error message
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      // Update feedback state
      setFeedbackState((prev) => ({
        ...prev,
        [messageId]: feedbackType,
      }));

      // Show success toast
      setToast({
        message: feedbackType === 'helpful' ? 'Thanks for your feedback!' : 'Thanks for letting us know.',
        type: 'success',
      });

      // Hide toast after 3 seconds
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      
      // Show error toast
      setToast({
        message: err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.',
        type: 'error',
      });

      // Hide toast after 5 seconds
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 5000);
    } finally {
      // Clear loading state
      setFeedbackLoading((prev) => ({
        ...prev,
        [messageId]: null,
      }));
    }
  };

  // Thumbs up icon SVG
  const ThumbsUpIcon = ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className || 'w-5 h-5'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.145 1.218.804 1.218m-5.921 1.533c.05.28.163.547.327.79a5.99 5.99 0 0 0 .978 2.025m-1.088 3.638c-.08.243-.112.498-.112.758 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-.75-.75h-2.5l.33-1.595a.75.75 0 0 0-.166-.67L12.75 4.5m0 0v12m0 0h-2.5m2.5 0h2.5m0 0h3a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-3"
      />
    </svg>
  );

  // Thumbs down icon SVG (Heroicons outline)
  const ThumbsDownIcon = ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className || 'w-5 h-5'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.821c0-1.358.275-2.666 1.057-3.859.524-.8 1.343-1.558 2.814-1.558 1.256 0 2.123.74 2.715 1.215.313.243.6.51.856.79.255-.28.543-.547.856-.79.592-.475 1.459-1.215 2.715-1.215 1.471 0 2.29.758 2.814 1.558.782 1.193 1.057 2.5 1.057 3.859 0 .618-.023 1.213-.068 1.821-.11 1.021-1.028 1.715-2.054 1.715h-3.126c-.618 0-1.103.476-1.103 1.09 0 .512.385.935.857.935.258 0 .515-.115.715-.315l2.847-2.847a1.125 1.125 0 0 0 1.591-1.591l-3.068-3.068a1.125 1.125 0 0 0-1.591 0l-3.068 3.068a1.125 1.125 0 0 0 1.591 1.591l2.847-2.847c.2-.2.457-.315.715-.315.472 0 .857.423.857.935 0 .614-.485 1.09-1.103 1.09Z"
      />
    </svg>
  );

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

      {/* Toast notification for feedback - Fixed position with animation */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border-2 border-green-300 text-green-800'
              : 'bg-red-50 border-2 border-red-300 text-red-800'
          }`}
          style={{
            animation: 'slideIn 0.3s ease-out',
          }}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => {
                setToast(null);
                if (toastTimeoutRef.current) {
                  clearTimeout(toastTimeoutRef.current);
                  toastTimeoutRef.current = null;
                }
              }}
              className={`ml-2 text-current opacity-70 hover:opacity-100 transition-opacity ${
                toast.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
              aria-label="Close notification"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

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
            <div className={`max-w-[80%] ${message.role === 'assistant' ? 'space-y-2' : ''}`}>
              <div
                className={`rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content || (message.role === 'assistant' && isLoading ? '...' : '')}
                </div>
              </div>
              
              {/* Feedback buttons for assistant messages */}
              {message.role === 'assistant' && message.content && !isLoading && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleFeedback(message.id, 'helpful')}
                    disabled={!!feedbackState[message.id] || !!feedbackLoading[message.id]}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      feedbackState[message.id] === 'helpful'
                        ? 'bg-green-100 text-green-700 border-2 border-green-300 shadow-sm'
                        : feedbackLoading[message.id] === 'helpful'
                        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-wait'
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    title={
                      feedbackState[message.id]
                        ? 'Feedback already submitted'
                        : feedbackLoading[message.id] === 'helpful'
                        ? 'Submitting feedback...'
                        : 'This was helpful'
                    }
                  >
                    {feedbackLoading[message.id] === 'helpful' ? (
                      <svg
                        className="w-5 h-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <ThumbsUpIcon
                        className={
                          feedbackState[message.id] === 'helpful' ? 'w-5 h-5 text-green-600' : 'w-5 h-5'
                        }
                      />
                    )}
                    <span>
                      {feedbackLoading[message.id] === 'helpful' ? 'Submitting...' : 'Helpful'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleFeedback(message.id, 'not_helpful')}
                    disabled={!!feedbackState[message.id] || !!feedbackLoading[message.id]}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      feedbackState[message.id] === 'not_helpful'
                        ? 'bg-red-100 text-red-700 border-2 border-red-300 shadow-sm'
                        : feedbackLoading[message.id] === 'not_helpful'
                        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-wait'
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    title={
                      feedbackState[message.id]
                        ? 'Feedback already submitted'
                        : feedbackLoading[message.id] === 'not_helpful'
                        ? 'Submitting feedback...'
                        : 'This was not helpful'
                    }
                  >
                    {feedbackLoading[message.id] === 'not_helpful' ? (
                      <svg
                        className="w-5 h-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <ThumbsDownIcon
                        className={
                          feedbackState[message.id] === 'not_helpful' ? 'w-5 h-5 text-red-600' : 'w-5 h-5'
                        }
                      />
                    )}
                    <span>
                      {feedbackLoading[message.id] === 'not_helpful' ? 'Submitting...' : 'Not helpful'}
                    </span>
                  </button>
                </div>
              )}
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
