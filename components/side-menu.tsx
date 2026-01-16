'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, SignOutButton, SignInButton, useClerk } from '@clerk/nextjs';
import { X, Palette, LogOut, User, MessageSquare, Heart, BarChart, FileText, Upload, Settings } from 'lucide-react';
import { ThemeSettings } from './theme-settings';
import { SideMenuItem } from './side-menu-item';
import { ChatbotDetailModal } from './chatbot-detail-modal';
import { Chatbot } from '@/lib/types/chatbot';
import { useTheme } from '../lib/theme/theme-context';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
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
export function SideMenu({ isOpen, onClose, onOpen }: SideMenuProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const theme = useTheme();

  // Theme-aware hover colors
  const hoverBgColor = theme.theme === 'light' 
    ? 'rgba(0, 0, 0, 0.05)' 
    : 'rgba(255, 255, 255, 0.1)';
  
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
  const backdropRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);
  const swipeJustEnded = useRef(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
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
    // Capture ref value at start of effect to avoid stale closure in cleanup
    const sidebarElement = sidebarRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      
      // Check if touch started near right edge (within edgeThreshold)
      if (screenWidth - touchX <= edgeThreshold) {
        touchStartX.current = touchX;
        touchStartY.current = touchY;
        isSwiping.current = false;
        // Make sidebar visible immediately when touch starts near edge (for swipe-to-open)
        if (!isOpen) {
          setIsSwipeActive(true);
        }
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
        isSwiping.current = false;
        setIsSwipeActive(false);
        if (sidebarRef.current) {
          sidebarRef.current.style.transform = '';
          sidebarRef.current.style.transition = '';
        }
        return;
      }
      
      // Mark as swiping if we've moved horizontally
      if (Math.abs(deltaX) > 5) {
        isSwiping.current = true;
        setIsSwipeActive(true);
        e.preventDefault(); // Prevent scrolling during swipe
      }
      
      if (!sidebarRef.current) return;
      
      const sidebarWidth = sidebarRef.current.offsetWidth;
      
      if (isOpen) {
        // Sidebar is open: swiping right (positive deltaX) closes it
        // translateX should be positive (moves sidebar right/off-screen)
        const translateX = Math.min(Math.max(deltaX, 0), sidebarWidth);
        sidebarRef.current.style.transition = 'none'; // Disable transition during swipe
        sidebarRef.current.style.transform = `translateX(${translateX}px)`;
      } else {
        // Sidebar is closed: swiping left (negative deltaX) opens it
        // Start from off-screen (100%) and move left (negative translateX)
        // translateX should be negative (moves sidebar left/on-screen)
        const translateX = Math.max(Math.min(deltaX, 0), -sidebarWidth);
        sidebarRef.current.style.transition = 'none'; // Disable transition during swipe
        sidebarRef.current.style.transform = `translateX(calc(100% + ${translateX}px))`;
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      
      if (!sidebarRef.current) {
        touchStartX.current = null;
        touchStartY.current = null;
        isSwiping.current = false;
        return;
      }
      
      // Mark that a swipe just ended to prevent backdrop clicks
      swipeJustEnded.current = true;
      setTimeout(() => {
        swipeJustEnded.current = false;
      }, 300); // Prevent backdrop clicks for 300ms after swipe ends
      
      // Re-enable transition for smooth snap
      sidebarRef.current.style.transition = '';
      
      // Determine if swipe threshold was met
      // Only proceed if we actually detected a swipe gesture
      if (isSwiping.current && Math.abs(deltaX) > swipeThreshold) {
        if (isOpen) {
          // Sidebar is open: swiping right (positive deltaX) closes it
          if (deltaX > swipeThreshold) {
            onClose();
          } else {
            // Swiped but not enough in closing direction, snap back to open
            sidebarRef.current.style.transform = '';
          }
        } else {
          // Sidebar is closed: swiping left (negative deltaX) opens it
          if (deltaX < -swipeThreshold) {
            onOpen();
          } else {
            // Swiped but not enough in opening direction, snap back to closed
            sidebarRef.current.style.transform = '';
          }
        }
      } else {
        // Didn't meet threshold or wasn't a valid swipe, snap back to current state
        // This ensures sidebar stays open if it was open, stays closed if it was closed
        sidebarRef.current.style.transform = '';
      }
      
      touchStartX.current = null;
      touchStartY.current = null;
      isSwiping.current = false;
      setIsSwipeActive(false);
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
      // Reset transform on cleanup - use captured ref value from effect start
      if (sidebarElement) {
        sidebarElement.style.transform = '';
        sidebarElement.style.transition = '';
      }
      setIsSwipeActive(false);
    };
  }, [isOpen, onClose, onOpen]);
  
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
  
  // Handle chat item click - navigate to specific conversation
  const handleChatClick = (chatbotId: string, conversationId: string) => {
    onClose();
    router.push(`/chat/${chatbotId}?conversationId=${conversationId}`);
  };
  
  // Handle favorite item click
  const handleFavoriteClick = (chatbot: Chatbot) => {
    setSelectedChatbot(chatbot);
    setChatbotModalOpen(true);
  };
  
  // Handle start chat from modal - always start fresh conversation
  const handleStartChat = (chatbotId: string) => {
    setChatbotModalOpen(false);
    onClose();
    router.push(`/chat/${chatbotId}?new=true`);
  };
  
  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => {
          // Prevent backdrop click if a swipe gesture just ended or is in progress
          if (swipeJustEnded.current || touchStartX.current !== null || isSwiping.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClose();
        }}
        onTouchStart={(e) => {
          // Prevent backdrop touch if we're in the middle of a swipe
          if (touchStartX.current !== null || isSwiping.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }}
        onTouchEnd={(e) => {
          // Prevent backdrop touch end from triggering click if swipe just ended
          if (swipeJustEnded.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full w-full max-w-[600px] z-50 shadow-xl transform transition-transform duration-300 ease-out"
        style={{ 
          backgroundColor: theme.chrome.header,
          color: theme.textColor,
          borderColor: theme.chrome.border,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          visibility: isOpen || isSwipeActive ? 'visible' : 'hidden',
          transition: 'background-color 2s ease, border-color 2s ease, color 2s ease, transform 300ms ease-out',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            {isSignedIn && user ? (
              <div>
                <p className="font-semibold text-sm" style={{ color: theme.textColor }}>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || 'User'}
                </p>
                <p className="text-xs opacity-80" style={{ color: theme.textColor }}>{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            ) : (
              <div></div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors opacity-80"
              style={{ color: theme.textColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = hoverBgColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Sign In Button - shown when not signed in */}
            {!isSignedIn && (
              <div className="px-4 pt-4 pb-4">
                <SignInButton mode="modal">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-center gap-3 transition-colors rounded-md bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => onClose()}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign In</span>
                  </button>
                </SignInButton>
              </div>
            )}
            
            {/* Creator Dashboard */}
            <div className="px-4 pt-4 pb-0">
              <button
                onClick={() => {
                  router.push('/dashboard');
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors rounded-md"
                style={{ color: theme.textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = hoverBgColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <BarChart className="w-5 h-5 opacity-80" style={{ color: theme.textColor }} />
                <span className="text-sm font-medium">Creator Dashboard</span>
              </button>
            </div>
            
            {/* Account Section */}
            {isSignedIn && user && (
              <div className="px-4 pt-2 pb-0 space-y-0">
                <button
                  onClick={() => {
                    router.push('/profile');
                    onClose();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors rounded-md"
                  style={{ color: theme.textColor }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBgColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Settings className="w-5 h-5 opacity-80" style={{ color: theme.textColor }} />
                  <span className="text-sm font-medium">Profile Settings</span>
                </button>
                <button
                  onClick={() => {
                    // Open Clerk's user profile modal
                    clerk.openUserProfile();
                    onClose(); // Close sidebar when opening profile
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors rounded-md"
                  style={{ color: theme.textColor }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBgColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <User className="w-5 h-5 opacity-80" style={{ color: theme.textColor }} />
                  <span className="text-sm font-medium">Manage Account</span>
                </button>
              </div>
            )}
            
            {/* Theme Button - available to everyone */}
            <div className="px-4 pt-2 pb-4">
              <button
                onClick={() => setThemeSettingsOpen(true)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors rounded-md"
                style={{ color: theme.textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = hoverBgColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Palette className="w-5 h-5 opacity-80" style={{ color: theme.textColor }} />
                <span className="text-sm font-medium">Theme</span>
              </button>
            </div>
            
            {/* Test Pages */}
            {isSignedIn && (
              <div className="px-4 pt-2 pb-4 border-t mt-2" style={{ borderColor: theme.chrome.border }}>
                <div className="pt-2 space-y-1">
                  <button
                    onClick={() => {
                      router.push('/test-files');
                      onClose();
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left transition-colors rounded-md"
                    style={{ color: theme.textColor }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <FileText className="w-4 h-4 opacity-80" style={{ color: theme.textColor }} />
                    <span className="text-sm font-medium">Test Files</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/test-upload');
                      onClose();
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left transition-colors rounded-md"
                    style={{ color: theme.textColor }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Upload className="w-4 h-4 opacity-80" style={{ color: theme.textColor }} />
                    <span className="text-sm font-medium">Test Upload</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Toggle */}
            <div className="p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('chats')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'chats'
                      ? 'bg-blue-500 text-white'
                      : ''
                  }`}
                  style={activeTab !== 'chats' ? {
                    backgroundColor: hoverBgColor,
                    color: theme.textColor,
                  } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'chats') {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'chats') {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }
                  }}
                >
                  <MessageSquare className={`w-4 h-4 ${activeTab === 'chats' ? 'text-white' : ''}`} style={activeTab !== 'chats' ? { color: theme.textColor, opacity: 0.8 } : {}} />
                  Your Chats
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'favorites'
                      ? 'bg-blue-500 text-white'
                      : ''
                  }`}
                  style={activeTab !== 'favorites' ? {
                    backgroundColor: hoverBgColor,
                    color: theme.textColor,
                  } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'favorites') {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'favorites') {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }
                  }}
                >
                  <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'text-white' : ''}`} style={activeTab !== 'favorites' ? { color: theme.textColor, opacity: 0.8 } : {}} />
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
                        <div className="h-4 rounded w-3/4 mb-1 opacity-20" style={{ backgroundColor: theme.textColor }}></div>
                        <div className="h-3 rounded w-1/2 opacity-10" style={{ backgroundColor: theme.textColor }}></div>
                      </div>
                    ))}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="p-8 text-center opacity-80" style={{ color: theme.textColor }}>
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
                        onClick={() => handleChatClick(conversation.chatbotId, conversation.id)}
                      />
                    ))}
                  </div>
                )
              ) : (
                isLoadingFavorites ? (
                  <div className="px-4 py-2 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 rounded w-3/4 mb-1 opacity-20" style={{ backgroundColor: theme.textColor }}></div>
                        <div className="h-3 rounded w-1/2 opacity-10" style={{ backgroundColor: theme.textColor }}></div>
                      </div>
                    ))}
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="p-8 text-center opacity-80" style={{ color: theme.textColor }}>
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
            <div className="p-4">
              <SignOutButton>
                <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-red-50 transition-colors rounded-md text-red-600 hover:text-red-700">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
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

