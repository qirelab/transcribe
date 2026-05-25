'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Link as MuiLink,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import CodeIcon from '@mui/icons-material/Code';

const BackgroundContainer = styled(Box)`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 40%),
              radial-gradient(circle at 90% 80%, rgba(124, 58, 237, 0.15) 0%, transparent 40%),
              #0b0f19;
  padding: 24px;
`;

const GlowingCard = styled(Paper)`
  width: 100%;
  max-width: 500px;
  padding: 40px;
  background: rgba(21, 30, 51, 0.65) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  box-shadow: 0 10px 40px -10px rgba(124, 58, 237, 0.25) !important;
  text-align: center;
  border-radius: 16px !important;
  transition: transform 0.3s ease, border-color 0.3s ease;

  &:hover {
    border-color: rgba(124, 58, 237, 0.4) !important;
    transform: translateY(-2px);
  }
`;

const IconWrapper = styled(Box)`
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
`;

const InstructionItem = styled(Box)`
  display: flex;
  align-items: flex-start;
  text-align: left;
  margin-bottom: 16px;
  gap: 12px;
`;

const Dot = styled(Box)`
  background: #10b981;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
`;

interface SetupScreenProps {
  onSuccess: () => void;
  api: {
    configureApiKey: (key: string) => Promise<{ success: boolean }>;
  };
}

export default function SetupScreen({ onSuccess, api }: SetupScreenProps) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.configureApiKey(apiKey.trim());
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to configure API key. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundContainer>
      <GlowingCard elevation={24}>
        <IconWrapper>
          <KeyIcon sx={{ color: 'white', fontSize: 32 }} />
        </IconWrapper>

        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
          Welcome to Transcribe
        </Typography>

        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Enter your AssemblyAI API Key to start transcribing large audio/video files with speaker diaries and smart AI insights.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            label="AssemblyAI API Key"
            placeholder="Enter api_key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={loading}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(124, 58, 237, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#7c3aed',
                },
              },
            }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            size="large"
            sx={{ py: 1.5, mb: 4 }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Activate Application'}
          </Button>
        </form>

        <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', pt: 3, mt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 2, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CodeIcon sx={{ fontSize: 18, color: '#7c3aed' }} /> Setup Instructions
          </Typography>

          <InstructionItem>
            <Dot>1</Dot>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sign up for a free account at{' '}
              <MuiLink href="https://www.assemblyai.com" target="_blank" rel="noopener" sx={{ color: '#10b981', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                AssemblyAI
              </MuiLink>
              . You will get immediate free credits ($50 value).
            </Typography>
          </InstructionItem>

          <InstructionItem>
            <Dot>2</Dot>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Copy your API Key from your dashboard account portal.
            </Typography>
          </InstructionItem>

          <InstructionItem>
            <Dot>3</Dot>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Paste it in the input above. It will be securely stored in your local configuration.
            </Typography>
          </InstructionItem>
        </Box>
      </GlowingCard>
    </BackgroundContainer>
  );
}
