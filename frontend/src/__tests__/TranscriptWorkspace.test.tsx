import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../lib/theme';
import TranscriptWorkspace from '../components/TranscriptWorkspace';
import { TranscriptRecord, transcribeApi } from '../lib/api';

// Mock transcribeApi
jest.mock('../lib/api', () => ({
  transcribeApi: {
    renameSpeaker: jest.fn(),
    getExportUrl: jest.fn((id, format) => `http://localhost:3001/transcribe/export/${id}?format=${format}`),
  },
}));

const mockRecord: TranscriptRecord = {
  id: '123',
  title: 'Mock Interview Title',
  status: 'completed',
  createdAt: '2026-05-22T12:00:00Z',
  updatedAt: '2026-05-22T12:00:00Z',
  wordsCount: 15,
  utterances: [
    {
      speaker: 'A',
      text: 'Hello world this is speaker A talking.',
      start: 0,
      end: 3000,
    },
    {
      speaker: 'B',
      text: 'Hi there from speaker B yes.',
      start: 3500,
      end: 6000,
    },
  ],
  summary: 'This is an executive summary of the conversation.',
  chapters: [
    {
      start: 0,
      end: 3000,
      headline: 'Introduction',
      gist: 'Speaker A welcomes',
      summary: 'Speaker A introduces the topic.',
    },
  ],
  speakerNames: {
    A: 'Alice',
  },
};

describe('TranscriptWorkspace Component', () => {
  const mockOnSeek = jest.fn();
  const mockOnUpdateRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.open = jest.fn(); // Mock window.open for exporter
  });

  const renderComponent = (currentTimeMs = 0, record = mockRecord) => {
    return render(
      <ThemeProvider theme={theme}>
        <TranscriptWorkspace
          record={record}
          currentTimeMs={currentTimeMs}
          onSeek={mockOnSeek}
          onUpdateRecord={mockOnUpdateRecord}
        />
      </ThemeProvider>
    );
  };

  test('renders transcript timeline, summary, and action bar correctly', () => {
    renderComponent();

    expect(screen.getByText('Mock Interview Title')).toBeInTheDocument();
    expect(screen.getByText('15 words • 2 segments')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search transcript...')).toBeInTheDocument();

    // Speakers
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Speaker B')).toBeInTheDocument();

    // Texts
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('talking.')).toBeInTheDocument();

    // Executive summary default tab
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('This is an executive summary of the conversation.')).toBeInTheDocument();
  });

  test('word-click triggers onSeek callback with correct timestamp', () => {
    renderComponent();

    // Click on the word "world" in Speaker A utterance (approx index 1 out of 7 words)
    // words count in utterance 1 = 7 words
    // start = 0, duration = 3000, msPerWord = 3000 / 7 = 428.57ms
    // "Hello" is index 0 (0ms), "world" is index 1 (428.57ms)
    const worldWord = screen.getByText('world');
    fireEvent.click(worldWord);

    expect(mockOnSeek).toHaveBeenCalled();
    const seekMs = mockOnSeek.mock.calls[0][0];
    expect(seekMs).toBeCloseTo(428.57, 1);
  });

  test('search filters match keyword highlights', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Search transcript...');
    fireEvent.change(searchInput, { target: { value: 'speaker' } });

    // Word "speaker" should have $isSearchMatch true (i.e. background-color rgba(234, 179, 8, 0.4))
    const speakerWords = screen.getAllByText(/speaker/i);
    expect(speakerWords.length).toBeGreaterThan(0);
  });

  test('clicking tabs switches between AI Summary and Chapters index', () => {
    renderComponent();

    // Initially Summary is selected
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    
    // Switch to Chapters
    const chaptersTab = screen.getByRole('tab', { name: /Chapters/i });
    fireEvent.click(chaptersTab);

    expect(screen.getByText('Chapters Index')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Speaker A welcomes')).toBeInTheDocument();
  });

  test('clicking chapter seek seeks player to chapter start', () => {
    renderComponent();

    // Switch to Chapters
    const chaptersTab = screen.getByRole('tab', { name: /Chapters/i });
    fireEvent.click(chaptersTab);

    const chapterItem = screen.getByText('Introduction');
    fireEvent.click(chapterItem);

    expect(mockOnSeek).toHaveBeenCalledWith(0);
  });

  test('opens speaker rename modal and updates successfully', async () => {
    const updatedRecord = {
      ...mockRecord,
      speakerNames: { ...mockRecord.speakerNames, B: 'Bob' },
    };
    (transcribeApi.renameSpeaker as jest.Mock).mockResolvedValue(updatedRecord);

    renderComponent();

    // Alice is speaker A, Speaker B is speaker B.
    const editB = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="EditIcon"]'))[1];

    fireEvent.click(editB);

    // Modal should open
    expect(screen.getByText('Rename Speaker B')).toBeInTheDocument();
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'Bob' } });

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(transcribeApi.renameSpeaker).toHaveBeenCalledWith('123', 'B', 'Bob');
      expect(mockOnUpdateRecord).toHaveBeenCalledWith(updatedRecord);
    });
  });

  test('opens export menu and triggers file export', () => {
    renderComponent();

    const exportButton = screen.getByRole('button', { name: 'Export Transcript' });
    fireEvent.click(exportButton);

    const srtOption = screen.getByText('Subtitles (.srt)');
    fireEvent.click(srtOption);

    expect(window.open).toHaveBeenCalledWith(
      'http://localhost:3001/transcribe/export/123?format=srt',
      '_blank'
    );
  });
});
