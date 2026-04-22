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
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }>;
    registerDesigner(dto: any): Promise<{
        portfolio: {
            id: string;
            createdAt: Date;
            title: string | null;
            url: string;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }>;
    getAllUsers(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }[]>;
    getDesigners(): Promise<({
        portfolio: {
            id: string;
            createdAt: Date;
            title: string | null;
            url: string;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    })[]>;
    getDesignerById(id: string): Promise<({
        portfolio: {
            id: string;
            createdAt: Date;
            title: string | null;
            url: string;
            userId: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }) | null>;
    getUserById(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    } | null>;
    updateUser(id: string, dto: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }>;
    login(dto: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        googleId: string | null;
        appleId: string | null;
        type: string;
        role: string;
        password: string | null;
        address: string | null;
        phone: string | null;
    }>;
}
