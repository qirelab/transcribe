'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { authApi } from '@/lib/api';

export default function VerifyEmailPage() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      Promise.resolve().then(() => {
        setState('error');
        setMessage('Verification token is missing.');
      });
      return;
    }
    authApi.verifyEmail(token)
      .then(() => {
        setState('success');
        setMessage('Your email has been verified. You can now log in.');
      })
      .catch((error: unknown) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed.');
      });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#0b0f19', p: 3 }}>
      <Paper sx={{ maxWidth: 480, width: '100%', p: 5, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Email verification</Typography>
        {state === 'loading' ? (
          <CircularProgress />
        ) : (
          <>
            <Alert severity={state === 'success' ? 'success' : 'error'} sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Link href={state === 'success' ? '/login' : '/register'}>
              {state === 'success' ? 'Continue to login' : 'Back to registration'}
            </Link>
          </>
        )}
      </Paper>
    </Box>
  );
}
