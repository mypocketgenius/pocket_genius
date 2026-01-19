/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useIntakeGate } from '@/hooks/use-intake-gate';

// Mock fetch globally
global.fetch = jest.fn();

describe('useIntakeGate', () => {
  const mockChatbotId = 'chatbot-123';
  const mockWelcomeData = {
    chatbotName: 'Test Chatbot',
    chatbotPurpose: 'Help you test',
    intakeCompleted: false,
    hasQuestions: true,
    questions: [
      {
        id: 'q1',
        questionText: 'What is your name?',
        helperText: null,
        responseType: 'TEXT' as const,
        displayOrder: 1,
        isRequired: true,
        options: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('gate state transitions', () => {
    it('should start in checking state', () => {
      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      expect(result.current.gateState).toBe('checking');
      expect(result.current.welcomeData).toBeNull();
    });

    it('should transition to intake when hasQuestions and not completed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          hasQuestions: true,
          intakeCompleted: false,
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('intake');
      });

      expect(result.current.welcomeData).toBeDefined();
      expect(result.current.welcomeData?.hasQuestions).toBe(true);
      expect(result.current.welcomeData?.intakeCompleted).toBe(false);
    });

    it('should transition to chat when intakeCompleted is true', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          hasQuestions: true,
          intakeCompleted: true,
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });

      expect(result.current.welcomeData?.intakeCompleted).toBe(true);
    });

    it('should transition to chat when hasQuestions is false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          hasQuestions: false,
          intakeCompleted: false,
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });

      expect(result.current.welcomeData?.hasQuestions).toBe(false);
    });
  });

  describe('conversationId handling', () => {
    it('should skip to chat when conversationId exists', () => {
      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, 'conv-123', true, true)
      );

      expect(result.current.gateState).toBe('chat');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication handling', () => {
    it('should skip to chat when not signed in', () => {
      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, false, true)
      );

      expect(result.current.gateState).toBe('chat');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip to chat when auth not loaded', () => {
      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, false)
      );

      expect(result.current.gateState).toBe('chat');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('welcome data fetching', () => {
    it('should fetch welcome data from correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWelcomeData,
      });

      renderHook(() => useIntakeGate(mockChatbotId, null, true, true));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/chatbots/${mockChatbotId}/welcome`
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });

      expect(result.current.welcomeData).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });

      expect(result.current.welcomeData).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('onIntakeComplete callback', () => {
    it('should transition to chat when intake completes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          hasQuestions: true,
          intakeCompleted: false,
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('intake');
      });

      // Simulate intake completion
      result.current.onIntakeComplete('conv-123');

      // Wait for state update
      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle welcome data with existing responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          existingResponses: {
            q1: 'John Doe',
          },
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('intake');
      });

      expect(result.current.welcomeData?.existingResponses).toBeDefined();
      expect(result.current.welcomeData?.existingResponses?.q1).toBe('John Doe');
    });

    it('should handle empty questions array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockWelcomeData,
          hasQuestions: false,
          questions: [],
        }),
      });

      const { result } = renderHook(() =>
        useIntakeGate(mockChatbotId, null, true, true)
      );

      await waitFor(() => {
        expect(result.current.gateState).toBe('chat');
      });
    });
  });
});

