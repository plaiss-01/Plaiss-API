import { PrismaService } from '../prisma.service';
import { BlogPost, Prisma } from '@prisma/client';
export declare class BlogService {
    private prisma;
    constructor(prisma: PrismaService);
    create(data: Prisma.BlogPostCreateInput): Promise<BlogPost>;
    findAll(): Promise<BlogPost[]>;
    findOne(id: string): Promise<BlogPost>;
    findBySlug(slug: string): Promise<BlogPost>;
    update(id: string, data: Prisma.BlogPostUpdateInput): Promise<BlogPost>;
    remove(id: string): Promise<BlogPost>;
}
