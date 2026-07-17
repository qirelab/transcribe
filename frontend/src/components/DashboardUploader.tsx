'use client';

import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { transcribeApi } from '@/lib/api';

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'flac',
  'webm',
]);
const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'mkv',
  'avi',
  'webm',
  'm4v',
]);

function isSupportedMediaFile(file: File): boolean {
  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    return true;
  }
  // Some browsers/OS combinations provide empty or generic MIME types.
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return (
    SUPPORTED_AUDIO_EXTENSIONS.has(extension) ||
    SUPPORTED_VIDEO_EXTENSIONS.has(extension)
  );
}

const UploaderCard = styled(Paper)`
  width: 100%;
  max-width: 800px;
  background: rgba(21, 30, 51, 0.4) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 16px !important;
  padding: 40px;
  margin: 0 auto;
  text-align: center;
`;

interface DropZoneProps {
  $isDragActive: boolean;
}

const DropZone = styled(Box)<DropZoneProps>`
  border: 2px dashed ${props => props.$isDragActive ? '#10b981' : 'rgba(124, 58, 237, 0.4)'};
  background: ${props => props.$isDragActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(124, 58, 237, 0.02)'};
  border-radius: 12px;
  padding: 60px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  outline: none;

  &:hover {
    border-color: #7c3aed;
    background: rgba(124, 58, 237, 0.04);
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.1);
  }
`;

const UploadingSection = styled(Box)`
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const FileInfoBox = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  max-width: 500px;
  margin: 0 auto;
`;

interface DashboardUploaderProps {
  onTranscriptionStart: (id: string) => void;
}

const STEPS = [
  'Uploading to local server',
  'Compressing/Preparing file',
  'Uploading to AI engine',
  'Transcribing & recognizing speakers',
  'Analyzing summary & chapters',
];

export default function DashboardUploader({ onTranscriptionStart }: DashboardUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const selectFileManual = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    if (!isSupportedMediaFile(file)) {
      setError('Unsupported file type. Please upload a valid audio or video file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploading(true);
    setProgress(0);
    setActiveStep(0); // Uploading to local server

    try {
      // Step 0: Upload file to NestJS
      const uploadResult = await transcribeApi.uploadFile(file, (percent) => {
        setProgress(percent);
        if (percent === 100) {
          // Once local upload is 100%, we transition to server-side compression/uploading status
          setActiveStep(1); // Server processing/compressing
        }
      });

      const id = uploadResult.id;
      
      // We will now start polling for the transcription status to show progress
      pollStatus(id);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'File upload failed. Please try again.');
      setUploading(false);
    }
  };

  const pollStatus = (id: string) => {
    let checkCount = 0;
    const interval = setInterval(async () => {
      try {
        checkCount++;
        const record = await transcribeApi.getTranscriptStatus(id);

        if (record.status === 'queued') {
          setActiveStep(2); // Uploading to AI Engine / Queued
        } else if (record.status === 'processing') {
          // If we have text but status is processing, it means we are in the Lemur summary stage!
          if (record.text) {
            setActiveStep(4); // Analyzing summary & chapters
          } else {
            setActiveStep(3); // Transcribing & Diarizing
          }
        } else if (record.status === 'completed') {
          clearInterval(interval);
          setUploading(false);
          onTranscriptionStart(id); // Notify parent of completion, open work environment
        } else if (record.status === 'failed') {
          clearInterval(interval);
          setError(record.error || 'AssemblyAI transcription failed.');
          setUploading(false);
        }

        // Safety timeout (e.g. stop polling after 4 hours!)
        if (checkCount > 3600) {
          clearInterval(interval);
          setError('Transcription took too long. Polling timed out.');
          setUploading(false);
        }
      } catch (err) {
        // Log error but continue polling (network hiccup)
        console.error('Error polling transcription status:', err);
      }
    }, 4000); // Poll every 4 seconds
  };

  return (
    <UploaderCard elevation={4}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Transcribe New Media
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        Supports massive meetings, interviews, or lectures. Drag in files of any duration.
      </Typography>

      {!uploading ? (
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="audio/*,video/*"
            onChange={handleFileChange}
          />
          <DropZone
            $isDragActive={dragActive}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={selectFileManual}
          >
            <CloudUploadIcon sx={{ fontSize: 56, color: dragActive ? '#10b981' : '#7c3aed' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                Drag & drop your file here, or <span style={{ color: '#7c3aed', textDecoration: 'underline' }}>browse</span>
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Supports WAV, MP3, M4A, AAC, MP4, MOV, MKV, AVI, etc. up to 2GB.
              </Typography>
            </Box>
          </DropZone>

          {error && (
            <Alert severity="error" sx={{ mt: 3, borderRadius: '8px', textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 4, display: 'flex', gap: '32px', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AudioFileIcon sx={{ color: '#10b981' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Hi-Fi Voice Diarization</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <VideoFileIcon sx={{ color: '#06b6d4' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Direct Video Support</Typography>
            </Box>
          </Box>
        </>
      ) : (
        <UploadingSection>
          {selectedFile && (
            <FileInfoBox>
              {selectedFile.type.startsWith('video/') ? (
                <VideoFileIcon sx={{ color: '#06b6d4', fontSize: 32 }} />
              ) : (
                <AudioFileIcon sx={{ color: '#10b981', fontSize: 32 }} />
              )}
              <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </Typography>
              </Box>
            </FileInfoBox>
          )}

          <Box sx={{ width: '100%', mt: 2 }}>
            {activeStep === 0 ? (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Uploading media to local backend...</span>
                  <span>{progress}%</span>
                </Typography>
                <LinearProgress variant="determinate" value={progress} color="primary" sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', py: 1 }}>
                <CircularProgress size={24} color="secondary" />
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  {STEPS[activeStep]}...
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ width: '100%', mt: 2, display: { xs: 'none', md: 'block' } }}>
            <Stepper activeStep={activeStep} alternativeLabel sx={{ '& .MuiStepIcon-root.Mui-active': { color: '#7c3aed' }, '& .MuiStepIcon-root.Mui-completed': { color: '#10b981' } }}>
              {STEPS.map((label) => (
                <Step key={label}>
                  <StepLabel>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>{label}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
            Note: You can navigate away or shut down the browser tab. The transcription runs securely in the background on the local server, and will be saved in your history list!
          </Typography>
        </UploadingSection>
      )}
    </UploaderCard>
  );
}
