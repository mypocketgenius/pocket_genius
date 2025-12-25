'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, SignOutButton, useClerk } from '@clerk/nextjs';
import { X, Settings, LogOut } from 'lucide-react';
import { ThemeSettings } from './theme-settings';
import { SideMenuItem } from './side-menu-item';
import { Button } from './ui/button';
import { ChatbotDetailModal } from './chatbot-detail-modal';
import { Chatbot } from '@/lib/types/chatbot';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Conversation {
  id: string;
  chatbotId: string;
  chatbot: {
    id: string;
    title: string;
    type: Chatbot['type'];
    creator: {
      id: string;
      name: string;
      slug: string;
    };
  };
  updatedAt: string;
  createdAt: string;
  messageCount: number;
}

/**
 * SideMenu Component
 * 
 * Right-side sidebar menu that displays:
 * - Account information (name, email, manage account)
 * - Theme settings button
 * - Toggle between "Your Chats" and "Your Favorites"
 * - List of conversations or favorited chatbots
 * - Sign out button
 * 
 * Features:
 * - Slide-in animation from right
 * - Backdrop overlay (click to close)
 * - Swipe gesture support (swipe from right edge to open/close)
 * - Skeleton loading states
 * - Empty state messages
 */
export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  
  // State management
  const [activeTab, setActiveTab] = useState<'chats' | 'favorites'>('chats');
  const [chats, setChats] = useState<Conversation[]>([]);
  const [favorites, setFavorites] = useState<Chatbot[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [chatbotModalOpen, setChatbotModalOpen] = useState(false);
  
  // Swipe gesture state
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeThreshold = 50; // Minimum swipe distance to trigger open/close
  const edgeThreshold = 20; // Distance from right edge to detect swipe start
  
  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!isSignedIn) return;
    
    setIsLoadingChats(true);
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setChats(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [isSignedIn]);
  
  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    if (!isSignedIn) return;
    
    setIsLoadingFavorites(true);
    try {
      const response = await fetch('/api/favorites?pageSize=100');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.chatbots || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [isSignedIn]);
  
  // Fetch data when tab changes
  useEffect(() => {
    if (isOpen && isSignedIn) {
      if (activeTab === 'chats') {
        fetchConversations();
      } else {
        fetchFavorites();
      }
    }
  }, [isOpen, activeTab, isSignedIn, fetchConversations, fetchFavorites]);
  
  // Swipe gesture handlers - work when sidebar is open or closed
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      
      // Check if touch started near right edge (within edgeThreshold)
      if (screenWidth - touchX <= edgeThreshold) {
        touchStartX.current = touchX;
        touchStartY.current = touchY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      
      // Only handle horizontal swipes (ignore vertical scrolling)
      if (deltaY > 30) {
        // Vertical movement detected, cancel swipe
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }
      
      // Update sidebar position to follow finger (only if sidebar is open)
      if (isOpen && sidebarRef.current) {
        const sidebarWidth = sidebarRef.current.offsetWidth;
        // When sidebar is open: swiping right (positive deltaX) closes it
        // translateX should be positive (moves sidebar right/off-screen)
        const translateX = Math.min(Math.max(deltaX, 0), sidebarWidth);
        sidebarRef.current.style.transform = `translateX(${translateX}px)`;
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      
      // Reset sidebar position (only if sidebar is open and ref exists)
      if (isOpen && sidebarRef.current) {
        sidebarRef.current.style.transform = '';
      }
      
      // Determine if swipe threshold was met
      if (Math.abs(deltaX) > swipeThreshold) {
        if (isOpen) {
          // Sidebar is open: swiping right (positive deltaX) closes it
          if (deltaX > 0) {
            onClose();
          }
        }
        // Note: Swipe-to-open when sidebar is closed would require an onOpen callback
        // For now, swipe-to-open is handled via button click in parent components
      }
      
      touchStartX.current = null;
      touchStartY.current = null;
    };
    
    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose]);
  
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);
  
  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  // Handle chat item click
  const handleChatClick = (chatbotId: string) => {
    onClose();
    router.push(`/chat/${chatbotId}`);
  };
  
  // Handle favorite item click
  const handleFavoriteClick = (chatbot: Chatbot) => {
    setSelectedChatbot(chatbot);
    setChatbotModalOpen(true);
  };
  
  // Handle start chat from modal
  const handleStartChat = (chatbotId: string) => {
    setChatbotModalOpen(false);
    onClose();
    router.push(`/chat/${chatbotId}`);
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full w-full max-w-[600px] bg-white z-50 shadow-xl transform transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Account Section */}
            {isSignedIn && user && (
              <div className="p-4 border-b">
                <div className="mb-2">
                  <p className="font-semibold text-sm">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Open Clerk's user profile modal
                      clerk.openUserProfile();
                      onClose(); // Close sidebar when opening profile
                    }}
                    className="w-full"
                  >
                    Manage Account
                  </Button>
                </div>
              </div>
            )}
            
            {/* Theme Settings Button */}
            <div className="p-4 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setThemeSettingsOpen(true)}
                className="w-full justify-start"
              >
                <Settings className="w-4 h-4 mr-2" />
                Theme Settings
              </Button>
            </div>
            
            {/* Toggle */}
            <div className="p-4 border-b">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('chats')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'chats'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Your Chats
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'favorites'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Your Favorites
                </button>
              </div>
            </div>
            
            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'chats' ? (
                isLoadingChats ? (
                  <div className="px-4 py-2 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">FIND CHATS ON THE HOMESCREEN</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {chats.map((conversation) => (
                      <SideMenuItem
                        key={conversation.id}
                        title={conversation.chatbot.title}
                        type={conversation.chatbot.type}
                        creatorName={conversation.chatbot.creator.name}
                        onClick={() => handleChatClick(conversation.chatbotId)}
                      />
                    ))}
                  </div>
                )
              ) : (
                isLoadingFavorites ? (
                  <div className="px-4 py-2 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">FIND CHATS ON THE HOMESCREEN</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {favorites.map((chatbot) => (
                      <SideMenuItem
                        key={chatbot.id}
                        title={chatbot.title}
                        type={chatbot.type}
                        creatorName={chatbot.creator.name}
                        onClick={() => handleFavoriteClick(chatbot)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
          
          {/* Footer - Sign Out */}
          {isSignedIn && (
            <div className="p-4 border-t">
              <SignOutButton>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>
      
      {/* Theme Settings Modal */}
      <ThemeSettings
        open={themeSettingsOpen}
        onClose={() => setThemeSettingsOpen(false)}
      />
      
      {/* Chatbot Detail Modal */}
      {selectedChatbot && (
        <ChatbotDetailModal
          chatbot={selectedChatbot}
          open={chatbotModalOpen}
          onClose={() => {
            setChatbotModalOpen(false);
            setSelectedChatbot(null);
          }}
          onStartChat={handleStartChat}
        />
      )}
    </>
  );
}

