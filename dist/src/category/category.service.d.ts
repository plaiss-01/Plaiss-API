import { PrismaService } from '../prisma.service';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
    update(id: string, data: any): Promise<{
        id: string;
        success: boolean;
    }>;
    remove(id: string): Promise<any>;
    removeAll(): Promise<any>;
    syncAwinCategories(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
}
