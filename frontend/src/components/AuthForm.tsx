'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const Background = styled(Box)`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.14), transparent 42%),
    radial-gradient(circle at 80% 80%, rgba(124, 58, 237, 0.16), transparent 42%),
    #0b0f19;
`;

const Card = styled(Paper)`
  width: 100%;
  max-width: 460px;
  padding: 40px;
  border-radius: 16px !important;
  background: rgba(21, 30, 51, 0.72) !important;
  border: 1px solid rgba(124, 58, 237, 0.25) !important;
`;

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isRegister = mode === 'register';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isRegister) {
        const result = await authApi.register(email, password);
        setSuccess(result.message);
      } else {
        await login(email, password);
        router.replace('/');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Background>
      <Card elevation={20}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          {isRegister ? 'Create account' : 'Welcome back'}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 4 }}>
          {isRegister
            ? 'Use your corporate email or an individually allowed address.'
            : 'Log in to access your private transcriptions.'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            required
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading || !!success}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            type="password"
            label="Password"
            helperText={isRegister ? 'At least 8 characters' : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading || !!success}
            slotProps={{ htmlInput: { minLength: isRegister ? 8 : undefined } }}
            sx={{ mb: 3 }}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !!success}
          >
            {loading ? <CircularProgress size={24} /> : isRegister ? 'Register' : 'Log in'}
          </Button>
        </form>
        <Typography sx={{ color: 'text.secondary', mt: 3, textAlign: 'center' }}>
          {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
          <Link href={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Log in' : 'Register'}
          </Link>
        </Typography>
      </Card>
    </Background>
  );
}
