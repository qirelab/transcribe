'use client';

import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Menu,
  MenuItem,
  InputAdornment,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TranscriptRecord, transcribeApi } from '@/lib/api';

const MainLayout = styled(Box)`
  display: flex;
  height: calc(100vh - 80px); /* Fill space above player */
  overflow: hidden;
`;

const TranscriptPanel = styled(Box)`
  flex-grow: 1;
  overflow-y: auto;
  padding: 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const UtilityPanel = styled(Paper)`
  width: 400px;
  border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
  background: rgba(11, 15, 25, 0.5) !important;
  backdrop-filter: blur(8px);
  border-radius: 0 !important;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;

const TopActionBar = styled(Box)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(11, 15, 25, 0.3);
`;

const UtteranceBox = styled(Box)<{ $isActive: boolean }>`
  display: flex;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: ${props => props.$isActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent'};
  border: 1px solid ${props => props.$isActive ? 'rgba(124, 58, 237, 0.15)' : 'transparent'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$isActive ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255, 255, 255, 0.015)'};
  }
`;

const WordSpan = styled('span')<{ $isCurrent: boolean; $isSearchMatch: boolean }>`
  cursor: pointer;
  padding: 2px 3px;
  border-radius: 4px;
  background: ${props => 
    props.$isCurrent ? '#7c3aed' : 
    props.$isSearchMatch ? 'rgba(234, 179, 8, 0.4)' : 'transparent'
  };
  color: ${props => props.$isCurrent ? '#ffffff' : 'inherit'};
  font-weight: ${props => props.$isCurrent ? 600 : 'normal'};
  transition: background-color 0.1s ease;

  &:hover {
    background: ${props => props.$isCurrent ? '#6d28d9' : 'rgba(124, 58, 237, 0.15)'};
  }
`;

const ChapterItem = styled(Box)`
  padding: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(124, 58, 237, 0.05);
    border-color: rgba(124, 58, 237, 0.15);
  }
