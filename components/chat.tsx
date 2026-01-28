'use client';

// Phase 4: Chat UI component with pill-based feedback system
// Displays message list, input field, and handles streaming responses
// Phase 4: Replaced modals with pill-based UX system

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/nextjs';
import { CopyFeedbackModal } from './copy-feedback-modal';
import { SideMenu } from './side-menu';
import { ChatbotSettingsModal } from './chatbot-settings-modal';
import { Copy, Bookmark, BookmarkCheck, ArrowUp, ArrowLeft, ChevronUp, ChevronDown, GitBranch, Menu, Pencil } from 'lucide-react';
import { Pill as PillType, Pill } from './pills/pill';
import { PillRow } from './pills/pill-row';
import { SuggestionPills } from './pills/suggestion-pills';
import { StarRating } from './star-rating';
import { SourceAttribution } from './source-attribution';
import { Prisma } from '@prisma/client';
import { useTheme } from '../lib/theme/theme-context';
import { ThemedPage } from './themed-page';
import { ChatHeader } from './chat-header';
import { useConversationalIntake, IntakeQuestion } from '../hooks/use-conversational-intake';
import { useIntakeGate } from '../hooks/use-intake-gate';
import { getPillColors } from '../lib/theme/pill-colors';
import { getSuggestionPillStyles } from '../lib/theme/pill-styles';
import { getCurrentPeriod } from '../lib/theme/config';
import { MarkdownRenderer } from './markdown-renderer';
import { FollowUpPills } from './follow-up-pills';
import { IntakeFlow } from './intake-flow';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  context?: Prisma.JsonValue; // Message context for source attribution
  followUpPills?: string[]; // Follow-up pills (separate from RAG context)
}

interface ChatProps {
  chatbotId: string;
  chatbotTitle: string;
}

/**
 * Helper function for type-safe chunk access from context
 * Extracts chunk IDs from message context for event logging
 */
