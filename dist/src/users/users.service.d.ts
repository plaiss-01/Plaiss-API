import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';
export declare class UsersService implements OnModuleInit {
    private readonly prisma;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    createSuperAdmin(): Promise<void>;
    registerIndividual(dto: RegisterIndividualDto): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    registerDesigner(dto: any): Promise<{
        portfolio: {
            id: string;
            createdAt: Date;
            url: string;
            title: string | null;
            userId: string;
        }[];
    } & {
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getAllUsers(): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getDesigners(): Promise<any>;
    getDesignerById(id: string): Promise<({
        portfolio: {
            id: string;
            createdAt: Date;
            url: string;
            title: string | null;
            userId: string;
        }[];
    } & {
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    getUserById(id: string): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updateUser(id: string, data: any): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(dto: any): Promise<{
        id: string;
        type: string;
        role: string;
        name: string;
        email: string;
        password: string | null;
        googleId: string | null;
        appleId: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    approveDesigner(id: string, isApproved: boolean): Promise<any>;
    getPendingDesigners(): Promise<any>;
}
