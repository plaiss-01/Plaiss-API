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
        content: string;
        title: string;
        image: string | null;
        updatedAt: Date;
        date: string;
    }>;
    findAll(): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        content: string;
        title: string;
        image: string | null;
        updatedAt: Date;
        date: string;
    }[]>;
    findOne(idOrSlug: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        content: string;
        title: string;
        image: string | null;
        updatedAt: Date;
        date: string;
    }>;
    update(id: string, data: Prisma.BlogPostUpdateInput): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        content: string;
        title: string;
        image: string | null;
        updatedAt: Date;
        date: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        content: string;
        title: string;
        image: string | null;
        updatedAt: Date;
        date: string;
    }>;
}
