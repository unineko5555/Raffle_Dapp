"use client";

// シンプルな自動化ログフック
export function useAutomationLogger() {
  const logAutomationEvent = (eventType: string, data: any) => {
    console.log(`[Automation] ${eventType}:`, data);
  };

  return {
    logAutomationEvent
  };
}
