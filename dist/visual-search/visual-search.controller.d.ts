import { VisualSearchService } from './visual-search.service';
export declare class VisualSearchController {
    private readonly visualSearchService;
    constructor(visualSearchService: VisualSearchService);
    searchByImage(file: Express.Multer.File): Promise<never[] | {
        labels: any[];
        products: any[];
    } | {
        message: string;
        labels: never[];
        products: never[];
    }>;
}
