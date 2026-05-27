'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Box, Typography, CircularProgress, Button, Paper } from '@mui/material';
import SetupScreen from '@/components/SetupScreen';
import HistorySidebar from '@/components/HistorySidebar';
import DashboardUploader from '@/components/DashboardUploader';
import TranscriptWorkspace from '@/components/TranscriptWorkspace';
import CustomAudioPlayer from '@/components/CustomAudioPlayer';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { TranscriptRecord, transcribeApi } from '@/lib/api';

const AppContainer = styled(Box)`
  display: flex;
  min-height: 100vh;
  background-color: #0b0f19;
  color: #f3f4f6;
  overflow: hidden;
`;

const ContentArea = styled(Box)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
`;

const EmptyDashboard = styled(Box)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 60%),
              #0b0f19;
`;

const ShimmerLoading = styled(Paper)`
  width: 100%;
  max-width: 600px;
  padding: 40px;
  background: rgba(21, 30, 51, 0.4) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(124, 58, 237, 0.15) !important;
  border-radius: 16px !important;
  text-align: center;
  margin: auto;
  box-shadow: 0 0 30px rgba(124, 58, 237, 0.1) !important;
`;

export default function Home() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [history, setHistory] = useState<TranscriptRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TranscriptRecord | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekTrigger, setSeekTrigger] = useState<number | null>(null);

  const loadHistory = async () => {
    try {
      const list = await transcribeApi.getHistory();
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  // Initialize: check setup status and load history
  useEffect(() => {
    async function init() {
      try {
        const setup = await transcribeApi.checkSetup();
        setHasApiKey(setup.hasApiKey);

        if (setup.hasApiKey) {
          await loadHistory();
        }
      } catch (e) {
        console.error('Initialization failed:', e);
        setHasApiKey(false); // Fallback to setup onboarding
      } finally {
        setLoadingSetup(false);
      }
    }
    init();
  }, []);

  // Poll status if selected record is not completed/failed
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (selectedRecord && (selectedRecord.status === 'queued' || selectedRecord.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const updated = await transcribeApi.getTranscriptStatus(selectedRecord.id);
          setSelectedRecord(updated);

          // Update in history array as well
          setHistory((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );

          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Failed to poll status:', e);
        }
      }, 4000);
    }

    return () => clearInterval(interval);
  }, [selectedRecord]);

  const handleSelectRecord = async (id: string | null) => {
    if (id === null) {
      setSelectedRecord(null);
      return;
    }
    try {
      const record = await transcribeApi.getTranscriptStatus(id);
      setSelectedRecord(record);
      setCurrentTimeMs(0);
      setSeekTrigger(null);
    } catch (e) {
      console.error('Failed to select record:', e);
    }
  };

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this recording from your local history?')) {
      return;
    }

    try {
      await transcribeApi.deleteTranscript(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (err) {
      console.error('Failed to delete transcript:', err);
    }
  };

  const handleUploadComplete = async (id: string) => {
    await loadHistory();
    handleSelectRecord(id);
  };

  const handleSeek = (ms: number) => {
    setSeekTrigger(ms);
    setCurrentTimeMs(ms);
  };

  if (loadingSetup) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0f19' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (hasApiKey === false) {
    return <SetupScreen onSuccess={() => setHasApiKey(true)} api={transcribeApi} />;
  }

  return (
    <AppContainer>
      {/* Left Sidebar browser */}
      <HistorySidebar
        history={history}
        selectedId={selectedRecord?.id || null}
        onSelect={handleSelectRecord}
        onDelete={handleDeleteRecord}
      />

      <ContentArea>
        {selectedRecord ? (
          // We have a selected transcript
          selectedRecord.status === 'completed' ? (
            <>
              <TranscriptWorkspace
                record={selectedRecord}
                currentTimeMs={currentTimeMs}
                onSeek={handleSeek}
                onBack={() => setSelectedRecord(null)}
                onUpdateRecord={(updated) => {
                  setSelectedRecord(updated);
                  setHistory((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                }}
              />
              <CustomAudioPlayer
                recordId={selectedRecord.id}
                duration={selectedRecord.duration || 0}
                seekTrigger={seekTrigger}
                onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
              />
            </>
          ) : selectedRecord.status === 'failed' ? (
            <ShimmerLoading elevation={8}>
              <Typography variant="h5" color="error" sx={{ fontWeight: 700, mb: 2 }}>
                Transcription Failed
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                {selectedRecord.error || 'An error occurred during the transcription process.'}
              </Typography>
              <Button variant="contained" color="primary" onClick={() => setSelectedRecord(null)}>
                Back to Dashboard
              </Button>
            </ShimmerLoading>
          ) : (
            // Shimmer/loading for processing state
            <ShimmerLoading elevation={8}>
              <CircularProgress color="primary" size={48} sx={{ mb: 3 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <AutoAwesomeIcon sx={{ color: '#7c3aed' }} /> Analyzing Recording...
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                AssemblyAI is busy processing speakers and generating summaries.
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic' }}>
                This is a local background task. You may keep working. The transcript will automatically slide into view when complete!
              </Typography>
            </ShimmerLoading>
          )
        ) : (
          // Dashboard drop zone if nothing selected
          <EmptyDashboard>
            <DashboardUploader onTranscriptionStart={handleUploadComplete} />

            {history.length > 0 && (
              <Box sx={{ mt: 5, textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  Or select one of your <strong>{history.length} previous</strong> records from the left library list to review.
                </Typography>
              </Box>
            )}
          </EmptyDashboard>
        )}
      </ContentArea>
    </AppContainer>
  );
}
