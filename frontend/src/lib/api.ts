const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

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
    const res = await fetch(`${BACKEND_URL}/setup/status`);
    if (!res.ok) throw new Error('Failed to check backend setup status');
    return res.json();
  },

  async configureApiKey(apiKey: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BACKEND_URL}/setup/config`, {
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
    const res = await fetch(`${BACKEND_URL}/transcribe/history`);
    if (!res.ok) throw new Error('Failed to fetch transcription history');
    return res.json();
  },

  async deleteTranscript(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BACKEND_URL}/transcribe/history/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transcript');
    return res.json();
  },

  async getTranscriptStatus(id: string): Promise<TranscriptRecord> {
    const res = await fetch(`${BACKEND_URL}/transcribe/status/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to fetch transcript status');
    }
    return res.json();
  },

  async renameSpeaker(id: string, speaker: string, name: string): Promise<TranscriptRecord> {
    const res = await fetch(`${BACKEND_URL}/transcribe/rename-speaker`, {
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
