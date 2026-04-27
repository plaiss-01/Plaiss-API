import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BlogPost, Prisma } from '@prisma/client';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.BlogPostCreateInput): Promise<BlogPost> {
    return this.prisma.blogPost.create({
      data,
    });
  }

  async findAll(): Promise<BlogPost[]> {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async findBySlug(slug: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async update(id: string, data: Prisma.BlogPostUpdateInput): Promise<BlogPost> {
    return this.prisma.blogPost.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<BlogPost> {
    return this.prisma.blogPost.delete({
      where: { id },
    });
  }
}