`;

// Helper array for speaker colors mapping
const SPEAKER_COLORS = [
  { bg: '#7c3aed', text: '#ffffff' }, // Violet
  { bg: '#10b981', text: '#ffffff' }, // Emerald
  { bg: '#06b6d4', text: '#ffffff' }, // Cyan
  { bg: '#f59e0b', text: '#ffffff' }, // Amber
  { bg: '#ec4899', text: '#ffffff' }, // Pink
  { bg: '#3b82f6', text: '#ffffff' }, // Blue
];

interface TranscriptWorkspaceProps {
  record: TranscriptRecord;
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  onBack: () => void;
  onUpdateRecord: (updated: TranscriptRecord) => void;
}

export default function TranscriptWorkspace({
  record,
  currentTimeMs,
  onSeek,
  onBack,
  onUpdateRecord,
}: TranscriptWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = Summary, 1 = Chapters
  const [downloadAnchor, setDownloadAnchor] = useState<null | HTMLElement>(null);
  const [renameSpeakerCode, setRenameSpeakerCode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loadingRename, setLoadingRename] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDownloadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setDownloadAnchor(e.currentTarget);
  };

  const handleDownloadClose = () => {
    setDownloadAnchor(null);
  };

  const handleExport = (format: 'txt' | 'srt' | 'vtt' | 'pdf' | 'docx' | 'xlsx') => {
    handleDownloadClose();
    const url = transcribeApi.getExportUrl(record.id, format);
    window.open(url, '_blank');
  };

  const openRenameModal = (speakerCode: string) => {
    setRenameSpeakerCode(speakerCode);
    const existingName = record.speakerNames?.[speakerCode] || `Speaker ${speakerCode}`;
    setRenameValue(existingName);
  };

  const closeRenameModal = () => {
    setRenameSpeakerCode(null);
  };

  const handleRenameSave = async () => {
    if (!renameSpeakerCode || !renameValue.trim()) return;

    setLoadingRename(true);
    try {
      const updated = await transcribeApi.renameSpeaker(record.id, renameSpeakerCode, renameValue.trim());
      onUpdateRecord(updated);
      closeRenameModal();
    } catch (e) {
      console.error('Failed to rename speaker:', e);
    } finally {
      setLoadingRename(false);
    }
  };

  const getSpeakerDetails = (spCode: string) => {
    const customName = record.speakerNames?.[spCode];
    const index = spCode.charCodeAt(0) % SPEAKER_COLORS.length;
    const colors = SPEAKER_COLORS[index] || SPEAKER_COLORS[0];
    return {
      name: customName || `Speaker ${spCode}`,
      colors,
    };
  };

  const formatMsToTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%' }}>
      {/* Top Action Header */}
      <TopActionBar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <IconButton
            onClick={onBack}
            sx={{
              color: 'text.secondary',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#7c3aed',
                borderColor: 'rgba(124, 58, 237, 0.3)',
                background: 'rgba(124, 58, 237, 0.05)',
              },
            }}
            title="Back to Upload"
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {record.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {record.wordsCount ? `${record.wordsCount.toLocaleString()} words` : '0 words'} •{' '}
              {record.utterances?.length || 0} segments
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search transcript..."
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
              width: 250,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.06)' },
              },
            }}
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadClick}
          >
            Export Transcript
          </Button>

          <Menu
            anchorEl={downloadAnchor}
            open={Boolean(downloadAnchor)}
            onClose={handleDownloadClose}
            slotProps={{
              paper: {
                sx: {
                  background: '#151e33',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  '& .MuiMenuItem-root': { fontWeight: 500 },
                },
              },
            }}
          >
            <MenuItem onClick={() => handleExport('txt')}>Plain Text (.txt)</MenuItem>
            <MenuItem onClick={() => handleExport('srt')}>Subtitles (.srt)</MenuItem>
            <MenuItem onClick={() => handleExport('vtt')}>WebVTT (.vtt)</MenuItem>
            <MenuItem onClick={() => handleExport('pdf')}>PDF Document (.pdf)</MenuItem>
            <MenuItem onClick={() => handleExport('docx')}>Word Document (.docx)</MenuItem>
            <MenuItem onClick={() => handleExport('xlsx')}>Excel Spreadsheet (.xlsx)</MenuItem>
          </Menu>
        </Box>
      </TopActionBar>

      <MainLayout>
        {/* Main Conversation Stream */}
        <TranscriptPanel ref={scrollContainerRef}>
          {record.utterances?.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
              <Typography variant="body1">No content transcript available</Typography>
            </Box>
          ) : (
            record.utterances?.map((u, i) => {
              // Check if currently spoken line
              const isLineActive = currentTimeMs >= u.start && currentTimeMs <= u.end;
              const sp = getSpeakerDetails(u.speaker);

              // Tokenize utterance by words to allow clicking on specific words!
              const words = u.text.split(' ');
              // Approximate word timestamps linearly for premium real-time highlight transitions!
              const duration = u.end - u.start;
              const msPerWord = duration / words.length;

              return (
                <UtteranceBox key={i} $isActive={isLineActive}>
                  <Avatar
                    sx={{
                      bgcolor: sp.colors.bg,
                      color: sp.colors.text,
                      fontWeight: 700,
                      fontSize: '14px',
                      width: 36,
                      height: 36,
                    }}
                  >
                    {u.speaker}
                  </Avatar>

                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {sp.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => openRenameModal(u.speaker)}
                        sx={{ color: 'text.secondary', p: '2px', '&:hover': { color: '#7c3aed' } }}
                      >
                        <EditIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                        {formatMsToTime(u.start)}
                      </Typography>
                    </Box>

                    <Typography variant="body1" sx={{ color: isLineActive ? '#ffffff' : '#cbd5e1' }}>
                      {words.map((word, wordIdx) => {
                        const wordStart = u.start + wordIdx * msPerWord;
                        const wordEnd = wordStart + msPerWord;
                        const isWordCurrent = currentTimeMs >= wordStart && currentTimeMs <= wordEnd;
                        const isSearchMatch =
                          search.trim() !== '' &&
                          word.toLowerCase().includes(search.toLowerCase());

                        return (
                          <React.Fragment key={wordIdx}>
                            <WordSpan
                              $isCurrent={isWordCurrent}
                              $isSearchMatch={isSearchMatch}
                              onClick={() => onSeek(wordStart)}
                            >
                              {word}
                            </WordSpan>{' '}
                          </React.Fragment>
                        );
                      })}
                    </Typography>
                  </Box>
                </UtteranceBox>
              );
            })
          )}
        </TranscriptPanel>

        {/* AI Insight Sidebar (Summary & Chapters) */}
        <UtilityPanel elevation={0}>
          <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
              sx={{
                '& .MuiTab-root': {
                  fontWeight: 600,
                  fontSize: '13px',
                  py: 2,
                  color: 'text.secondary',
                  '&.Mui-selected': { color: '#7c3aed' },
                },
              }}
            >
              <Tab icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />} label="AI Summary" iconPosition="start" />
              <Tab icon={<LibraryBooksIcon sx={{ fontSize: 16 }} />} label="Chapters" iconPosition="start" />
            </Tabs>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
            {activeTab === 0 ? (
              // AI Summary Markdown Renderer (basic rendering since markdown is returned)
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AutoAwesomeIcon sx={{ color: '#7c3aed', fontSize: 18 }} /> Executive Summary
                </Typography>
                {record.summary ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.7,
                      '& h3, & h4': { color: 'white', fontWeight: 600, mt: 2, mb: 1 },
                      '& ul, & ol': { pl: 2, mt: 1 },
                      '& li': { mb: 0.5 },
                    }}
                  >
                    {record.summary}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    AI insights are ready for completed recordings.
                  </Typography>
                )}
              </Box>
            ) : (
              // Chapters List
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LibraryBooksIcon sx={{ color: '#10b981', fontSize: 18 }} /> Chapters Index
                </Typography>
                {record.chapters && record.chapters.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {record.chapters.map((ch, idx) => (
                      <ChapterItem key={idx} onClick={() => onSeek(ch.start)}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff' }}>
                            {ch.headline}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                            {formatMsToTime(ch.start)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontStyle: 'italic' }}>
                          {ch.gist}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '11px', lineHeight: 1.5 }}>
                          {ch.summary}
                        </Typography>
                      </ChapterItem>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    Chapters breakdown ready for completed recordings.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </UtilityPanel>
      </MainLayout>

      {/* Speaker Renaming Modal */}
      <Dialog open={renameSpeakerCode !== null} onClose={closeRenameModal}>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename Speaker {renameSpeakerCode}</DialogTitle>
        <DialogContent sx={{ minWidth: 320, pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            placeholder="Type actual name..."
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            disabled={loadingRename}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '8px' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeRenameModal} disabled={loadingRename} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleRenameSave} disabled={loadingRename} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
