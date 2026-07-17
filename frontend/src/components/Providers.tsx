'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '@/lib/theme';
import StyledComponentsRegistry from '@/lib/registry';
import { AuthProvider } from '@/contexts/AuthContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StyledComponentsRegistry>
        <AuthProvider>{children}</AuthProvider>
      </StyledComponentsRegistry>
    </ThemeProvider>
  );
}
