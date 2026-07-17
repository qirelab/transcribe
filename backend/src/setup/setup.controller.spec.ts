import { Test, TestingModule } from '@nestjs/testing';
import { SetupController } from './setup.controller';
import { DatabaseService } from '../database/database.service';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('SetupController', () => {
  let controller: SetupController;

  const mockDbService = {
    getApiKey: jest.fn(),
    saveApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetupController],
      providers: [
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SetupController>(SetupController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return hasApiKey: true when api key exists', () => {
      mockDbService.getApiKey.mockReturnValue('valid-api-key');
      const result = controller.getStatus();
      expect(result).toEqual({ hasApiKey: true });
    });

    it('should return hasApiKey: false when api key does not exist', () => {
      mockDbService.getApiKey.mockReturnValue('');
      const result = controller.getStatus();
      expect(result).toEqual({ hasApiKey: false });
    });
  });

  describe('configure', () => {
    it('should save the api key and return success', () => {
      const result = controller.configure({ apiKey: 'new-key' });
      expect(mockDbService.saveApiKey).toHaveBeenCalledWith('new-key');
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException if api key is empty', () => {
      expect(() => controller.configure({ apiKey: '' })).toThrow(
        BadRequestException,
      );
    });
  });
});
