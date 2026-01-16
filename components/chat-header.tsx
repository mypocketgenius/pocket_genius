'use client';

/**
 * ChatHeader component - Custom header for chat page with theme support
 * 
 * This component extracts the chat-specific header logic from chat.tsx into a reusable component.
 * It applies:
 * - Chrome colors: theme.chrome.header (background), theme.chrome.border (border), theme.textColor (text)
 * - Theme-aware hover states for interactive elements
 * - Renders back button, settings button (cog + title), star rating, and menu button
 * 
 * Usage:
 * ```tsx
 * <ChatHeader
 *   chatbotTitle="My Chatbot"
 *   conversationId="conv-123"
 *   chatbotId="bot-456"
 *   messages={messages}
 *   error={error}
 *   onBack={() => router.back()}
 *   onMenuClick={() => setSideMenuOpen(true)}
 *   onSettingsClick={() => setSettingsModalOpen(true)}
 * />
 * ```
 */

import React from 'react';
import { ArrowLeft, Menu, Settings } from 'lucide-react';
import { StarRating } from './star-rating';
import { useTheme } from '../lib/theme/theme-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHeaderProps {
  chatbotTitle: string;
  conversationId: string | null;
  chatbotId: string;
  messages: Message[];
  error: string | null;
  onBack: () => void;
  onMenuClick: () => void;
  onSettingsClick?: () => void;
  isSignedIn?: boolean;
}

export function ChatHeader({
  chatbotTitle,
  conversationId,
  chatbotId,
  messages,
  error,
  onBack,
  onMenuClick,
  onSettingsClick,
  isSignedIn = false,
}: ChatHeaderProps) {
  const theme = useTheme();

  // Theme-aware hover colors
  const hoverBgColor = theme.theme === 'light' 
    ? 'rgba(0, 0, 0, 0.05)' 
    : 'rgba(255, 255, 255, 0.1)';

  return (
    <div 
      className="app-header border-b px-4 py-2.5"
      style={{
        backgroundColor: theme.chrome.header,
        borderColor: theme.chrome.border,
        color: theme.textColor,
        transition: 'background-color 2s ease, border-color 2s ease, color 2s ease',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors opacity-80 flex-shrink-0"
            style={{
              color: theme.textColor,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hoverBgColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Go back"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-2 flex-1 min-w-0 transition-colors opacity-80 hover:opacity-100 cursor-pointer"
            style={{
              color: theme.textColor,
            }}
            onMouseEnter={(e) => {
              if (onSettingsClick) {
                e.currentTarget.style.backgroundColor = hoverBgColor;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Open chatbot settings"
            title="Chatbot settings"
            disabled={!onSettingsClick}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <h1 className="text-xl font-semibold truncate">{chatbotTitle}</h1>
          </button>
        </div>
        
        {/* Star rating in header */}
        {conversationId && (
          <div className="flex-shrink-0">
            <StarRating
              chatbotId={chatbotId}
              sessionId={conversationId}
              messageCount={messages.filter(m => m.role === 'user').length}
            />
          </div>
        )}
        
        {/* Side menu button - always visible */}
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 p-2 rounded-lg transition-colors opacity-80"
          style={{
            color: theme.textColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hoverBgColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Open menu"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm opacity-80">
          {error}
        </div>
      )}
    </div>
  );
}

