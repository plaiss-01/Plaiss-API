import { PrismaService } from '../prisma.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    registerIndividual(dto: RegisterIndividualDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string;
        address: string | null;
        phone: string | null;
    }>;
    getAllUsers(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string;
        address: string | null;
        phone: string | null;
    }[]>;
    getUserById(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string;
        address: string | null;
        phone: string | null;
    } | null>;
}
