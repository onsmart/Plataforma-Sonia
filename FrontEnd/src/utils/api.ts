import { supabase } from "./supabase/client";
import { projectId } from "./supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-eeb342a4`;

type RequestOptions = RequestInit & {
  // Optional: Add specific flags if needed
};

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Sessão expirada. Por favor, faça login novamente.");
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...(options.headers || {}),
  };

  // Ensure endpoint starts with /
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        try {
            const json = JSON.parse(errorText);
            if (json.error) errorMessage = json.error;
        } catch (e) {}
        
        throw new Error(errorMessage);
      }

      return response.json();
  } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          // Quietly throw localized error
          throw new Error("Falha na conexão com o servidor. Verifique sua internet.");
      }
      throw error;
  }
}

export const api = {
    agents: {
        list: () => apiRequest('/agents'),
        get: (id: string) => apiRequest(`/agents/${id}`),
    },
    dashboard: {
        stats: () => apiRequest('/dashboard'),
    }
};
