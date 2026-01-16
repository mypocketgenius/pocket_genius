// __tests__/lib/hooks/use-debounce.test.ts
// Phase 3.7.4: Unit tests for useDebounce hook
// Tests debounce functionality for search

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '@/lib/hooks/use-debounce';

// Mock timers
jest.useFakeTimers();

describe('useDebounce', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 299ms (just before delay)
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Fast-forward time by 1ms more (after delay)
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should use custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    // Value should not change after 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    // Value should change after 500ms
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timer when value changes rapidly', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Change value multiple times rapidly
    rerender({ value: 'first', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'second', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'third', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // After full delay from last change, should be 'third'
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('third');
  });

  it('should handle number values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 300 },
      }
    );

    rerender({ value: 42, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(42);
  });

  it('should handle object values', async () => {
    const initialObj = { name: 'initial' };
    const updatedObj = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialObj, delay: 300 },
      }
    );

    rerender({ value: updatedObj, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toEqual(updatedObj);
  });
});







