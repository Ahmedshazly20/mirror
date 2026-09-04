import { useWorkspaceStore } from '../store';

export function useActiveSessions() {
  const sessions = useWorkspaceStore(state => state.sessions);
  const isLoading = useWorkspaceStore(state => state.isLoading);
  return { sessions, loading: isLoading, error: null };
}

