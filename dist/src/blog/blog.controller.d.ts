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
        content: string;
        title: string;
        date: string;
        image: string | null;
    }>;
    findAll(): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        date: string;
        image: string | null;
    }[]>;
    findOne(idOrSlug: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        date: string;
        image: string | null;
    }>;
    update(id: string, data: Prisma.BlogPostUpdateInput): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        date: string;
        image: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        slug: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        date: string;
        image: string | null;
    }>;
}
