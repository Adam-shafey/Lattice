export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiFetch(path: string, userId: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('x-user-id', userId);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
