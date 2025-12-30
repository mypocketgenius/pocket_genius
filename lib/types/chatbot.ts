/**
 * Shared type definitions for Chatbot entities
 * 
 * These types match the API response format from `/api/chatbots/public`
 * Used across components to ensure type consistency
 */

export type ChatbotType = 'BODY_OF_WORK' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';

export type CategoryType = 'ROLE' | 'CHALLENGE' | 'STAGE';

export interface Chatbot {
  id: string;
  slug: string;
  title: string;
  description: string | null;        // Full description
  shortDescription: string | null;    // Short description for cards
  imageUrl: string | null;
  type: ChatbotType | null;
  priceCents: number;
  currency: string;
  allowAnonymous: boolean;
  creator: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
  };
  rating: {
    averageRating: number | null;
    ratingCount: number;
  } | null;
  categories: Array<{
    id: string;
    type: CategoryType;
    label: string;
    slug: string;
  }>;
  favoriteCount: number;
  isFavorite?: boolean; // Only present when user is authenticated
}

