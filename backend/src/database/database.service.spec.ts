import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import * as fs from 'fs';

jest.mock('fs');

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getApiKey', () => {
    it('should read api key from config file', () => {
      const mockConfig = { apiKey: 'test-api-key-from-config' };
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockConfig),
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = service.getApiKey();
      expect(result).toBe('test-api-key-from-config');
    });

    it('should return empty string if read fails', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = service.getApiKey();
      expect(result).toBe('');
    });
  });

  describe('getTranscripts', () => {
    it('should return loaded transcripts from file', () => {
      const mockTranscripts = [
        {
          id: 'tx-123',
          userId: 'user-1',
          title: 'test.mp3',
          status: 'completed',
        },
        {
          id: 'tx-456',
          userId: 'user-2',
          title: 'private.mp3',
          status: 'completed',
        },
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockTranscripts),
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = service.getTranscripts('user-1');
      expect(result).toEqual([mockTranscripts[0]]);
    });

    it('should return empty array if read fails', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = service.getTranscripts('user-1');
      expect(result).toEqual([]);
    });
  });
});
