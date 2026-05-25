'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
  InputAdornment,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import HistoryIcon from '@mui/icons-material/History';
import ErrorIcon from '@mui/icons-material/Error';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { TranscriptRecord } from '@/lib/api';

const SidebarContainer = styled(Paper)`
  width: 320px;
  height: 100vh;
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
  background: rgba(11, 15, 25, 0.95) !important;
  backdrop-filter: blur(12px);
  border-radius: 0 !important;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
`;

const HeaderBox = styled(Box)`
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const SearchBox = styled(Box)`
  padding: 16px 24px;
`;

const ListContainer = styled(Box)`
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 12px 24px;
`;

interface HistorySidebarProps {
  history: TranscriptRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function HistorySidebar({
  history,
  selectedId,
  onSelect,
  onDelete,
}: HistorySidebarProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing'>('all');

  const filteredHistory = history.filter((item) => {
    // Text search
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
      (item.text && item.text.toLowerCase().includes(search.toLowerCase()));

    // Filter type
    if (filter === 'completed') {
      return matchesSearch && item.status === 'completed';
    }
    if (filter === 'processing') {
      return matchesSearch && (item.status === 'processing' || item.status === 'queued');
    }
    return matchesSearch;
  });

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'completed':
        return null; // Don't show chip for completed, keeping it clean
      case 'queued':
      case 'processing':
        return (
          <Chip
            size="small"
            icon={<AutorenewIcon className="rotating" sx={{ fontSize: '12px !important' }} />}
            label="Analyzing"
            color="primary"
            variant="outlined"
            sx={{
              height: '20px',
              fontSize: '10px',
              fontWeight: 600,
              borderColor: 'rgba(124, 58, 237, 0.5)',
              color: '#a78bfa',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              },
              '& .rotating': {
                animation: 'spin 2s linear infinite'
              }
            }}
          />
        );
      case 'failed':
        return (
          <Chip
            size="small"
            icon={<ErrorIcon sx={{ fontSize: '12px !important' }} />}
            label="Failed"
            color="error"
            variant="outlined"
            sx={{ height: '20px', fontSize: '10px', fontWeight: 600 }}
          />
        );
      default:
        return null;
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <SidebarContainer elevation={0}>
      <HeaderBox>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: 1 }}>
          <HistoryIcon sx={{ color: '#7c3aed' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Library
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Explore previous recordings & meetings
        </Typography>
      </HeaderBox>

      <SearchBox>
        <TextField
          fullWidth
          size="small"
          placeholder="Search recordings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.06)' },
              '&:hover fieldset': { borderColor: 'rgba(124, 58, 237, 0.3)' },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: '6px' }}>
          <Chip
            size="small"
            label="All"
            clickable
            color={filter === 'all' ? 'primary' : 'default'}
            onClick={() => setFilter('all')}
            sx={{ fontWeight: 600, fontSize: '11px' }}
          />
          <Chip
            size="small"
            label="Completed"
            clickable
            color={filter === 'completed' ? 'primary' : 'default'}
            onClick={() => setFilter('completed')}
            sx={{ fontWeight: 600, fontSize: '11px' }}
          />
          <Chip
            size="small"
            label="Active"
            clickable
            color={filter === 'processing' ? 'primary' : 'default'}
            onClick={() => setFilter('processing')}
            sx={{ fontWeight: 600, fontSize: '11px' }}
          />
        </Box>
      </SearchBox>

      <ListContainer>
        {filteredHistory.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No recordings found
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredHistory.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  selected={isSelected}
                  sx={{
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                    background: isSelected ? 'rgba(124, 58, 237, 0.05) !important' : 'transparent',
                    p: '10px 12px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.02)',
                      '& .delete-btn': { opacity: 1 },
                    },
                    '&.Mui-selected:hover': {
                      background: 'rgba(124, 58, 237, 0.08) !important',
                    },
                  }}
                >
                  <AudioFileIcon
                    sx={{
                      color: isSelected ? '#7c3aed' : 'text.secondary',
                      mr: '12px',
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  />

                  <ListItemText
                    primary={item.title}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mt: 0.5 }}>
                        <span style={{ fontSize: '11px' }}>{formatDuration(item.duration)}</span>
                        <span>•</span>
                        <span style={{ fontSize: '11px' }}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </Box>
                    }
                    slotProps={{
                      primary: {
                        variant: 'subtitle2',
                        sx: {
                          fontWeight: 600,
                          lineHeight: 1.3,
                          color: isSelected ? '#ffffff' : 'text.primary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      },
                      secondary: {
                        variant: 'caption',
                        sx: { color: 'text.secondary', display: 'flex', alignItems: 'center' },
                      },
                    }}
                  />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', ml: 1 }}>
                    {getStatusChip(item.status)}
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={(e) => onDelete(item.id, e)}
                      sx={{
                        color: 'text.secondary',
                        opacity: isSelected ? 1 : 0, // Keep visible if selected
                        transition: 'opacity 0.2s ease',
                        '&:hover': { color: '#ef4444' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </ListContainer>
    </SidebarContainer>
  );
}
