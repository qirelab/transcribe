import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../lib/theme';
import SetupScreen from '../components/SetupScreen';

describe('SetupScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockApi = {
    configureApiKey: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider theme={theme}>
        <SetupScreen onSuccess={mockOnSuccess} api={mockApi} />
      </ThemeProvider>
    );
  };

  test('renders the setup screen correctly with instructions', () => {
    renderComponent();

    expect(screen.getByText('Welcome to Transcribe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter api_key...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate Application' })).toBeInTheDocument();
    expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
  });

  test('shows an error message when submitting an empty API key', async () => {
    renderComponent();

    const submitButton = screen.getByRole('button', { name: 'Activate Application' });
    fireEvent.click(submitButton);

    expect(await screen.findByText('API key cannot be empty')).toBeInTheDocument();
    expect(mockApi.configureApiKey).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('submits successfully with a valid API key and calls onSuccess', async () => {
    mockApi.configureApiKey.mockResolvedValue({ success: true });
    renderComponent();

    const input = screen.getByPlaceholderText('Enter api_key...');
    fireEvent.change(input, { target: { value: 'test_api_key_123' } });

    const submitButton = screen.getByRole('button', { name: 'Activate Application' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.configureApiKey).toHaveBeenCalledWith('test_api_key_123');
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('displays api error when key configuration fails', async () => {
    mockApi.configureApiKey.mockRejectedValue(new Error('Invalid API Key provided'));
    renderComponent();

    const input = screen.getByPlaceholderText('Enter api_key...');
    fireEvent.change(input, { target: { value: 'invalid_key' } });

    const submitButton = screen.getByRole('button', { name: 'Activate Application' });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Invalid API Key provided')).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
