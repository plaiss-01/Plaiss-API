import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { PrismaService } from '../prisma.service';

describe('CategoryService.bulkLink', () => {
  let service: CategoryService;

  const mockPrisma = {
    category: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    service.clearCache();
  });

  it('does nothing and returns count 0 for an empty id list', async () => {
    const result = await service.bulkLink([], 'parent-1');

    expect(result).toEqual({ count: 0 });
    expect(mockPrisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('throws when the target parent does not exist', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    await expect(service.bulkLink(['a', 'b'], 'missing-parent')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('re-parents every id under the given parent and clears the cache', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'lighting', name: 'Lighting' });
    mockPrisma.category.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.bulkLink(['a', 'b', 'c'], 'lighting');

    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b', 'c'] } },
      data: { parentId: 'lighting' },
    });
    expect(result).toEqual({ count: 3 });
  });

  it('drops a category from the batch if it is also the requested parent, instead of failing the whole request', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'lighting', name: 'Lighting' });
    mockPrisma.category.updateMany.mockResolvedValue({ count: 2 });

    await service.bulkLink(['a', 'lighting', 'b'], 'lighting');

    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { parentId: 'lighting' },
    });
  });

  it('unlinks (sets parentId null) when parentId is the string "null", without a lookup', async () => {
    mockPrisma.category.updateMany.mockResolvedValue({ count: 2 });

    await service.bulkLink(['a', 'b'], 'null');

    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { parentId: null },
    });
  });
});
