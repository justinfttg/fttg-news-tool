import api from './api';
import { User } from '../types';

interface AuthResponse {
  user: User;
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  localStorage.setItem('fttg_token', data.token);
  localStorage.setItem('fttg_user', JSON.stringify(data.user));
  return data;
}

export async function register(email: string, password: string, fullName: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, fullName });
  localStorage.setItem('fttg_token', data.token);
  localStorage.setItem('fttg_user', JSON.stringify(data.user));
  return data;
}

export function logout(): void {
  localStorage.removeItem('fttg_token');
  localStorage.removeItem('fttg_user');
}

export function getStoredUser(): User | null {
  const stored = localStorage.getItem('fttg_user');
  return stored ? JSON.parse(stored) : null;
}

export function getStoredToken(): string | null {
  return localStorage.getItem('fttg_token');
}
