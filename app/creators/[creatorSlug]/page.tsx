'use client';

// Phase 3.7.5: Creator Profile Page
// Displays creator information and their chatbots

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Globe, 
  Linkedin, 
  Twitter, 
  Facebook, 
  Music, 
  Youtube,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatbotCard } from '@/components/chatbot-card';
import { AppHeader } from '@/components/app-header';
import { Chatbot } from '@/lib/types/chatbot';

interface Creator {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: {
    website?: string;
    linkedin?: string;
    x?: string;
    facebook?: string;
    tiktok?: string;
    masterclass?: string;
    youtube?: string;
  } | null;
}

interface ChatbotsResponse {
  chatbots: Chatbot[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

/**
 * Creator Profile Page Component
 * 
 * Features:
 * - Creator header with avatar, name, bio, social links
 * - Creator's chatbots grid (reusing ChatbotCard component)
 * - Breadcrumb navigation: Home > Creators > [Creator Name]
 * - Loading states with skeletons
 * - Error handling (404 for invalid slug, empty state for no chatbots)
 * - "Load More" pagination if >20 chatbots
 */
export default function CreatorPage() {
  const params = useParams();
  const router = useRouter();
  const creatorSlug = params.creatorSlug as string;

  // State
  const [creator, setCreator] = useState<Creator | null>(null);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoadingCreator, setIsLoadingCreator] = useState(true);
  const [isLoadingChatbots, setIsLoadingChatbots] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ChatbotsResponse['pagination'] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Fetch chatbots helper function
  const fetchChatbots = useCallback(async (page: number, reset: boolean) => {
    if (!creator) return;

    try {
      if (reset) {
        setIsLoadingChatbots(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await fetch(
        `/api/chatbots/public?creator=${creator.id}&page=${page}&pageSize=20`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch chatbots');
      }

      const data: ChatbotsResponse = await response.json();

      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }

      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching chatbots:', err);
      setError('Failed to load chatbots');
    } finally {
      setIsLoadingChatbots(false);
      setIsLoadingMore(false);
    }
  }, [creator]);

  // Fetch creator data
  useEffect(() => {
    async function fetchCreator() {
      try {
        setIsLoadingCreator(true);
        const response = await fetch(`/api/creators/${creatorSlug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Creator not found');
            return;
          }
          throw new Error('Failed to fetch creator');
        }

        const data = await response.json();
        setCreator(data.creator);
      } catch (err) {
        console.error('Error fetching creator:', err);
        setError('Failed to load creator information');
      } finally {
        setIsLoadingCreator(false);
      }
    }

    if (creatorSlug) {
      fetchCreator();
    }
  }, [creatorSlug]);

  // Fetch chatbots for this creator
  useEffect(() => {
    if (creator) {
      fetchChatbots(1, true);
    }
  }, [creator, fetchChatbots]);

  // Handle "Load More" button
  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.totalPages && creator) {
      fetchChatbots(currentPage + 1, false);
    }
  };

  // Handle favorite toggle
  const handleFavoriteToggle = (chatbotId: string, isFavorite: boolean) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (isFavorite) {
        newSet.add(chatbotId);
      } else {
        newSet.delete(chatbotId);
      }
      return newSet;
    });
  };

  // Render social link icon
  const renderSocialIcon = (platform: string) => {
    const iconProps = { className: 'w-5 h-5' };
    
    switch (platform) {
      case 'website':
        return <Globe {...iconProps} />;
      case 'linkedin':
        return <Linkedin {...iconProps} />;
      case 'x':
        return <Twitter {...iconProps} />;
      case 'facebook':
        return <Facebook {...iconProps} />;
      case 'tiktok':
        return <Music {...iconProps} />;
      case 'youtube':
        return <Youtube {...iconProps} />;
      case 'masterclass':
        return <Globe {...iconProps} />;
      default:
        return <Globe {...iconProps} />;
    }
  };

  // 404 page for invalid creator slug
  if (!isLoadingCreator && error === 'Creator not found') {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Creator not found</h1>
            <p className="text-gray-600 mb-6">The creator you&apos;re looking for doesn&apos;t exist.</p>
            <Link
              href="/"
              className="text-blue-600 hover:underline font-medium"
            >
              Return to homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Creators
          </Link>
          {creator && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-medium">{creator.name}</span>
            </>
          )}
        </nav>

        {/* Creator Header */}
        {isLoadingCreator ? (
          <Card className="p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </Card>
        ) : creator ? (
          <Card className="p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {creator.avatarUrl ? (
                  <Image
                    src={creator.avatarUrl}
                    alt={creator.name}
                    width={128}
                    height={128}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 text-5xl font-semibold">
                      {creator.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Creator Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {creator.name}
                </h1>
                
                {creator.bio && (
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {creator.bio}
                  </p>
                )}

                {/* Social Links */}
                {creator.socialLinks && Object.keys(creator.socialLinks).length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(creator.socialLinks).map(([platform, url]) => {
                      if (!url) return null;
                      
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                          aria-label={`Visit ${creator.name}'s ${platform}`}
                        >
                          {renderSocialIcon(platform)}
                          <span className="text-sm capitalize">{platform}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : null}

        {/* Error Alert */}
        {error && error !== 'Creator not found' && (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Chatbots Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {creator ? `Chatbots by ${creator.name}` : 'Chatbots'}
          </h2>

          {isLoadingChatbots ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="w-full h-48" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : chatbots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg mb-2">No chatbots yet</p>
              <p className="text-sm text-gray-500">
                This creator hasn&apos;t published any chatbots.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {chatbots.map((chatbot) => (
                  <ChatbotCard
                    key={chatbot.id}
                    chatbot={chatbot}
                    isFavorite={favorites.has(chatbot.id)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {pagination && currentPage < pagination.totalPages && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

