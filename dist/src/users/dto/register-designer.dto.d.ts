declare class PortfolioItemDto {
    url: string;
    title?: string;
}
export declare class RegisterDesignerDto {
    name: string;
    email: string;
    password: string;
    address?: string;
    phone?: string;
    portfolio: PortfolioItemDto[];
}
export {};
