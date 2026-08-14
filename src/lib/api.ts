import { supabase } from "@/lib/supabase";

export interface CloudProjectSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  regions_count: number;
  materials_count: number;
  total_cost: number;
}

export interface CloudProject {
  id: string;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore - fall back to the generic message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listCloudProjects(): Promise<CloudProjectSummary[]> {
  return apiFetch("/api/projects");
}

export function getCloudProject(id: string): Promise<CloudProject> {
  return apiFetch(`/api/projects/${id}`);
}

export function createCloudProject(name: string, data: any): Promise<CloudProject> {
  return apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, data }),
  });
}

export function updateCloudProject(id: string, name: string, data: any): Promise<CloudProject> {
  return apiFetch(`/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, data }),
  });
}

export function deleteCloudProject(id: string): Promise<void> {
  return apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}
