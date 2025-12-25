'use client';

// Phase 4: Chat UI component with pill-based feedback system
// Displays message list, input field, and handles streaming responses
// Phase 4: Replaced modals with pill-based UX system

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { CopyFeedbackModal } from './copy-feedback-modal';
import { SideMenu } from './side-menu';
import { Copy, Bookmark, BookmarkCheck, ArrowUp, ArrowLeft, ChevronUp, ChevronDown, GitBranch, Menu } from 'lucide-react';
import { Pill as PillType, Pill } from './pills/pill';
import { PillRow } from './pills/pill-row';
import { StarRating } from './star-rating';
import { SourceAttribution } from './source-attribution';
import { Prisma } from '@prisma/client';
import { useTheme } from '../lib/theme/theme-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  context?: Prisma.JsonValue; // Message context for source attribution
}

interface ChatProps {
  chatbotId: string;
  chatbotTitle: string;
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
export default function Chat({ chatbotId, chatbotTitle }: ChatProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  
  // Phase 4: Pill system state
  const [pills, setPills] = useState<PillType[]>([]);
  const [selectedFeedbackPill, setSelectedFeedbackPill] = useState<string | null>(null);
  const [selectedExpansionPill, setSelectedExpansionPill] = useState<string | null>(null);
  const [selectedSuggestedPill, setSelectedSuggestedPill] = useState<string | null>(null);
  const [wasModified, setWasModified] = useState(false);
  const [bookmarkedMessages, setBookmarkedMessages] = useState<Set<string>>(new Set());
  const [pillsVisible, setPillsVisible] = useState<boolean>(true); // Toggle state for pills visibility
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedMessages = useRef(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialInputValueRef = useRef<string>(''); // Track initial prefill value
  const pillClickedRef = useRef<boolean>(false); // Track if a pill was clicked
  
  // Theme context for dynamic time-of-day background with adaptive theme
  // Chrome colors are derived from the gradient for harmonious design
  const theme = useTheme();
  
  // Use theme values from context
  const skyGradient = theme.gradient;
  const timeTheme = theme.theme;
  const chromeColors = theme.chrome;
  const currentBubbleStyle = theme.bubbleStyles[timeTheme];
  const chromeTextColor = theme.textColor;

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
          context: msg.context || undefined, // Phase 4: Include context for source attribution
        }));

        setMessages(loadedMessages);
        
        // Phase 4: Load bookmarked messages
        try {
          const bookmarksResponse = await fetch(`/api/bookmarks?chatbotId=${chatbotId}`);
          if (bookmarksResponse.ok) {
            const bookmarks = await bookmarksResponse.json();
            const bookmarkedIds = new Set<string>(bookmarks.map((b: any) => b.messageId as string));
            setBookmarkedMessages(bookmarkedIds);
          }
        } catch (error) {
          console.error('Error loading bookmarks:', error);
        }
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

  // Phase 4: Load pills on mount
  useEffect(() => {
    const loadPills = async () => {
      try {
        const response = await fetch(`/api/pills?chatbotId=${chatbotId}`);
        if (response.ok) {
          const loadedPills = await response.json();
          setPills(loadedPills);
        }
      } catch (error) {
        console.error('Error loading pills:', error);
      }
    };
    loadPills();
  }, [chatbotId]);

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
    initialInputValueRef.current = '';
    pillClickedRef.current = false; // Reset pill click tracking
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

      // Phase 4, Task 8: Prepare pill metadata for server-side logging
      const pillMetadata = (selectedFeedbackPill || selectedExpansionPill || selectedSuggestedPill) ? {
        feedbackPillId: selectedFeedbackPill || null,
        expansionPillId: selectedExpansionPill || null,
        suggestedPillId: selectedSuggestedPill || null,
        prefillText: initialInputValueRef.current,
        sentText: userMessage.content,
        wasModified,
      } : null;

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
          ...(pillMetadata && { pillMetadata }),
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

      // Phase 4, Task 8: Pill usage is now logged server-side in /api/chat route
      // Clear pill selection after message sent
      if (selectedFeedbackPill || selectedExpansionPill || selectedSuggestedPill) {
        setSelectedFeedbackPill(null);
        setSelectedExpansionPill(null);
        setSelectedSuggestedPill(null);
        setWasModified(false);
        initialInputValueRef.current = '';
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
              context: msg.context || undefined, // Phase 4: Include context for source attribution
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

  // Handle Branch button click
  const handleBranch = () => {
    // Clear any existing toast timeout first
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({
      message: 'Feature coming soon',
      type: 'success',
    });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };


  // Phase 4: Handle Save button click
  const handleSave = async (messageId: string) => {
    // Check if already bookmarked
    if (bookmarkedMessages.has(messageId)) {
      // TODO: Implement unsave functionality if needed
      return;
    }

    try {
      // Get chunkIds from message context
      const message = messages.find(m => m.id === messageId);
      const chunkIds: string[] = [];
      if (message?.context && typeof message.context === 'object') {
        const context = message.context as Record<string, unknown>;
        const chunks = context.chunks as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(chunks)) {
          chunks.forEach((chunk) => {
            const chunkId = chunk.chunkId as string | undefined;
            if (chunkId) {
              chunkIds.push(chunkId);
            }
          });
        }
      }

      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          chunkIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save bookmark');
      }

      // Update bookmarked messages state
      setBookmarkedMessages(prev => new Set(prev).add(messageId));

      // Show success toast
      setToast({
        message: 'Saved to Bookmarks',
        type: 'success',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      console.error('Error saving bookmark:', error);
      setToast({
        message: 'Failed to save bookmark. Please try again.',
        type: 'error',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 5000);
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

  // Phase 4: Handle pill click - append to end of existing text
  const handlePillClick = (pill: PillType) => {
    // Get current input value and append pill text to the end
    const currentInput = input.trim();
    const pillText = pill.prefillText.trim();
    
    // Build new input by appending pill text to existing text
    let newInput = '';
    if (currentInput) {
      // Add space between existing text and new pill text
      newInput = currentInput + ' ' + pillText;
    } else {
      // If input is empty, just use the pill text
      newInput = pillText;
    }
    
    // Update pill selection state for tracking
    if (pill.pillType === 'feedback') {
      setSelectedFeedbackPill(pill.id);
      
      // Show thank you toast for feedback pills
      // Clear any existing toast timeout first
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      setToast({
        message: 'Thanks for your feedback!',
        type: 'success',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 2000);
    } else if (pill.pillType === 'expansion') {
      setSelectedExpansionPill(pill.id);
    } else if (pill.pillType === 'suggested') {
      setSelectedSuggestedPill(pill.id);
    }
    
    // Update input with appended text
    setInput(newInput);
    // Update initial value ref only if this is the first pill click (input was empty)
    if (!initialInputValueRef.current) {
      initialInputValueRef.current = newInput;
    }
    pillClickedRef.current = true; // Mark that a pill was clicked
    setPillsVisible(true); // Keep pills visible when a pill is clicked
    // Don't reset wasModified - preserve user's existing modifications
    inputRef.current?.focus();
    // Move cursor to end
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newInput.length, newInput.length);
      }
    }, 0);
  };

  // Phase 4: Track input modifications
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    // Reset pill click flag when input is cleared
    if (newValue.trim() === '') {
      pillClickedRef.current = false;
      initialInputValueRef.current = '';
      setPillsVisible(true); // Show pills when input is cleared
    }
    
    // Auto-collapse pills when user types 70+ characters without clicking a pill
    if (newValue.length >= 70 && !pillClickedRef.current) {
      setPillsVisible(false);
    }
    
    // Check if user modified prefilled text
    if (initialInputValueRef.current && newValue !== initialInputValueRef.current) {
      setWasModified(true);
    }
  };

  /**
   * Handles copy button click
   * 
   * Phase 5: Copy Button with Feedback (kept per plan decision)
   * 
   * Copies message content to clipboard and opens copy feedback modal immediately.
   * Uses iOS Safari/Chrome fallback for clipboard API compatibility.
   * 
   * Process:
   * 1. Copy content to clipboard (with iOS fallback)
   * 2. Track copy event in Events table (non-blocking, creates event with copyUsage=null)
   * 3. Open copy feedback modal immediately (no intermediate toast)
   * 
   * Note: Copy events are stored in Events table (eventType: 'copy'), not Message_Feedback.
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

      // Phase 4: Log copy event to Events table
      const message = messages.find(m => m.id === messageId);
      const chunkIds: string[] = [];
      if (message?.context && typeof message.context === 'object') {
        const context = message.context as Record<string, unknown>;
        const chunks = context.chunks as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(chunks)) {
          chunks.forEach((chunk) => {
            const chunkId = chunk.chunkId as string | undefined;
            if (chunkId) {
              chunkIds.push(chunkId);
            }
          });
        }
      }

      // Log copy event (non-blocking)
      fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'copy',
          sessionId: conversationId || undefined,
          chunkIds,
          metadata: { messageId },
        }),
      }).catch((err) => {
        console.error('Error tracking copy event:', err);
        // Don't show error to user - copy still succeeded
      });

      // Phase 4: Keep copy modal for now (per plan decision)
      // Show copy feedback modal directly (no intermediate toast)
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

  return (
    <div className="flex flex-col h-dvh w-full" style={{ backgroundColor: chromeColors.header }}>
      {/* Header */}
      <div 
        className="app-header border-b px-4 py-2.5"
        style={{
          backgroundColor: chromeColors.header,
          borderColor: chromeColors.border,
          color: chromeTextColor,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors opacity-80 flex-shrink-0"
              style={{
                color: chromeTextColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = timeTheme === 'light' 
                  ? 'rgba(0, 0, 0, 0.05)' 
                  : 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">{chatbotTitle}</h1>
          </div>
          
          {/* Phase 4: Star rating in header */}
          {conversationId && (
            <div className="flex-shrink-0">
              <StarRating
                chatbotId={chatbotId}
                sessionId={conversationId}
                messageCount={messages.filter(m => m.role === 'user').length}
              />
            </div>
          )}
          
          {/* Side menu button - appears to the right of rating stars */}
          {isSignedIn && (
            <button
              onClick={() => setSideMenuOpen(true)}
              className="flex-shrink-0 p-2 rounded-lg transition-colors opacity-80"
              style={{
                color: chromeTextColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = timeTheme === 'light' 
                  ? 'rgba(0, 0, 0, 0.05)' 
                  : 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Open menu"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm opacity-80">
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
            <span className="opacity-80">{toast.message}</span>
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
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 sky-gradient-transition"
        style={{
          background: `linear-gradient(135deg, ${skyGradient.start}, ${skyGradient.end})`,
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          overscrollBehavior: 'none', // Prevent scroll overhangs on iOS Safari/Chrome
        }}
      >
        {isLoadingMessages && (
          <div 
            className="text-center mt-8 opacity-80"
            style={{ color: currentBubbleStyle.text }}
          >
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}
        {!isLoadingMessages && messages.length === 0 && (
          <div 
            className="text-center mt-8 opacity-80"
            style={{ color: currentBubbleStyle.text }}
          >
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
              <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] ${message.role === 'assistant' ? 'space-y-2' : ''}`}>
                <div
                  className={`rounded-lg px-4 py-2 message-bubble ${
                    message.role === 'user' ? 'font-medium' : 'font-normal'
                  }`}
                  style={{
                    background: message.role === 'user' 
                      ? currentBubbleStyle.user 
                      : currentBubbleStyle.ai,
                    color: message.role === 'user' 
                      ? currentBubbleStyle.userText 
                      : currentBubbleStyle.text,
                    boxShadow: currentBubbleStyle.shadow,
                    border: `1px solid ${message.role === 'user' 
                      ? 'rgba(255, 255, 255, 0.2)' 
                      : 'rgba(255, 255, 255, 0.18)'}`,
                  }}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content || (message.role === 'assistant' && isLoading ? '...' : '')}
                  </div>
                  
                  {/* Phase 4: Source attribution - inside message bubble at the end */}
                  {message.role === 'assistant' && message.context && (
                    <SourceAttribution
                      chunkIds={[]} // Will be extracted from context by component
                      chatbotId={chatbotId}
                      messageContext={message.context}
                      textColor="#1a1a1a"
                    />
                  )}
                </div>
                
                {/* Message actions for user messages */}
                {message.role === 'user' && message.content && !isLoading && (
                  <div className="space-y-3 mt-1 flex justify-end">
                    <button
                      onClick={handleBranch}
                      className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95 opacity-80"
                      title="Branch conversation"
                    >
                      <GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600" />
                      <span>Branch</span>
                    </button>
                  </div>
                )}
                
                {/* Phase 4: Message actions for assistant messages */}
                {message.role === 'assistant' && message.content && !isLoading && (
                  <div className="space-y-3 mt-1">
                    {/* First row: Copy, Save buttons */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {/* Copy button */}
                      <button
                        onClick={() => handleCopy(message.id, message.content)}
                        className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-95 opacity-80"
                        title="Copy message"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600" />
                        <span>Copy</span>
                      </button>
                      {/* Phase 4: Save button with bookmark functionality */}
                      <button
                        onClick={() => handleSave(message.id)}
                        disabled={bookmarkedMessages.has(message.id)}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all opacity-80 ${
                          bookmarkedMessages.has(message.id)
                            ? 'bg-blue-100 text-blue-700 border border-blue-400'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        } active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
                        title={bookmarkedMessages.has(message.id) ? 'Already saved' : 'Save message'}
                      >
                        {bookmarkedMessages.has(message.id) ? (
                          <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-600" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600" />
                        )}
                        <span>Save</span>
                      </button>
                    </div>
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
            <div 
              className="message-bubble rounded-lg px-4 py-2"
              style={{
                background: currentBubbleStyle.ai,
                color: currentBubbleStyle.text,
                boxShadow: currentBubbleStyle.shadow,
                border: '1px solid rgba(255, 255, 255, 0.18)',
              }}
            >
              <div className="flex space-x-1">
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    animationDelay: '0ms',
                    backgroundColor: currentBubbleStyle.text,
                    opacity: 0.6,
                  }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    animationDelay: '150ms',
                    backgroundColor: currentBubbleStyle.text,
                    opacity: 0.6,
                  }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    animationDelay: '300ms',
                    backgroundColor: currentBubbleStyle.text,
                    opacity: 0.6,
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Phase 4: Input area with dynamic pills */}
      <div 
        className="input-area border-t px-3 py-2 relative"
        style={{
          backgroundColor: chromeColors.input,
          borderColor: chromeColors.border,
        }}
      >
        {/* Toggle button - positioned at top center, half-protruding */}
        {pills.length > 0 && (
          <button
            onClick={() => setPillsVisible(!pillsVisible)}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center border"
            style={{
              backgroundColor: chromeColors.input,
              color: chromeTextColor,
              borderColor: chromeColors.border,
              opacity: 0.8,
              clipPath: 'inset(0 0 30% 0)',
            }}
            aria-label={pillsVisible ? 'Hide pills' : 'Show pills'}
            title={pillsVisible ? 'Hide pills' : 'Show pills'}
          >
            {pillsVisible ? (
              <ChevronUp className="w-4 h-4 -mt-0.5" style={{ color: chromeTextColor }} />
            ) : (
              <ChevronDown className="w-4 h-4 -mt-0.5" style={{ color: chromeTextColor }} />
            )}
          </button>
        )}
        
        {/* Dynamic pill rows */}
        {/* Visibility controlled by pillsVisible state (can be toggled manually or auto-collapsed by character limit) */}
        {pills.length > 0 && pillsVisible && (
          <div className="mb-1 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 scrollbar-hide pt-2">
            <div className="flex flex-col gap-0.5 w-max">
              {/* Phase 4: Organize pills into two rows */}
              {/* Before messages: Only show suggested questions */}
              {/* After messages: Show feedback + expansion + suggested */}
              
              {messages.length === 0 ? (
                // Before messages: Two rows with suggested questions split between them
                <>
                  {/* Row 1: First half of suggested questions */}
                  {(() => {
                    const suggestedPills = pills.filter(p => p.pillType === 'suggested');
                    const firstHalfSuggested = suggestedPills.slice(0, Math.ceil(suggestedPills.length / 2));
                    return (
                      <PillRow
                        pills={firstHalfSuggested}
                        selectedFeedbackPill={null}
                        selectedExpansionPill={null}
                        onPillClick={handlePillClick}
                        disabled={isLoading}
                      />
                    );
                  })()}
                  
                  {/* Row 2: Second half of suggested questions */}
                  {(() => {
                    const suggestedPills = pills.filter(p => p.pillType === 'suggested');
                    const secondHalfSuggested = suggestedPills.slice(Math.ceil(suggestedPills.length / 2));
                    return (
                      <PillRow
                        pills={secondHalfSuggested}
                        selectedFeedbackPill={null}
                        selectedExpansionPill={null}
                        onPillClick={handlePillClick}
                        disabled={isLoading}
                      />
                    );
                  })()}
                </>
              ) : (
                // After messages: Two rows
                <>
                  {/* Row 1: Helpful pill + first half of expansion pills + first half of suggested questions */}
                  {(() => {
                    const expansionPills = pills.filter(p => p.pillType === 'expansion');
                    const firstHalfExpansion = expansionPills.slice(0, Math.ceil(expansionPills.length / 2));
                    const suggestedPills = pills.filter(p => p.pillType === 'suggested');
                    const firstHalfSuggested = suggestedPills.slice(0, Math.ceil(suggestedPills.length / 2));
                    return (
                      <PillRow
                        pills={[
                          ...pills.filter(p => p.pillType === 'feedback' && p.label.toLowerCase().includes('helpful') && !p.label.toLowerCase().includes('not')),
                          ...firstHalfExpansion,
                          ...firstHalfSuggested,
                        ]}
                        selectedFeedbackPill={null}
                        selectedExpansionPill={null}
                        onPillClick={handlePillClick}
                        disabled={isLoading}
                      />
                    );
                  })()}
                  
                  {/* Row 2: Not helpful pill + second half of expansion pills + second half of suggested questions */}
                  {(() => {
                    const expansionPills = pills.filter(p => p.pillType === 'expansion');
                    const secondHalfExpansion = expansionPills.slice(Math.ceil(expansionPills.length / 2));
                    const suggestedPills = pills.filter(p => p.pillType === 'suggested');
                    const secondHalfSuggested = suggestedPills.slice(Math.ceil(suggestedPills.length / 2));
                    return (
                      <PillRow
                        pills={[
                          ...pills.filter(p => p.pillType === 'feedback' && (p.label.toLowerCase().includes('not') || p.label.toLowerCase().includes('not helpful'))),
                          ...secondHalfExpansion,
                          ...secondHalfSuggested,
                        ]}
                        selectedFeedbackPill={null}
                        selectedExpansionPill={null}
                        onPillClick={handlePillClick}
                        disabled={isLoading}
                      />
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply..."
            disabled={isLoading}
            rows={1}
            className="input-field flex-1 resize-none border rounded-lg px-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed opacity-80 placeholder:opacity-80"
            style={{
              minHeight: '52px',
              maxHeight: '120px',
              backgroundColor: chromeColors.inputField, // Lighter than input area
              borderColor: chromeColors.border,
              color: chromeTextColor,
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
            className="px-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[44px] opacity-80"
            title="Send message"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Phase 5: Copy feedback modal (kept per plan decision) */}
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
          // Phase 5: Show toast notification (same system as helpful/not_helpful feedback)
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

      {/* Side Menu */}
      <SideMenu 
        isOpen={sideMenuOpen} 
        onClose={() => setSideMenuOpen(false)}
        onOpen={() => setSideMenuOpen(true)}
      />
    </div>
  );
}
