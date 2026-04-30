import { PrismaService } from '../prisma.service';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private categoriesCache;
    private readonly CACHE_TTL;
    clearCache(): void;
    private slugify;
    create(data: {
        name: string;
        parentId?: string;
        isAwin?: boolean;
    }): Promise<any>;
    findAll(): Promise<any>;
    findRoots(): Promise<any>;
    reorder(orders: {
        id: string;
        order: number;
    }[]): Promise<any[]>;
    bulkLink(ids: string[], parentId: string): Promise<any>;
    findOne(id: string): Promise<any>;
    findBySlug(slug: string): Promise<any>;
    update(id: string, data: {
        name?: string;
        parentId?: string | null;
    }): Promise<any>;
    remove(id: string): Promise<any>;
    removeAll(): Promise<any>;
    syncAwinCategories(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
}
