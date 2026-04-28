import { BlogService } from './blog.service';
import { Prisma } from '@prisma/client';
export declare class BlogController {
    private readonly blogService;
    constructor(blogService: BlogService);
    create(data: Prisma.BlogPostCreateInput): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        image: string | null;
        date: string;
    }>;
    findAll(): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        image: string | null;
        date: string;
    }[]>;
    findOne(idOrSlug: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        image: string | null;
        date: string;
    }>;
    update(id: string, data: Prisma.BlogPostUpdateInput): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        image: string | null;
        date: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        image: string | null;
        date: string;
    }>;
}
