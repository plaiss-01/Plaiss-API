import { UsersService } from './users.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    registerIndividual(dto: RegisterIndividualDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }>;
    registerDesigner(dto: any): Promise<{
        portfolio: {
            url: string;
            id: string;
            createdAt: Date;
            title: string | null;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }>;
    getAllUsers(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }[]>;
    getDesigners(): Promise<({
        portfolio: {
            url: string;
            id: string;
            createdAt: Date;
            title: string | null;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    })[]>;
    getDesignerById(id: string): Promise<({
        portfolio: {
            url: string;
            id: string;
            createdAt: Date;
            title: string | null;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }) | null>;
    getUserById(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    } | null>;
    updateUser(id: string, dto: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }>;
    login(dto: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        email: string;
        password: string | null;
        address: string | null;
        phone: string | null;
        googleId: string | null;
        appleId: string | null;
        role: string;
    }>;
}
