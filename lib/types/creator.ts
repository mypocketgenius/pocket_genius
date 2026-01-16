/**
 * Shared type definitions for Creator entities
 * 
 * These types match the API response format from `/api/creators`
 * Used across components to ensure type consistency
 */

export interface Creator {
  id: string;
  slug: string | null;  // Can be null - creators without slugs are filtered out
  name: string;
  avatarUrl: string | null;
  bio: string | null;        // Full bio
  shortBio: string | null;   // Short bio for cards
  chatbotCount: number;
}

