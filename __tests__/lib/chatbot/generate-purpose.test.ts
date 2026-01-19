/**
 * @jest-environment node
 */

// __tests__/lib/chatbot/generate-purpose.test.ts
// Task 6: Unit tests for purpose text generator utility
// Tests purpose generation for all chatbot types (Subtask 6.2)

import { generatePurposeText, ChatbotForPurpose } from '@/lib/chatbot/generate-purpose';

describe('generatePurposeText', () => {
  describe('BODY_OF_WORK chatbot type', () => {
    it('should generate purpose text with creator name', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'BODY_OF_WORK',
        creator: { name: 'Sun Tzu' },
        title: 'The Art of War',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Sun Tzu into your life');
    });

    it('should handle creator names with special characters', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'BODY_OF_WORK',
        creator: { name: "O'Brien" },
        title: 'Some Work',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe("Integrate the lessons of O'Brien into your life");
    });
  });

  describe('DEEP_DIVE chatbot type', () => {
    it('should generate purpose text with first source title', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'DEEP_DIVE',
        creator: { name: 'Author' },
        title: 'Chatbot Title',
        sources: [{ title: 'The Art of War' }],
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of The Art of War into your life');
    });

    it('should fallback to chatbot title if no sources', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'DEEP_DIVE',
        creator: { name: 'Author' },
        title: 'Chatbot Title',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Chatbot Title into your life');
    });

    it('should use first source when multiple sources exist', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'DEEP_DIVE',
        creator: { name: 'Author' },
        title: 'Chatbot Title',
        sources: [
          { title: 'First Source' },
          { title: 'Second Source' },
        ],
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of First Source into your life');
    });
  });

  describe('FRAMEWORK chatbot type', () => {
    it('should generate purpose text with chatbot title', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        title: 'Framework Name',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Framework Name into your life');
    });

    it('should handle framework titles with special characters', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        title: 'Framework: The Complete Guide',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Framework: The Complete Guide into your life');
    });
  });

  describe('ADVISOR_BOARD chatbot type', () => {
    it('should generate purpose text with creator name (single creator for now)', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'ADVISOR_BOARD',
        creator: { name: 'Advisor One' },
        title: 'Advisor Board',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Advisor One into your life');
    });

    it('should handle advisor names correctly', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'ADVISOR_BOARD',
        creator: { name: 'Multiple Advisors' },
        title: 'Board Title',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of Multiple Advisors into your life');
    });
  });

  describe('Edge cases', () => {
    it('should return fallback text when chatbot type is null', () => {
      const chatbot: ChatbotForPurpose = {
        type: null,
        creator: { name: 'Creator' },
        title: 'Title',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('integrate lessons into your life');
    });

    it('should return fallback text for unknown chatbot type', () => {
      const chatbot = {
        type: 'UNKNOWN_TYPE' as any,
        creator: { name: 'Creator' },
        title: 'Title',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('integrate lessons into your life');
    });

    it('should handle empty strings gracefully', () => {
      const chatbot: ChatbotForPurpose = {
        type: 'BODY_OF_WORK',
        creator: { name: '' },
        title: '',
      };

      const result = generatePurposeText(chatbot);
      expect(result).toBe('Integrate the lessons of  into your life');
    });
  });
});

