import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
