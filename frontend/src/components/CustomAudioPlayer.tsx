'use client';

import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Box, Typography, IconButton, Slider, Paper, Stack } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import { transcribeApi } from '../lib/api';

const PlayerContainer = styled(Paper)`
  position: fixed;
  bottom: 0;
  left: 320px; /* Offset for sidebar */
  right: 0;
  height: 80px;
  background: rgba(11, 15, 25, 0.95) !important;
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 0 !important;
  display: flex;
  align-items: center;
  padding: 0 40px;
  z-index: 9;
`;

const PlaybackControls = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;
`;

const ProgressSection = styled(Box)`
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 40px;
`;

const VolumeSection = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;
  justify-content: flex-end;
`;

interface CustomAudioPlayerProps {
  recordId?: string;
  duration: number; // in seconds
  seekTrigger: number | null; // seek request in ms
  onTimeUpdate: (ms: number) => void; // reports playback time in ms
}

export default function CustomAudioPlayer({
  recordId,
  duration,
  seekTrigger,
  onTimeUpdate,
}: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Store callbacks/state in refs to prevent dependency changes from re-triggering effects
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const src = recordId ? `${transcribeApi.getBackendUrl()}/transcribe/audio/${recordId}` : '';

  // Reset audio and player states whenever the selected record changes
  useEffect(() => {
    // The media element and its mirrored UI state must reset together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [recordId]);

  const isFirstRender = useRef(true);

  // Sync current time changes to parent and handle end of playback cleanly via a reactive effect
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    onTimeUpdateRef.current(currentTime * 1000);
    
    if (currentTime >= duration && isPlaying) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPlaying(false);
    }
  }, [currentTime, duration, isPlaying]);

  // Sync seek triggers from clicking words/chapters
  useEffect(() => {
    if (seekTrigger !== null) {
      const seekSec = seekTrigger / 1000;
      if (audioRef.current && src && !audioError) {
        audioRef.current.currentTime = seekSec;
      }
      // External seek requests intentionally synchronize local player state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTime(seekSec);
      
      // Auto play on seek to feel snappy
      if (!isPlayingRef.current) {
        if (audioRef.current && src && !audioError) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
            console.warn('Audio play on seek failed:', err);
            setAudioError(true);
            setIsPlaying(true);
          });
        } else {
          setIsPlaying(true);
        }
      }
    }
  }, [seekTrigger, src, audioError]);

  // Sync volume state
  useEffect(() => {
    if (audioRef.current && src && !audioError) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, src, audioError]);

  // Handle play/pause
  const togglePlay = React.useCallback(() => {
    if (!audioRef.current) return;
    if (!src || audioError) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback failed, falling back to mock simulation:', err);
        setAudioError(true);
        setIsPlaying(true);
      });
    }
  }, [isPlaying, src, audioError]);

  const skipTime = (secs: number) => {
    let target = currentTime + secs;
    if (target < 0) target = 0;
    if (target > duration) target = duration;
    if (audioRef.current && src && !audioError) {
      audioRef.current.currentTime = target;
    }
    setCurrentTime(target);
  };

  const handleProgressChange = (_: unknown, value: number | number[]) => {
    const val = value as number;
    if (audioRef.current && src && !audioError) {
      audioRef.current.currentTime = val;
    }
    setCurrentTime(val);
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const sec = audioRef.current.currentTime;
      setCurrentTime(sec);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const formatTimeStr = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Generate a mock synthesized audio voice stream ONLY if there is no physical audio path loaded or if it failed
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && (!src || audioError)) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.25; // tick every 250ms
          if (next >= duration) {
            return duration;
          }
          return next;
        });
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration, src, audioError]);

  // Hook global keyboard shortcuts
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // Toggle play on Spacebar (ignore inside input fields)
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [togglePlay]);

  return (
    <PlayerContainer elevation={4}>
      {/* Invisible HTML5 Audio Tag */}
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="use-credentials"
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        onError={(e) => {
          console.warn('HTML5 Audio loading error, fallback to silent simulation', e);
          setAudioError(true);
        }}
        style={{ display: 'none' }}
      />

      <PlaybackControls>
        <IconButton size="small" onClick={() => skipTime(-10)} sx={{ color: 'text.secondary' }}>
          <Replay10Icon />
        </IconButton>

        <IconButton
          onClick={togglePlay}
          sx={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            color: 'white',
            width: 44,
            height: 44,
            '&:hover': {
              background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
            },
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>

        <IconButton size="small" onClick={() => skipTime(10)} sx={{ color: 'text.secondary' }}>
          <Forward10Icon />
        </IconButton>
      </PlaybackControls>

      <ProgressSection>
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 35 }}>
          {formatTimeStr(currentTime)}
        </Typography>

        <Slider
          size="small"
          value={currentTime}
          max={duration}
          onChange={handleProgressChange}
          sx={{
            color: '#7c3aed',
            height: 4,
            padding: '13px 0',
            '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
              backgroundColor: '#fff',
              '&:hover, &.Mui-focusVisible': {
                boxShadow: '0px 0px 0px 8px rgba(124, 58, 237, 0.16)',
              },
              '&.Mui-active': {
                boxShadow: '0px 0px 0px 14px rgba(124, 58, 237, 0.24)',
              },
            },
            '& .MuiSlider-rail': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        />

        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 35 }}>
          {formatTimeStr(duration)}
        </Typography>
      </ProgressSection>

      <VolumeSection>
        <Stack direction="row" spacing={1} sx={{ width: 120, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setIsMuted(!isMuted)} sx={{ color: 'text.secondary' }}>
            {isMuted || volume === 0 ? <VolumeMuteIcon /> : <VolumeUpIcon />}
          </IconButton>
          <Slider
            size="small"
            value={isMuted ? 0 : volume * 100}
            onChange={(_, val) => {
              setVolume((val as number) / 100);
              setIsMuted(false);
            }}
            sx={{
              color: 'text.secondary',
              height: 3,
              '& .MuiSlider-thumb': { width: 8, height: 8 },
            }}
          />
        </Stack>
      </VolumeSection>
    </PlayerContainer>
  );
}
