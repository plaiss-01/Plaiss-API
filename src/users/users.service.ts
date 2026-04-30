import { Injectable, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';
import * as crypto from 'crypto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.createSuperAdmin();
    } catch (error) {
      console.error('Failed to initialize super admin:', error.message);
      // Don't throw error to allow app to start
    }
  }

  async createSuperAdmin() {
    const adminEmail = 'admin@plaiss.com';
    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = crypto
        .createHash('sha256')
        .update('admin123')
        .digest('hex');

      await this.prisma.user.create({
        data: {
          name: 'Super Admin',
          email: adminEmail,
          password: hashedPassword,
          type: 'ADMIN',
          role: 'ADMIN',
        },
      });
      console.log('Super Admin created: admin@plaiss.com / admin123');
    }
  }


  async registerIndividual(dto: RegisterIndividualDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash the password using SHA-256
    const hashedPassword = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        type: 'INDIVIDUAL',
      },
    });
  }

  async registerDesigner(dto: any) {
    const { portfolio, ...userData } = dto;
    
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = crypto
      .createHash('sha256')
      .update(userData.password)
      .digest('hex');

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        type: 'INTERIOR_DESIGNER',
        isDesigner: true,
        isApproved: false,
        role: 'DESIGNER',
        portfolio: {
          create: portfolio,
        },
      },
      include: {
        portfolio: true,
      },
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async getDesigners() {
    return (this.prisma as any).user.findMany({
      where: { 
        type: 'INTERIOR_DESIGNER',
        isApproved: true 
      },
      include: { portfolio: true },
    });
  }

  async getDesignerById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, type: 'INTERIOR_DESIGNER' },
      include: { portfolio: true },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string) {
    // Manually handle cascading delete for portfolio images
    await this.prisma.portfolioImage.deleteMany({
      where: { userId: id },
    });
    
    return this.prisma.user.delete({
      where: { id },
    });
  }


  async login(dto: any) {
    const hashedPassword = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    if (!user) {
      throw new ConflictException('Invalid credentials');
    }
    return user;
  }

  async approveDesigner(id: string, isApproved: boolean) {
    return (this.prisma as any).user.update({
      where: { id },
      data: { isApproved },
    });
  }

  async getPendingDesigners() {
    return (this.prisma as any).user.findMany({
      where: { 
        type: 'INTERIOR_DESIGNER',
        isApproved: false 
      },
      include: { portfolio: true },
    });
  }
}


