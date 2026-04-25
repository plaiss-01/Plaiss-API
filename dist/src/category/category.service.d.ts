import { PrismaService } from '../prisma.service';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private slugify;
    create(data: {
        name: string;
        parentId?: string;
        isAwin?: boolean;
    }): Promise<any>;
    findAll(includeDeleted?: boolean): Promise<any>;
    findRoots(): Promise<any>;
    findOne(id: string): Promise<any>;
    findBySlug(slug: string): Promise<any>;
    update(id: string, data: {
        name?: string;
        parentId?: string | null;
    }): Promise<any>;
    remove(id: string): Promise<any>;
    restore(id: string): Promise<any>;
    syncAwinCategories(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
}
