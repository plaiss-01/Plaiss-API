import { CategoryService } from './category.service';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
    create(data: {
        name: string;
        parentId?: string;
        isAwin?: boolean;
    }): Promise<any>;
    findAll(includeDeleted?: string): Promise<any>;
    restore(id: string): Promise<any>;
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
    update(id: string, data: {
        name?: string;
        parentId?: string | null;
    }): Promise<any>;
    remove(id: string): Promise<any>;
}
