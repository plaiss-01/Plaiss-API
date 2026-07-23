import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'CONTACT_RECEIVER_EMAIL') return 'hello@plaiss.com';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process contact submission in dev fallback mode cleanly', async () => {
    const result = await service.sendContactMessage({
      name: 'John Doe',
      email: 'john@example.com',
      reason: 'General Enquiries',
      message: 'Hello, I have a question about Plaiss.',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Message received');
  });
});
