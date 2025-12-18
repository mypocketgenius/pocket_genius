'use client';

// Phase 3, Task 3 & Part 4: Chat UI component with conversation management
// Displays message list, input field, and handles streaming responses
// Phase 3.3: Added "Need More" feedback modal

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FeedbackModal } from './feedback-modal';
import { CopyFeedbackModal } from './copy-feedback-modal';
import { Lightbulb, ThumbsUp, ThumbsDown, Copy, Bookmark, ArrowUp } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

// Feedback state tracking
type FeedbackType = 'helpful' | 'not_helpful' | 'need_more' | null;

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
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState('');
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

        // Load feedback state from API response
        const loadedFeedbackState: Record<string, FeedbackType> = {};
        data.messages.forEach((msg: any) => {
          if (msg.feedbackType && (msg.feedbackType === 'helpful' || msg.feedbackType === 'not_helpful' || msg.feedbackType === 'need_more')) {
            loadedFeedbackState[msg.id] = msg.feedbackType;
          }
        });
        setFeedbackState(loadedFeedbackState);

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
            
            // Load feedback state from API response
            const loadedFeedbackState: Record<string, FeedbackType> = {};
            messagesData.messages.forEach((msg: any) => {
              if (msg.feedbackType && (msg.feedbackType === 'helpful' || msg.feedbackType === 'not_helpful' || msg.feedbackType === 'need_more')) {
                loadedFeedbackState[msg.id] = msg.feedbackType;
              }
            });
            setFeedbackState(loadedFeedbackState);
            
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
   * Handles copy button click
   * 
   * Phase 3.4: Copy Button with Feedback
   * 
   * Copies message content to clipboard and opens copy feedback modal immediately.
   * Uses iOS Safari/Chrome fallback for clipboard API compatibility.
   * 
   * Process:
   * 1. Copy content to clipboard (with iOS fallback)
   * 2. Track copy event in database (non-blocking, creates record with copyUsage=null)
   * 3. Open copy feedback modal immediately (no intermediate toast)
   * 
   * Clipboard API Support:
   * - Modern browsers: Uses navigator.clipboard.writeText()
   * - iOS Safari/Chrome: Falls back to document.execCommand('copy') via temporary textarea
   * - Error handling: Shows error toast if copy fails
   * 
   * @param messageId - ID of message being copied
   * @param content - Text content to copy to clipboard
   */
  const handleCopy = async (messageId: string, content: string) => {
    try {
      // Try modern clipboard API first (works in most modern browsers)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for iOS Safari/Chrome and older browsers
        // iOS Safari doesn't support navigator.clipboard in all contexts
        // Create a temporary textarea element positioned off-screen
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
          // Use execCommand as fallback (supported in iOS Safari)
          const successful = document.execCommand('copy');
          if (!successful) {
            throw new Error('execCommand copy failed');
          }
        } finally {
          // Always clean up temporary element
          document.body.removeChild(textarea);
        }
      }

      // Track copy event (non-blocking, creates initial copy feedback record)
      // This creates a Message_Feedback record with feedbackType='copy' and copyUsage=null
      // The record will be updated when user submits usage via modal
      fetch('/api/feedback/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedbackType: 'copy',
        }),
      }).catch((err) => {
        console.error('Error tracking copy event:', err);
        // Don't show error to user - copy still succeeded
        // Tracking failure shouldn't interrupt user flow
      });

      // Show copy feedback modal directly (no intermediate toast)
      // Modal title shows "✓ Copied!" to indicate success
      setCopiedMessageId(messageId);
      setCopyModalOpen(true);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Show error toast if copy fails
      setToast({
        message: 'Failed to copy. Please try again.',
        type: 'error',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3000);
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


  return (
    <div className="flex flex-col h-dvh max-w-4xl mx-auto bg-white">
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

        {messages.map((message, index) => {
          // Find the most recent assistant message
          const mostRecentAssistantMessage = [...messages]
            .reverse()
            .find((msg) => msg.role === 'assistant' && msg.content);
          const isMostRecentAssistant = mostRecentAssistantMessage?.id === message.id;

          return (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`max-w-[100%] ${message.role === 'assistant' ? 'space-y-2' : ''}`}>
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
                  <div className="space-y-3 mt-1">
                    {/* First row: Copy, Save, Expand on this */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {/* Phase 3.4: Copy button */}
                      <button
                        onClick={() => handleCopy(message.id, message.content)}
                        className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95"
                        title="Copy message"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600" />
                        <span>Copy</span>
                      </button>
                      {/* Save button */}
                      <button
                        onClick={() => {
                          // TODO: Implement save functionality
                        }}
                        className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95"
                        title="Save message"
                      >
                        <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600" />
                        <span>Save</span>
                      </button>
                      {/* Expand on this button */}
                      <button
                        onClick={() => {
                          setSelectedMessageId(message.id);
                          setFeedbackModalOpen(true);
                        }}
                        disabled={feedbackState[message.id] === 'need_more'}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                          feedbackState[message.id] === 'need_more'
                            ? 'bg-blue-100 text-blue-700 border border-blue-400 shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                        title={
                          feedbackState[message.id] === 'need_more'
                            ? 'Feedback already submitted'
                            : 'Expand on this topic'
                        }
                      >
                        <Lightbulb className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${feedbackState[message.id] === 'need_more' ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span>Expand on this</span>
                      </button>
                    </div>
                    
                    {/* Second row: Sample text - only for most recent assistant message */}
                    {isMostRecentAssistant && (
                      <div className="flex items-center justify-between gap-4">
                        {/* Sample text */}
                        <span className="text-sm text-gray-600">Placeholder for a list of sources used in this message</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

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
      <div className="border-t border-gray-200 px-3 py-2 bg-gray-200">
        {/* Quick action pills */}
        <div className="mb-2 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <div className="flex flex-col gap-1.5 w-max">
            {/* First row */}
            <div className="flex gap-1.5">
              {/* Helpful button - only for most recent assistant message */}
              {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content && !isLoading && (() => {
                const mostRecentMessage = messages[messages.length - 1];
                return (
                  <button
                    onClick={() => handleFeedback(mostRecentMessage.id, 'helpful')}
                    disabled={!!feedbackState[mostRecentMessage.id] || !!feedbackLoading[mostRecentMessage.id]}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                      feedbackState[mostRecentMessage.id] === 'helpful'
                        ? 'bg-green-200 text-green-800 border border-green-400'
                        : feedbackLoading[mostRecentMessage.id] === 'helpful'
                        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-wait'
                        : 'bg-green-50/60 text-green-600 border border-green-200 hover:bg-green-100 hover:border-green-300'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    title={
                      feedbackState[mostRecentMessage.id]
                        ? 'Feedback already submitted'
                        : feedbackLoading[mostRecentMessage.id] === 'helpful'
                        ? 'Submitting feedback...'
                        : 'This was helpful'
                    }
                  >
                    {feedbackLoading[mostRecentMessage.id] === 'helpful' ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      <span>Helpful</span>
                    )}
                  </button>
                );
              })()}
              <button
                onClick={() => {
                  // TODO: Implement functionality
                }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
              >
                Give me an example
              </button>
              <button
                onClick={() => {
                  // TODO: Implement functionality
                }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
              >
                How would I actually use this?
              </button>
            </div>
            
            {/* Second row */}
            <div className="flex gap-1.5">
              {/* Not helpful button - only for most recent assistant message */}
              {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content && !isLoading && (() => {
                const mostRecentMessage = messages[messages.length - 1];
                return (
                  <button
                    onClick={() => handleFeedback(mostRecentMessage.id, 'not_helpful')}
                    disabled={!!feedbackState[mostRecentMessage.id] || !!feedbackLoading[mostRecentMessage.id]}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                      feedbackState[mostRecentMessage.id] === 'not_helpful'
                        ? 'bg-red-200 text-red-800 border border-red-400'
                        : feedbackLoading[mostRecentMessage.id] === 'not_helpful'
                        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-wait'
                        : 'bg-red-50/60 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    title={
                      feedbackState[mostRecentMessage.id]
                        ? 'Feedback already submitted'
                        : feedbackLoading[mostRecentMessage.id] === 'not_helpful'
                        ? 'Submitting feedback...'
                        : 'This was not helpful'
                    }
                  >
                    {feedbackLoading[mostRecentMessage.id] === 'not_helpful' ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      <span>Not helpful</span>
                    )}
                  </button>
                );
              })()}
              <button
                onClick={() => {
                  // TODO: Implement functionality
                }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
              >
                Who has done this
              </button>
              <button
                onClick={() => {
                  // TODO: Implement functionality
                }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
              >
                Say more about this
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{
              minHeight: '52px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            suppressHydrationWarning
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[52px]"
            title="Send message"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Phase 3.3: "Need More" feedback modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => {
          setFeedbackModalOpen(false);
          setSelectedMessageId('');
        }}
        messageId={selectedMessageId}
        onSuccess={() => {
          // Update feedback state to show button as clicked
          if (selectedMessageId) {
            setFeedbackState((prev) => ({
              ...prev,
              [selectedMessageId]: 'need_more',
            }));
          }
        }}
      />

      {/* Phase 3.4: Copy feedback modal */}
      {/* Opens immediately after copy button is clicked (no intermediate toast) */}
      {/* Uses same toast notification system as helpful/not_helpful feedback for consistency */}
      <CopyFeedbackModal
        open={copyModalOpen}
        onClose={() => {
          setCopyModalOpen(false);
          setCopiedMessageId('');
        }}
        messageId={copiedMessageId}
        onSuccess={() => {
          // Optional: Track that feedback was submitted
          // The API already handles this, so we don't need to update local state
        }}
        onShowToast={(message, type) => {
          // Phase 3.4: Show toast notification (same system as helpful/not_helpful feedback)
          // Clear any existing toast timeout to prevent conflicts
          if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
          }

          // Show toast with appropriate styling
          setToast({
            message,
            type,
          });

          // Hide toast after appropriate time (3s for success, 5s for error)
          toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
            toastTimeoutRef.current = null;
          }, type === 'success' ? 3000 : 5000);
        }}
      />
    </div>
  );
}
