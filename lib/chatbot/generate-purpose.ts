/**
 * Purpose text generator for chatbots
 * 
 * Generates purpose text based on chatbot type for use in welcome messages.
 * Purpose text describes what the chatbot helps users achieve.
 */

import { ChatbotType } from '@/lib/types/chatbot';

/**
 * Interface for chatbot data required to generate purpose text
 */
export interface ChatbotForPurpose {
  type: ChatbotType | null;
  creator: { name: string };
  title: string;
  sources?: Array<{ title: string }>;
}

/**
 * Generates purpose text based on chatbot type
 * 
 * Purpose text format: "Integrate the lessons of [entity] into your life"
 * 
 * @param chatbot - Chatbot object with type, creator, title, and optional sources
 * @returns Generated purpose text string
 * 
 * @example
 * // BODY_OF_WORK
 * generatePurposeText({
 *   type: 'BODY_OF_WORK',
 *   creator: { name: 'Sun Tzu' },
 *   title: 'The Art of War'
 * })
 * // Returns: "Integrate the lessons of Sun Tzu into your life"
 * 
 * @example
 * // DEEP_DIVE
 * generatePurposeText({
 *   type: 'DEEP_DIVE',
 *   creator: { name: 'Author' },
 *   title: 'Chatbot Title',
 *   sources: [{ title: 'The Art of War' }]
 * })
 * // Returns: "Integrate the lessons of The Art of War into your life"
 */
export function generatePurposeText(chatbot: ChatbotForPurpose): string {
  // Fallback if chatbot type is not set
  if (!chatbot.type) {
    return 'integrate lessons into your life';
  }

  switch (chatbot.type) {
    case 'BODY_OF_WORK':
      // For BODY_OF_WORK: Use creator name
      return `Integrate the lessons of ${chatbot.creator.name} into your life`;

    case 'DEEP_DIVE':
      // For DEEP_DIVE: Use first source title, or chatbot title as fallback
      const sourceTitle = chatbot.sources?.[0]?.title || chatbot.title;
      return `Integrate the lessons of ${sourceTitle} into your life`;

    case 'FRAMEWORK':
      // For FRAMEWORK: Use chatbot title
      return `Integrate the lessons of ${chatbot.title} into your life`;

    case 'ADVISOR_BOARD':
      // For ADVISOR_BOARD: Using single creator relation for now
      // TODO: Update later to support multiple creators with format
      // "creator 1, creator 2, and creator n"
      return `Integrate the lessons of ${chatbot.creator.name} into your life`;

    default:
      // Fallback for unknown types
      return 'integrate lessons into your life';
  }
}




