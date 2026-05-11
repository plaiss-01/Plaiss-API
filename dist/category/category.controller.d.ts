import { CategoryService } from './category.service';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
    create(data: {
        name: string;
        parentId?: string;
        isAwin?: boolean;
    }): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    }>;
    findAll(isAwin?: string, search?: string, limit?: string, parentId?: string): Promise<({
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    })[]>;
    findRoots(): Promise<({
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    })[]>;
    reorder(orders: {
        id: string;
        order: number;
    }[]): Promise<never[]>;
    syncAwin(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
    findBySlug(slug: string): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    }>;
    findOne(id: string): Promise<{
        parent: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        } | null;
        children: {
            id: string;
            name: string;
            slug: string;
            isAwin: boolean;
            parentId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    }>;
    bulkLink(data: {
        ids: string[];
        parentId: string;
    }): Promise<{
        count: number;
    }>;
    forceUpdate(id: string, data: any): Promise<{
        id: string;
        success: boolean;
        message: string;
    } | {
        success: boolean;
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
        message?: undefined;
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
        parentId: string | null;
        message?: undefined;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        isAwin: boolean;
        parentId: string | null;
    }>;
    removeAll(): Promise<{
        count: number;
    }>;
}
