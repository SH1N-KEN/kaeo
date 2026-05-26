import { useEffect } from 'react';

const REFRESH_EVENT = 'kaeo_workspace_refresh';

export const triggerWorkspaceRefresh = (reason?: string) => {
  const event = new CustomEvent(REFRESH_EVENT, { detail: { reason } });
  window.dispatchEvent(event);
};

export const subscribeWorkspaceRefresh = (callback: (reason?: string) => void) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ reason?: string }>;
    callback(customEvent.detail?.reason);
  };
  window.addEventListener(REFRESH_EVENT, handler);
  return () => window.removeEventListener(REFRESH_EVENT, handler);
};

export const useWorkspaceRefresh = (callback: (reason?: string) => void) => {
  useEffect(() => {
    return subscribeWorkspaceRefresh(callback);
  }, [callback]);
};
