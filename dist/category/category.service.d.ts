import { PrismaService } from '../prisma.service';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private static categoriesCache;
    private readonly CACHE_TTL;
    getCategoryStructure(): Promise<{
        data: any[];
        categoryMap: Map<string, any>;
        childrenMap: Map<string, any[]>;
        timestamp: number;
    }>;
    clearCache(): void;
    private slugify;
    create(data: {
        name: string;
        parentId?: string;
        isAwin?: boolean;
        imageUrl?: string;
    }): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    }>;
    findAll(isAwin?: boolean, search?: string, limit?: number, parentId?: string | null): Promise<({
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    })[]>;
    findRoots(): Promise<({
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    })[]>;
    reorder(orders: {
        id: string;
        order: number;
    }[]): Promise<never[]>;
    bulkLink(ids: string[], parentId: string): Promise<{
        count: number;
    }>;
    findOne(id: string): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    }>;
    findBySlug(slug: string): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            imageUrl: string | null;
            headerImageUrl: string | null;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        success: boolean;
        message: string;
    } | {
        success: boolean;
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
        message?: undefined;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        imageUrl: string | null;
        headerImageUrl: string | null;
        parentId: string | null;
    }>;
    removeAll(): Promise<{
        count: number;
    }>;
    syncAwinCategories(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
}