function getChunkIds(context: Prisma.JsonValue | undefined): string[] {
  if (!context) return [];
  const ctx = context as { chunks?: Array<{ chunkId: string }> } | null;
  return ctx?.chunks?.map(c => c.chunkId) || [];
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
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<'active' | 'completed' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  
  // Phase 4: Pill system state
  const [pills, setPills] = useState<PillType[]>([]);
  const [selectedFeedbackPill, setSelectedFeedbackPill] = useState<string | null>(null);
  const [selectedExpansionPill, setSelectedExpansionPill] = useState<string | null>(null);
  const [selectedSuggestedPill, setSelectedSuggestedPill] = useState<string | null>(null);
  const [wasModified, setWasModified] = useState(false);
  const [bookmarkedMessages, setBookmarkedMessages] = useState<Set<string>>(new Set());
  const [pillsVisible, setPillsVisible] = useState<boolean>(true); // Toggle state for pills visibility
  
  // Store suggestion pills for display (unified source for all suggestion pills)
  // Populated from: fresh intake completion (PATCH response) OR cached pills (returning users)
  const [intakeSuggestionPills, setIntakeSuggestionPills] = useState<PillType[]>([]);
  
  // Use intake gate hook - single source of truth for intake vs chat decision
  const intakeGate = useIntakeGate(chatbotId, conversationId, isSignedIn, isLoaded);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedMessages = useRef(false);
  const hasPassedIntakePhase = useRef(false); // Track if we've moved past intake completion
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialInputValueRef = useRef<string>(''); // Track initial prefill value
  const pillClickedRef = useRef<boolean>(false); // Track if a pill was clicked
  
  // Theme context for dynamic time-of-day background with adaptive theme
  // Chrome colors are derived from the gradient for harmonious design
  const theme = useTheme();
  
  // Use theme values from context
  const timeTheme = theme.theme;
  const chromeColors = theme.chrome;
  const currentBubbleStyle = theme.bubbleStyles[timeTheme];
  const chromeTextColor = theme.textColor;

  // Check auth and open modal if needed
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Clear any stored conversation data
      localStorage.removeItem(`conversationId_${chatbotId}`);
      // Preserve URL parameters in redirect URL
      const conversationIdParam = searchParams?.get('conversationId');
      const newParam = searchParams?.get('new');
      let redirectUrl = `/chat/${chatbotId}`;
      if (conversationIdParam) {
        redirectUrl += `?conversationId=${conversationIdParam}`;
      } else if (newParam === 'true') {
        redirectUrl += `?new=true`;
      }
      // Open sign-in modal with redirect URL
      clerk.openSignIn({
        redirectUrl,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, chatbotId, searchParams]);

  // Welcome data fetch and gate decision is now handled by useIntakeGate hook

  // Get conversationId from URL params - URL is source of truth
  useEffect(() => {
    const urlConversationId = searchParams?.get('conversationId');
    const isNewConversation = searchParams?.get('new') === 'true';
    
    console.log('[Chat] URL params effect running', {
      urlConversationId,
      isNewConversation,
      currentConversationId: conversationId,
      gateState: intakeGate.gateState,
      messagesCount: messages.length
    });
    
    // Priority 1: conversationId in URL (highest priority)
    // Always set conversationId from URL if present - this allows gate to transition to 'chat'
    if (urlConversationId) {
      // Only update if different to avoid unnecessary re-renders
      if (conversationId !== urlConversationId) {
        console.log('[Chat] Setting conversationId from URL', urlConversationId);
        setConversationId(urlConversationId);
        // Store in localStorage for persistence across refreshes
        localStorage.setItem(`conversationId_${chatbotId}`, urlConversationId);
        // Reset hasLoadedMessages to allow reloading
        hasLoadedMessages.current = false;
      }
      return;
    }
    
    // Guard: Don't reset messages during active intake or checking (only for clearing conversationId)
    if (intakeGate.gateState === 'intake' || intakeGate.gateState === 'checking') {
      console.log('[Chat] Guard preventing conversationId clear - in intake/checking');
      return;
    }
    
    // Guard: Don't clear messages if we have messages (e.g., transitioning from intake)
    // This prevents flicker when intake completes and URL updates
    // Note: conversationId may be null during transition, but messages should be preserved
    // Explicit message clearing (e.g., ?new=true) is handled by Priority 2 above
    if (messages.length > 0) {
      console.log('[Chat] Guard preventing message clear - messages exist');
      return;
    }
    
    // Priority 2: ?new=true parameter - clear localStorage and start fresh
    if (isNewConversation) {
      setConversationId(null);
      localStorage.removeItem(`conversationId_${chatbotId}`);
      setMessages([]);
      setConversationStatus(null);
      hasLoadedMessages.current = false;
      hasPassedIntakePhase.current = false; // Reset intake phase tracking
      return;
    }
    
    // Priority 3: No URL parameters - show empty interface (ready for new conversation)
    // Don't load from localStorage - URL is source of truth
    setConversationId(null);
    setMessages([]);
    setConversationStatus(null);
    hasLoadedMessages.current = false;
    hasPassedIntakePhase.current = false; // Reset intake phase tracking
  }, [chatbotId, searchParams, intakeGate.gateState, conversationId, messages.length]);

  // Load existing messages when conversationId is available
  useEffect(() => {
    // When resuming intake for an existing conversation, we need to load messages
    // to show conversation history. The intake hook will manage new messages via onMessageAdded.
    // Only skip loading if we're in a new intake flow (no conversationId yet).
    if (!conversationId || hasLoadedMessages.current) return;
    // If messages already exist (e.g., from intake completion), skip loading to prevent flicker
    if (messages.length > 0) {
      hasLoadedMessages.current = true;
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      setError(null);

      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle specific error cases
          if (response.status === 404) {
            // Conversation not found - show error and redirect to new conversation
            const errorMessage = errorData.error || 'Conversation not found';
            setError(errorMessage);
            setToast({ message: errorMessage, type: 'error' });
            
            // Clear invalid conversationId and redirect after showing error
            setConversationId(null);
            localStorage.removeItem(`conversationId_${chatbotId}`);
            
            // Redirect to new conversation after 3 seconds
            setTimeout(() => {
              router.replace(`/chat/${chatbotId}?new=true`);
            }, 3000);
            
            setIsLoadingMessages(false);
            return;
          }
          
          if (response.status === 403) {
            // User doesn't have access - show error and redirect
            const errorMessage = errorData.error || "You don't have access to this conversation";
            setError(errorMessage);
            setToast({ message: errorMessage, type: 'error' });
            
            // Clear conversationId and redirect after showing error
            setConversationId(null);
            localStorage.removeItem(`conversationId_${chatbotId}`);
            
            // Redirect to new conversation after 3 seconds
            setTimeout(() => {
              router.replace(`/chat/${chatbotId}?new=true`);
            }, 3000);
            
            setIsLoadingMessages(false);
            return;
          }
          
          // Provide user-friendly error messages for other errors
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
          followUpPills: msg.followUpPills || undefined, // Follow-up pills (separate from RAG context)
        }));

        setMessages(loadedMessages);
        // Set conversation status (for checking if conversation is completed)
        if (data.conversationStatus) {
          setConversationStatus(data.conversationStatus as 'active' | 'completed');
        }
        
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
  }, [conversationId, chatbotId, intakeGate.gateState, router, messages.length]);

  // Persist conversationId to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(`conversationId_${chatbotId}`, conversationId);
    }
  }, [conversationId, chatbotId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Small delay to ensure DOM is updated, especially after intake completion
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Check once if we've passed the intake phase (only runs when messages change)
  useEffect(() => {
    // If already passed, no need to check again
    if (hasPassedIntakePhase.current) return;
    
    // IMPORTANT: Don't set hasPassedIntakePhase to true while still in intake mode
    // User messages during intake are part of the intake flow, not regular conversation
    if (intakeGate.gateState === 'intake') {
      // Still in intake - don't mark as passed yet
      return;
    }
    
    // Find the final intake message (contains "When our conversation is finished")
    const finalIntakeMessageIndex = messages.findIndex((msg) => 
      msg.role === 'assistant' && 
      msg.content?.includes("When our conversation is finished")
    );
    
    // If no intake message exists, or there are user messages after intake, we've passed it
    // Only check this if we're NOT in intake mode (already checked above)
    if (finalIntakeMessageIndex === -1) {
      // No intake message - check if there are any user messages (normal conversation)
      if (messages.some(msg => msg.role === 'user')) {
        hasPassedIntakePhase.current = true;
      }
    } else {
      // Intake message exists - check if there are user messages after it
      const hasUserMessagesAfterIntake = messages.slice(finalIntakeMessageIndex + 1).some(msg => msg.role === 'user');
      if (hasUserMessagesAfterIntake) {
        hasPassedIntakePhase.current = true;
      }
    }
  }, [messages, intakeGate.gateState]);

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

  // Phase 4: Load pills on mount (only if not showing intake)
  // Note: Only loads feedback + expansion pills. Suggestion pills come from:
  // - Fresh intake completion → AI-generated pills via PATCH response (use-conversational-intake.ts)
  // - Returning users → cachedSuggestionPills from welcome data (step 10)
  useEffect(() => {
    // Don't load pills if intake is active or checking - wait for gate state
    if (intakeGate.gateState === 'intake' || intakeGate.gateState === 'checking') {
      return;
    }

    const loadPills = async () => {
      try {
        const response = await fetch(`/api/pills?chatbotId=${chatbotId}`);
        if (response.ok) {
          const loadedPills = await response.json();
          // Only store feedback + expansion pills; suggestion pills come from AI generation
          const systemPills = loadedPills.filter((p: PillType) => p.pillType !== 'suggested');
          setPills(systemPills);
        }
      } catch (error) {
        console.error('Error loading pills:', error);
      }
    };
    loadPills();
  }, [chatbotId, intakeGate.gateState]);

  /**
   * Sends a message to the chat API and handles streaming response
   */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // Don't allow sending messages to completed conversations
    if (conversationStatus === 'completed') {
      setToast({ 
        message: 'This conversation is completed. Please start a new conversation to continue.', 
        type: 'error' 
      });
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    // For returning users starting a new conversation, add welcome message to state first
    const shouldAddWelcomeMessage = !conversationId &&
      messages.length === 0 &&
      intakeGate.welcomeData?.intakeCompleted;

    if (shouldAddWelcomeMessage) {
      const welcomeContent = intakeGate.welcomeData?.welcomeMessage
        ? `${intakeGate.welcomeData.welcomeMessage}\n\nWhen our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`
        : `Welcome back! When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`;
      const welcomeMsg: Message = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: welcomeContent,
      };
      setMessages([welcomeMsg, userMessage]);
    } else {
      // Add user message immediately
      setMessages((prev) => [...prev, userMessage]);
    }
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

      // For returning users (intake completed) starting a new conversation,
      // include welcome message to be saved as first assistant message
      const welcomeMessageContent = (!conversationId && intakeGate.welcomeData?.intakeCompleted)
        ? (intakeGate.welcomeData?.welcomeMessage
            ? `${intakeGate.welcomeData.welcomeMessage}\n\nWhen our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`
            : `Welcome back! When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`)
        : null;

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
          ...(welcomeMessageContent && { welcomeMessageContent }),
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
      const PILLS_PREFIX = '__PILLS__';

      // Read stream chunks
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Check if chunk contains pills event (structured prefix)
          if (chunk.includes(PILLS_PREFIX)) {
            const pillsIndex = chunk.indexOf(PILLS_PREFIX);
            const contentPart = chunk.substring(0, pillsIndex);
            const pillsPart = chunk.substring(pillsIndex + PILLS_PREFIX.length);
            
            // Append content part normally (if any) - this is the actual message content
            if (contentPart.trim()) {
              streamedContent += contentPart;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: streamedContent }
                    : msg
                )
              );
            }
            
            // Parse pills JSON (structured data, no regex needed)
            try {
              const pillsData = JSON.parse(pillsPart);
              const { messageId, pills } = pillsData;
              
              if (Array.isArray(pills)) {
                // Update message with pills using assistantMessageId (temporary ID)
                // The message will be reloaded with real database ID later, but pills are attached now
                // Pills stored in separate followUpPills field (not in RAG context)
                setMessages((prev) => prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        followUpPills: pills, // Separate field, not in RAG context
                      }
                    : msg
                ));
              }
            } catch (parseError) {
              console.error('Error parsing pills event:', parseError);
              console.error('Pills part that failed:', pillsPart);
            }
          } else {
            // Normal content chunk - append to streamed content
            streamedContent += chunk;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: streamedContent }
                  : msg
              )
            );
          }
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
        // Persist to localStorage for persistence across refreshes
        localStorage.setItem(`conversationId_${chatbotId}`, newConversationId);
        // Update URL with conversationId using replace (don't add to history)
        router.replace(`/chat/${chatbotId}?conversationId=${newConversationId}`);
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
              followUpPills: msg.followUpPills || undefined, // Follow-up pills (separate from RAG context)
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
  const handleNewConversation = () => {
    router.push(`/chat/${chatbotId}?new=true`);
  };

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

  // Use conversational intake hook (always called, but only active when gate state is 'intake')
  // Must be called before any early returns to satisfy React hooks rules
  // Only pass data when gate state is 'intake' AND welcome data is loaded - prevents premature initialization
  // Pass existing conversationId when resuming intake for an existing conversation
  const intakeHook = useConversationalIntake(
    chatbotId,
    intakeGate.gateState === 'intake' && intakeGate.welcomeData
      ? intakeGate.welcomeData.chatbotName
      : '',
    intakeGate.gateState === 'intake' && intakeGate.welcomeData
      ? intakeGate.welcomeData.chatbotPurpose
      : '',
    intakeGate.gateState === 'intake' && intakeGate.welcomeData
      ? intakeGate.welcomeData.questions || []
      : [],
    intakeGate.gateState === 'intake' && intakeGate.welcomeData
      ? intakeGate.welcomeData.existingResponses || {}
      : {},
    (message) => {
      // Convert IntakeMessage to Message and add to main messages state
      // Deduplicate by message ID to prevent duplicates
      const convertedMessage: Message = {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      };
      
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some(msg => msg.id === convertedMessage.id)) {
          return prev;
        }
        return [...prev, convertedMessage];
      });
    },
    async (convId) => {
      // Intake completed - transition to normal chat
      // Update gate state first, then update conversationId and URL
      // This ensures UI transitions immediately
      intakeGate.onIntakeComplete(convId);
      
      // Reload messages from API to ensure consistency and persistence
      // This ensures all intake messages are properly loaded and scrollable
      // Deduplicate by message ID to prevent duplicates from onMessageAdded callback
      try {
        const response = await fetch(`/api/conversations/${convId}/messages`);
        if (response.ok) {
          const data = await response.json();
          const loadedMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
            context: msg.context || undefined,
            followUpPills: msg.followUpPills || undefined,
          }));
          
          // Deduplicate: Create a map of existing message IDs to avoid duplicates
          const existingMessageIds = new Set(messages.map(m => m.id));
          const newMessages = loadedMessages.filter(msg => !existingMessageIds.has(msg.id));
          
          // Only add new messages, don't replace entire array to avoid duplicates
          // Always sort by createdAt to ensure correct order (especially important for intake flow)
          if (newMessages.length > 0) {
            setMessages((prev) => {
              // Merge and deduplicate by ID
              const merged = [...prev, ...newMessages];
              const uniqueMessages = merged.filter((msg, index, self) => 
                index === self.findIndex(m => m.id === msg.id)
              );
              // Sort by createdAt to ensure correct order
              return uniqueMessages.sort((a, b) => {
                const aTime = a.createdAt?.getTime() || 0;
                const bTime = b.createdAt?.getTime() || 0;
                return aTime - bTime;
              });
            });
          } else {
            // No new messages, but ensure we have all messages from API (in case of ordering issues)
            // Deduplicate existing messages with loaded messages
            setMessages((prev) => {
              const allMessages = [...prev, ...loadedMessages];
              const uniqueMessages = allMessages.filter((msg, index, self) => 
                index === self.findIndex(m => m.id === msg.id)
              );
              // Sort by createdAt to ensure correct order
              return uniqueMessages.sort((a, b) => {
                const aTime = a.createdAt?.getTime() || 0;
                const bTime = b.createdAt?.getTime() || 0;
                return aTime - bTime;
              });
            });
          }
        }
      } catch (error) {
        console.error('[Chat] Error reloading messages after intake completion', error);
        // Continue with existing messages if reload fails
      }
      
      // Mark messages as loaded
      hasLoadedMessages.current = true;
      setConversationId(convId);
      localStorage.setItem(`conversationId_${chatbotId}`, convId);
      // Update URL without causing full navigation (preserves state)
      router.replace(`/chat/${chatbotId}?conversationId=${convId}`, { scroll: false });
    },
    // Pass existing conversationId when resuming intake for an existing conversation
    intakeGate.gateState === 'intake' ? conversationId : null,
    // Pass welcome message for post-intake display (AI Suggestion Pills feature)
    intakeGate.gateState === 'intake' && intakeGate.welcomeData
      ? intakeGate.welcomeData.welcomeMessage
      : undefined
  );

  // Sync intake hook suggestion pills to component state for persistence
  useEffect(() => {
    if (intakeHook?.showPills && intakeHook?.suggestionPills && intakeHook.suggestionPills.length > 0) {
      setIntakeSuggestionPills(intakeHook.suggestionPills);
    }
  }, [intakeHook?.showPills, intakeHook?.suggestionPills]);

  // Load suggestion pills for returning users (Step 10)
  // Priority: cachedSuggestionPills > generatedSuggestionPills > fallbackSuggestionPills
  // This handles:
  // - Returning to existing conversation: use cached AI-generated pills
  // - Starting new conversation (intake complete): use freshly generated pills
  // - Fallback: use chatbot's fallback pills if generation failed
  useEffect(() => {
    if (
      intakeGate.gateState === 'chat' &&
      intakeGate.welcomeData?.intakeCompleted &&
      intakeSuggestionPills.length === 0 // Don't override if already set (e.g., from fresh intake)
    ) {
      // Priority: cached > generated > fallback
      const pillsToUse =
        (intakeGate.welcomeData.cachedSuggestionPills && intakeGate.welcomeData.cachedSuggestionPills.length > 0)
          ? intakeGate.welcomeData.cachedSuggestionPills
          : (intakeGate.welcomeData.generatedSuggestionPills && intakeGate.welcomeData.generatedSuggestionPills.length > 0)
            ? intakeGate.welcomeData.generatedSuggestionPills
            : intakeGate.welcomeData.fallbackSuggestionPills;

      if (pillsToUse && pillsToUse.length > 0) {
        const mappedPills: PillType[] = pillsToUse.map((text: string, index: number) => ({
          id: `suggestion-${index}`,
          chatbotId: chatbotId, // Required by Pill interface
          pillType: 'suggested' as const,
          label: text,
          prefillText: text,
          displayOrder: index,
          isActive: true,
        }));
        setIntakeSuggestionPills(mappedPills);
      }
    }
  }, [intakeGate.gateState, intakeGate.welcomeData?.intakeCompleted, intakeGate.welcomeData?.cachedSuggestionPills, intakeGate.welcomeData?.generatedSuggestionPills, intakeGate.welcomeData?.fallbackSuggestionPills, intakeSuggestionPills.length, chatbotId]);

  // Show loading while checking intake gate
  if (intakeGate.gateState === 'checking') {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh w-full" style={{ backgroundColor: chromeColors.header }}>
      {/* Header */}
      <ChatHeader
        chatbotTitle={chatbotTitle}
        conversationId={conversationId}
        chatbotId={chatbotId}
        messages={messages}
        error={error}
        onBack={() => router.back()}
        onMenuClick={() => setSideMenuOpen(true)}
        onSettingsClick={() => setSettingsModalOpen(true)}
        onNewConversation={handleNewConversation}
        isSignedIn={isSignedIn}
      />

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
      <ThemedPage 
        className="flex-1 overflow-y-auto p-4 space-y-4 sky-gradient-transition"
        scrollable
      >
        {isLoadingMessages && (
          <div 
            className="text-center mt-8 opacity-80"
            style={{ color: currentBubbleStyle.text }}
          >
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}
        {intakeGate.gateState === 'chat' && !isLoadingMessages && messages.length === 0 && (
          <>
            {/* Returning user with completed intake - show welcome message as first message */}
            {intakeGate.welcomeData?.intakeCompleted ? (
              <div className="flex justify-start">
                <div className="w-full space-y-2">
                  <div
                    className="px-4 py-2 font-normal"
                    style={{
                      background: 'transparent',
                      color: currentBubbleStyle.text,
                    }}
                  >
                    <MarkdownRenderer
                      content={intakeGate.welcomeData?.welcomeMessage
                        ? `${intakeGate.welcomeData.welcomeMessage}\n\nWhen our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`
                        : `Welcome back! When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...`
                      }
                      textColor={currentBubbleStyle.text}
                    />
                  </div>

                  {/* Suggestion Pills after welcome message */}
                  {intakeSuggestionPills.length > 0 && (
                    <SuggestionPills
                      pills={intakeSuggestionPills}
                      onPillClick={handlePillClick}
                      className="mt-4 w-full"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* New user - show default empty state (no pills yet) */
              <div
                className="text-center mt-8 opacity-80"
                style={{ color: currentBubbleStyle.text }}
              >
                <p className="text-lg mb-2">Start a conversation</p>
                <p className="text-sm mb-4">Ask a question about {chatbotTitle}</p>
              </div>
            )}
          </>
        )}

        {(() => {
          // Calculate final intake message index once (used by multiple checks below)
          const finalIntakeMessageIndex = messages.findIndex((msg) => 
            msg.role === 'assistant' && 
            msg.content?.includes("When our conversation is finished")
          );
          
          return messages.map((message, index) => {
            // Find the most recent assistant message
            const mostRecentAssistantMessage = [...messages]
              .reverse()
              .find((msg) => msg.role === 'assistant' && msg.content);
            const isMostRecentAssistant = mostRecentAssistantMessage?.id === message.id;
            
            // Check if this is the first user message AFTER intake completion
            // Don't show pills above user messages that are part of intake flow
            const isFirstUserMessage = index === 0 && message.role === 'user' && 
              // Only show initial pills if there's no final intake message (intakeSuggestionPills will handle that case)
              finalIntakeMessageIndex === -1;

            // Check if this message is part of the intake conversation
            // Hide copy/save buttons for intake messages and the final intake message with suggestion pills
            // Show buttons for regular chat messages that come AFTER the final intake message
            const isIntakeMessage = (() => {
            
            // If no final intake message exists, check if we're in intake mode
            if (finalIntakeMessageIndex === -1) {
              // No final intake message - check gateState
              if (intakeGate.gateState === 'intake') {
                console.log('[Copy/Save Debug] Message is intake - no final message found, gateState is intake', {
                  messageId: message.id,
                  gateState: intakeGate.gateState,
                  contentPreview: message.content?.substring(0, 50)
                });
                return true;
              }
              // Not in intake and no final message - show buttons
              console.log('[Copy/Save Debug] Message is NOT intake - no final message, gateState is chat', {
                messageId: message.id,
                gateState: intakeGate.gateState,
                contentPreview: message.content?.substring(0, 50)
              });
              return false;
            }
            
            // Final intake message exists - check if this message is before, at, or after it
            if (index <= finalIntakeMessageIndex) {
              // This message is part of intake (before or at final intake message)
              console.log('[Copy/Save Debug] Message is intake - before/at final intake message', {
                messageId: message.id,
                index,
                finalIntakeMessageIndex,
                contentPreview: message.content?.substring(0, 50)
              });
              return true;
            }
            
            // This message comes AFTER the final intake message - it's a regular chat message
            console.log('[Copy/Save Debug] Message is NOT intake - comes after final intake message', {
              messageId: message.id,
              index,
              finalIntakeMessageIndex,
              contentPreview: message.content?.substring(0, 50)
            });
            return false;
          })();

          return (
            <div key={message.id}>
              {/* Render pills above first user message */}
              {isFirstUserMessage && intakeSuggestionPills.length > 0 && (
                <SuggestionPills
                  pills={intakeSuggestionPills}
                  onPillClick={handlePillClick}
                  className="mb-4 w-full"
                />
              )}
              
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`${message.role === 'user' ? 'max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]' : 'w-full'} ${message.role === 'assistant' ? 'space-y-2' : ''}`}>
                  <div
                    className={`${message.role === 'user' ? 'rounded-lg message-bubble' : ''} px-4 py-2 ${
                      message.role === 'user' ? 'font-medium' : 'font-normal'
                    }`}
                  style={{
                    background: message.role === 'user' 
                      ? currentBubbleStyle.user 
                      : 'transparent',
                    color: message.role === 'user' 
                      ? currentBubbleStyle.userText 
                      : currentBubbleStyle.text,
                    boxShadow: message.role === 'user' ? currentBubbleStyle.shadow : 'none',
                    border: message.role === 'user' 
                      ? `1px solid rgba(255, 255, 255, 0.2)` 
                      : 'none',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownRenderer 
                      content={(() => {
                        // If this is a verification message with an answer, italicize the answer portion
                        const content = message.content || '';
                        if (content.includes("This is what I have. Is it still correct?")) {
                          // Split by the verification text and italicize the answer portion
                          const parts = content.split("This is what I have. Is it still correct?");
                          if (parts.length === 2) {
                            // Italicize the answer portion (everything after the verification text)
                            return parts[0] + "This is what I have. Is it still correct?\n\n*" + parts[1].trim() + "*";
                          }
                        }
                        return content;
                      })()}
                      textColor={currentBubbleStyle.text}
                    />
                  ) : (
                    <div 
                      className="whitespace-pre-wrap break-words"
                      style={{
                        fontStyle: (() => {
                          // Check if we're in intake mode
                          if (intakeGate.gateState === 'intake') {
                            return 'italic';
                          }
                          // Check if this user message appears before the final intake message
                          if (intakeGate.welcomeData?.hasQuestions) {
                            const hasFinalMessageAfter = messages.some((msg, idx) => 
                              idx > index && 
                              msg.role === 'assistant' && 
                              msg.content?.includes("When our conversation is finished")
                            );
                            if (hasFinalMessageAfter) {
                              return 'italic';
                            }
                          }
                          return 'normal';
                        })()
                      }}
                    >
                      {message.content}
                    </div>
                  )}
                  
                  {/* Follow-up pills - below message content, before source attribution */}
                  {message.role === 'assistant' && (() => {
                    // Pills are stored in separate followUpPills field (not in RAG context)
                    const pills = message.followUpPills || [];
                    const chunkIds = getChunkIds(message.context);
                    
                    if (pills.length === 0) return null;
                    
                    return (
                      <FollowUpPills
                        pills={pills}
                        messageId={message.id}
                        conversationId={conversationId || ''}
                        chunkIds={chunkIds}
                        onPillClick={async (pillText) => {
                          // Prefill input
                          setInput(pillText);
                          inputRef.current?.focus();
                          
                          // Log event
                          // Note: Events API extracts messageId from metadata, so include it there
                          try {
                            await fetch('/api/events', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                eventType: 'follow_up_pill_click',
                                sessionId: conversationId || '',
                                chunkIds: chunkIds,
                                metadata: { 
                                  pillText,
                                  messageId: message.id, // Events API extracts this from metadata
                                },
                              }),
                            });
                          } catch (error) {
                            console.error('Error logging follow-up pill click:', error);
                          }
                        }}
                        disabled={isLoading}
                      />
                    );
                  })()}
                  
                  {/* Suggestion pills after final intake message */}
                  {message.role === 'assistant' &&
                   message.content?.includes("When our conversation is finished") &&
                   intakeSuggestionPills.length > 0 && (
                    <SuggestionPills
                      pills={intakeSuggestionPills}
                      onPillClick={handlePillClick}
                      className="mt-4 w-full"
                    />
                  )}
                  
                  {/* Phase 4: Source attribution - inside message bubble at the end */}
                  {message.role === 'assistant' && message.context && (
                    <SourceAttribution
                      chunkIds={[]} // Will be extracted from context by component
                      chatbotId={chatbotId}
                      messageContext={message.context}
                      textColor={currentBubbleStyle.text}
                    />
                  )}
                </div>
                
                {/* Message actions for user messages */}
                {/* Hide Branch button for intake messages */}
                {message.role === 'user' && message.content && !isLoading && !isIntakeMessage && (
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
                {/* Hide copy/save buttons for intake messages and the final intake message with suggestion pills */}
                {message.role === 'assistant' && message.content && !isLoading && !isIntakeMessage && (
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
            </div>
          );
          });
        })()}

        {/* Intake UI is now rendered in the input area for seamless experience */}
        {/* Show loading state while hook initializes */}
        {intakeGate.gateState === 'intake' && intakeHook && !intakeHook.isInitialized && (
          <div 
            className="text-center mt-8 opacity-80"
            style={{ color: currentBubbleStyle.text }}
          >
            <p className="text-sm">Loading intake questions...</p>
          </div>
        )}
        {/* Show error if initialization failed */}
        {intakeGate.gateState === 'intake' && intakeHook && intakeHook.isInitialized && intakeHook.error && (
          <div 
            className="text-center mt-8 opacity-80"
            style={{ color: currentBubbleStyle.text }}
          >
            <p className="text-sm text-red-500">{intakeHook.error}</p>
          </div>
        )}

        {/* Loading indicator for regular chat messages */}
        {isLoading && messages[messages.length - 1]?.role === 'assistant' && 
         messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start w-full">
            <div 
              className="px-4 py-2 w-full"
              style={{
                background: 'transparent',
                color: currentBubbleStyle.text,
                boxShadow: 'none',
                border: 'none',
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

        {/* Loading indicator for intake next question */}
        {intakeGate.gateState === 'intake' && intakeHook && intakeHook.isLoadingNextQuestion && (
          <div className="flex justify-start w-full">
            <div 
              className="px-4 py-2 w-full"
              style={{
                background: 'transparent',
                color: currentBubbleStyle.text,
                boxShadow: 'none',
                border: 'none',
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
      </ThemedPage>

      {/* Phase 4: Input area with dynamic pills - always visible, content changes based on intake state */}
      <div 
        className="input-area border-t px-3 py-2 relative"
        style={{
          backgroundColor: chromeColors.input,
          borderColor: chromeColors.border,
        }}
      >
        {/* Toggle button - positioned at top center, half-protruding */}
        {/* Only show toggle when there are pills to display in input area (feedback + expansion, not suggested) */}
        {(() => {
          const pillsToShowInInput = messages.length === 0 
            ? [] // No pills in input area when no messages (suggestion pills shown beneath button instead)
            : pills.filter(p => p.pillType === 'feedback' || p.pillType === 'expansion');
          return pillsToShowInInput.length > 0;
        })() && (
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
        {/* Only show pills in input area if there are pills to display (feedback + expansion after messages, none before messages) */}
        {/* Hide pills during intake conversation - show after final intake message */}
        {(() => {
          // Find the index of the final intake message (contains "When our conversation is finished")
          const finalIntakeMessageIndex = messages.findIndex((msg) => 
            msg.role === 'assistant' && 
            msg.content?.includes("When our conversation is finished")
          );
          
          // If final intake message exists and we have messages after it, show pills
          // Otherwise, check gateState
          const shouldHidePills = (() => {
            if (finalIntakeMessageIndex === -1) {
              // No final intake message - check gateState
              return intakeGate.gateState === 'intake';
            }
            // Final intake message exists - check if we have messages after it
            // If we have messages after the final intake message, we're in regular chat
            const hasMessagesAfterFinal = messages.length > finalIntakeMessageIndex + 1;
            return !hasMessagesAfterFinal && intakeGate.gateState === 'intake';
          })();
          
          if (shouldHidePills) {
            return false;
          }
          
          const pillsToShowInInput = messages.length === 0 
            ? [] // No pills in input area when no messages (suggestion pills shown beneath button instead)
            : pills.filter(p => p.pillType === 'feedback' || p.pillType === 'expansion');
          
          return pillsToShowInInput.length > 0 && pillsVisible;
        })() && (
          <div className="mb-1 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 scrollbar-hide pt-2">
            <div className="flex flex-col gap-0.5 w-max">
              {/* Phase 4: Organize pills into two rows */}
              {/* Before messages: No pills in input area (suggestion pills shown beneath button instead) */}
              {/* After messages: Show feedback + expansion pills only (suggested pills shown above first message) */}
              
              {(() => {
                // Show pills only after AI has finished responding to a user message
                // Check: last message is assistant, has content, not loading, AND we've passed intake phase
                const lastMessage = messages[messages.length - 1];
                
                const shouldShowPills = 
                  messages.length > 0 &&
                  lastMessage?.role === 'assistant' && 
                  lastMessage?.content && 
                  lastMessage.content.trim().length > 0 &&
                  !isLoading &&
                  hasPassedIntakePhase.current; // Only show if we've passed the intake phase
                
                if (!shouldShowPills) {
                  // Before messages, while waiting for AI response, or right after intake completion: No pills in input area
                  return null;
                }
                
                // After AI has finished responding: Two rows with feedback + expansion pills only
                return (
                  <>
                    {/* Row 1: Helpful pill + first half of expansion pills */}
                    {(() => {
                      const expansionPills = pills.filter(p => p.pillType === 'expansion');
                      const firstHalfExpansion = expansionPills.slice(0, Math.ceil(expansionPills.length / 2));
                      return (
                        <PillRow
                          pills={[
                            ...pills.filter(p => p.pillType === 'feedback' && p.label.toLowerCase().includes('helpful') && !p.label.toLowerCase().includes('not')),
                            ...firstHalfExpansion,
                          ]}
                          selectedFeedbackPill={null}
                          selectedExpansionPill={null}
                          onPillClick={handlePillClick}
                        />
                      );
                    })()}
                    
                    {/* Row 2: Not helpful pill + second half of expansion pills */}
                    {(() => {
                      const expansionPills = pills.filter(p => p.pillType === 'expansion');
                      const secondHalfExpansion = expansionPills.slice(Math.ceil(expansionPills.length / 2));
                      return (
                        <PillRow
                          pills={[
                            ...pills.filter(p => p.pillType === 'feedback' && (p.label.toLowerCase().includes('not') || p.label.toLowerCase().includes('not helpful'))),
                            ...secondHalfExpansion,
                          ]}
                          selectedFeedbackPill={null}
                          selectedExpansionPill={null}
                          onPillClick={handlePillClick}
                        />
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        {/* Show intake UI in input area when in intake mode, otherwise show normal input */}
        {/* Only show intake UI if gateState is 'intake' AND we haven't passed the intake phase yet */}
        {/* Removed currentQuestion check - let IntakeFlow handle null case internally */}
        {(() => {
          const shouldRenderIntake = intakeGate.gateState === 'intake' && 
            !hasPassedIntakePhase.current && 
            intakeHook && 
            intakeGate.welcomeData && 
            intakeHook.isInitialized && 
            intakeHook.currentQuestionIndex >= 0;
          
          return shouldRenderIntake ? (
            (() => {
              // TypeScript guard: shouldRenderIntake already ensures welcomeData and intakeHook are non-null
              if (!intakeGate.welcomeData || !intakeHook) {
                return null;
              }
              
              const intakeKey = `intake-${intakeHook.stateVersion}-${intakeHook.currentQuestionIndex}-${intakeHook.mode}`;
              return (
                <IntakeFlow
                  key={intakeKey}
                  intakeHook={intakeHook}
                  welcomeData={intakeGate.welcomeData!}
                  themeColors={{ ...chromeColors, inputField: chromeColors.inputField, text: chromeTextColor }}
                  textColor={chromeTextColor}
                />
              );
            })()
          ) : null;
        })()}
        {intakeGate.gateState !== 'intake' || hasPassedIntakePhase.current || !intakeHook || !intakeGate.welcomeData || !intakeHook.isInitialized || intakeHook.currentQuestionIndex < 0 ? (
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={conversationStatus === 'completed' ? 'This conversation is completed. Start a new conversation to continue.' : 'Type a reply...'}
              disabled={isLoading || conversationStatus === 'completed'}
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
              disabled={!input.trim() || isLoading || conversationStatus === 'completed'}
              className="px-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[44px] opacity-80"
              title="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        ) : null}
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

      {/* Chatbot Settings Modal */}
      <ChatbotSettingsModal
        chatbotId={chatbotId}
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
      />
    </div>
  );
}
