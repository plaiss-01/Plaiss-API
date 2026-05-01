import { BlogService } from './blog.service';
import { Prisma } from '@prisma/client';
export declare class BlogController {
    private readonly blogService;
    constructor(blogService: BlogService);
    create(data: Prisma.BlogPostCreateInput): Promise<{
        slug: string;
        id: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        image: string | null;
        date: string;
    }>;
    findAll(): Promise<{
        slug: string;
        id: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        image: string | null;
        date: string;
    }[]>;
    findOne(idOrSlug: string): Promise<{
        slug: string;
        id: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        image: string | null;
        date: string;
    }>;
    update(id: string, data: Prisma.BlogPostUpdateInput): Promise<{
        slug: string;
        id: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        image: string | null;
        date: string;
    }>;
    remove(id: string): Promise<{
        slug: string;
        id: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        title: string;
        image: string | null;
        date: string;
    }>;
}
