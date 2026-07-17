const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface AuthUser {
  id: string;
  email: string;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: 'include',
  });
}

export interface TranscriptRecord {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  wordsCount?: number;
  createdAt: string;
  updatedAt: string;
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  summary?: string;
  chapters?: Array<{
    start: number;
    end: number;
    headline: string;
    gist: string;
    summary: string;
  }>;
  speakerNames?: Record<string, string>;
}

export const transcribeApi = {
  getBackendUrl(): string {
    return BACKEND_URL;
  },

  async checkSetup(): Promise<{ hasApiKey: boolean }> {
    const res = await apiFetch('/setup/status');
    if (!res.ok) throw new Error('Failed to check backend setup status');
    return res.json();
  },

  async configureApiKey(apiKey: string): Promise<{ success: boolean }> {
    const res = await apiFetch('/setup/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to save AssemblyAI API Key');
    }
    return res.json();
  },

  async getHistory(): Promise<TranscriptRecord[]> {
    const res = await apiFetch('/transcribe/history');
    if (!res.ok) throw new Error('Failed to fetch transcription history');
    return res.json();
  },

  async deleteTranscript(id: string): Promise<{ success: boolean }> {
    const res = await apiFetch(`/transcribe/history/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transcript');
    return res.json();
  },

  async getTranscriptStatus(id: string): Promise<TranscriptRecord> {
    const res = await apiFetch(`/transcribe/status/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to fetch transcript status');
    }
    return res.json();
  },

  async renameSpeaker(id: string, speaker: string, name: string): Promise<TranscriptRecord> {
    const res = await apiFetch('/transcribe/rename-speaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, speaker, name }),
    });
    if (!res.ok) throw new Error('Failed to rename speaker');
    return res.json();
  },

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<{ success: boolean; id: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', `${BACKEND_URL}/transcribe/upload`);
      xhr.withCredentials = true;

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload'));
      };

      xhr.send(formData);
    });
  },

  getExportUrl(id: string, format: 'txt' | 'srt' | 'vtt' | 'pdf' | 'docx' | 'xlsx'): string {
    return `${BACKEND_URL}/transcribe/export/${id}?format=${format}`;
  },
};

async function readApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export const authApi = {
  async register(email: string, password: string): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await readApiError(res, 'Registration failed');
    return res.json();
  },

  async verifyEmail(token: string): Promise<{ success: boolean; user: AuthUser }> {
    const res = await apiFetch('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw await readApiError(res, 'Email verification failed');
    return res.json();
  },

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw await readApiError(res, 'Could not resend verification email');
    return res.json();
  },

  async login(email: string, password: string): Promise<{ user: AuthUser }> {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await readApiError(res, 'Login failed');
    return res.json();
  },

  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
  },

  async me(): Promise<{ user: AuthUser }> {
    const res = await apiFetch('/auth/me');
    if (!res.ok) throw await readApiError(res, 'Not authenticated');
    return res.json();
  },
};
