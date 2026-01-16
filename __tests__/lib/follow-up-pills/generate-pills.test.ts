// __tests__/lib/follow-up-pills/generate-pills.test.ts
// Unit tests for follow-up pills generation module
// Task 4.1: Write unit tests for generate-pills.ts module

import { generateFollowUpPills, GeneratePillsOptions } from '@/lib/follow-up-pills/generate-pills';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock console methods to avoid noise in test output
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('generateFollowUpPills', () => {
  let mockOpenAICreate: jest.Mock;
  let mockOpenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock OpenAI instance
    mockOpenAICreate = jest.fn();
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    };
    
    (OpenAI as jest.Mock).mockImplementation(() => mockOpenAIInstance);
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const defaultOptions: GeneratePillsOptions = {
    assistantResponse: 'The Art of War emphasizes strategic positioning and understanding your enemy.',
    configJson: null,
    chatbotId: 'chatbot-123',
    conversationId: 'conv-456',
  };

  describe('successful generation', () => {
    it('should generate follow-up pills successfully by default', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: [
                'Tell me more about strategic positioning',
                'Give examples of understanding your enemy',
                'How would I apply this in practice?',
              ],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toHaveLength(3);
      expect(result.pills).toEqual([
        'Tell me more about strategic positioning',
        'Give examples of understanding your enemy',
        'How would I apply this in practice?',
      ]);
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('should track generation time', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1', 'Question 2'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const startTime = Date.now();
      const result = await generateFollowUpPills(defaultOptions);
      const endTime = Date.now();

      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.generationTimeMs).toBeLessThanOrEqual(endTime - startTime + 100); // Allow some margin
    });

    it('should use correct OpenAI API parameters', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      await generateFollowUpPills(defaultOptions);

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'assistant', content: defaultOptions.assistantResponse }),
            expect.objectContaining({ role: 'user' }),
          ]),
          response_format: { type: 'json_object' },
          temperature: 0.8,
        })
      );
    });
  });

  describe('feature toggle', () => {
    it('should return empty array when feature is disabled', async () => {
      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { enableFollowUpPills: false },
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toEqual([]);
      expect(result.generationTimeMs).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockOpenAICreate).not.toHaveBeenCalled();
    });

    it('should generate pills when enableFollowUpPills is true', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { enableFollowUpPills: true },
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('should generate pills when enableFollowUpPills is null (default enabled)', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { enableFollowUpPills: null },
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('should generate pills when enableFollowUpPills is undefined (default enabled)', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: {},
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom prompts', () => {
    it('should use custom prompt when provided', async () => {
      const customPrompt = 'Generate strategic follow-up questions about The Art of War. Return ONLY JSON: {"followUps": ["question 1"]}';
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Custom question'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { followUpPillsPrompt: customPrompt },
      };

      await generateFollowUpPills(options);

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: customPrompt,
            }),
          ]),
        })
      );
    });

    it('should use default prompt when custom prompt is empty string', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { followUpPillsPrompt: '' },
      };

      await generateFollowUpPills(options);

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      
      // Should use default prompt (contains "Based on the assistant's response")
      expect(userMessage.content).toContain("Based on the assistant's response");
    });

    it('should use default prompt when custom prompt is whitespace only', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: { followUpPillsPrompt: '   ' },
      };

      await generateFollowUpPills(options);

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      
      // Should use default prompt (contains "Based on the assistant's response")
      expect(userMessage.content).toContain("Based on the assistant's response");
    });

    it('should use default prompt when followUpPillsPrompt is not set', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      await generateFollowUpPills(defaultOptions);

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      
      // Should use default prompt (contains "Based on the assistant's response")
      expect(userMessage.content).toContain("Based on the assistant's response");
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new Error('OpenAI API error');
      mockOpenAICreate.mockRejectedValue(apiError);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('OpenAI API error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockOpenAICreate.mockRejectedValue(networkError);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle invalid JSON responses', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: 'invalid json',
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      // Should return empty array when JSON parsing fails
      expect(result.pills).toEqual([]);
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing followUps field in JSON', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ otherField: 'value' }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
    });

    it('should handle followUps field that is not an array', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ followUps: 'not an array' }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
    });

    it('should handle empty followUps array', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ followUps: [] }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
    });

    it('should handle missing message content', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {},
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual([]);
    });

    it('should log error details for monitoring', async () => {
      const apiError = new Error('API error');
      mockOpenAICreate.mockRejectedValue(apiError);

      await generateFollowUpPills(defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error generating follow-up pills:',
        apiError
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Pill generation error details:',
        expect.objectContaining({
          error: 'API error',
          chatbotId: 'chatbot-123',
          conversationId: 'conv-456',
          responseLength: expect.any(Number),
        })
      );
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON with followUps array', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1', 'Question 2', 'Question 3'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      expect(result.pills).toEqual(['Question 1', 'Question 2', 'Question 3']);
      expect(Array.isArray(result.pills)).toBe(true);
      expect(result.pills.every(p => typeof p === 'string')).toBe(true);
    });

    it('should handle non-string values in followUps array', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Valid string', 123, null, { obj: 'value' }],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const result = await generateFollowUpPills(defaultOptions);

      // Should return array as-is (filtering happens in component if needed)
      expect(result.pills).toHaveLength(4);
    });
  });

  describe('edge cases', () => {
    it('should handle empty assistant response', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        assistantResponse: '',
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'assistant',
              content: '',
            }),
          ]),
        })
      );
    });

    it('should handle very long assistant response', async () => {
      const longResponse = 'A'.repeat(10000);
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        assistantResponse: longResponse,
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      // Error logging only happens on errors, not on success
    });

    it('should handle null configJson', async () => {
      const mockPillsResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              followUps: ['Question 1'],
            }),
          },
        }],
      };

      mockOpenAICreate.mockResolvedValue(mockPillsResponse);

      const options: GeneratePillsOptions = {
        ...defaultOptions,
        configJson: null,
      };

      const result = await generateFollowUpPills(options);

      expect(result.pills).toHaveLength(1);
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });
  });
});

