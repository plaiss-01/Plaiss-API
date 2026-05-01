import { CategoryService } from './category.service';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
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
    syncAwin(): Promise<{
        message: string;
        newlyCreated: number;
    }>;
    findBySlug(slug: string): Promise<any>;
    findOne(id: string): Promise<any>;
    bulkLink(data: {
        ids: string[];
        parentId: string;
    }): Promise<any>;
    forceUpdate(id: string, data: any): Promise<{
        id: string;
        success: boolean;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        success: boolean;
    }>;
    remove(id: string): Promise<any>;
    removeAll(): Promise<any>;
}
