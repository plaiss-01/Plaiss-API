export declare class ImportStatusService {
    private jobs;
    setJob(id: string, current: number, total: number, status?: string, message?: string): void;
    getJob(id: string): {
        current: number;
        total: number;
        status: string;
        message: string;
    } | undefined;
    updateJob(id: string, current: number, message?: string): void;
    completeJob(id: string, message: string): void;
    failJob(id: string, message: string): void;
}
