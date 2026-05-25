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
  duration: number; // in seconds
  seekTrigger: number | null; // seek request in ms
  onTimeUpdate: (ms: number) => void; // reports playback time in ms
}

export default function CustomAudioPlayer({
  duration,
  seekTrigger,
  onTimeUpdate,
}: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Store callbacks/state in refs to prevent dependency changes from re-triggering effects
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync seek triggers from clicking words/chapters
  useEffect(() => {
    if (seekTrigger !== null && audioRef.current) {
      const seekSec = seekTrigger / 1000;
      audioRef.current.currentTime = seekSec;
      setCurrentTime(seekSec);
      onTimeUpdateRef.current(seekTrigger);
      
      // Auto play on seek to feel snappy
      if (!isPlayingRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [seekTrigger]);

  // Sync volume state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle play/pause
  const togglePlay = React.useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const skipTime = (secs: number) => {
    if (!audioRef.current) return;
    let target = audioRef.current.currentTime + secs;
    if (target < 0) target = 0;
    if (target > duration) target = duration;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
    onTimeUpdateRef.current(target * 1000);
  };

  const handleProgressChange = (_: unknown, value: number | number[]) => {
    const val = value as number;
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
    setCurrentTime(val);
    onTimeUpdateRef.current(val * 1000);
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const sec = audioRef.current.currentTime;
      setCurrentTime(sec);
      onTimeUpdateRef.current(sec * 1000);
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

  // Generate a mock synthesized audio voice stream if there is no physical audio path
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            clearInterval(timer);
            return duration;
          }
          const next = prev + 0.25; // tick every 250ms
          onTimeUpdateRef.current(next * 1000);
          return next;
        });
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration]);

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
      {/* Invisible HTML5 Audio Tag (in case user mounts actual URL in the future) */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
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
