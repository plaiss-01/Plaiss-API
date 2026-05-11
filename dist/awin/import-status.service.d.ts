export declare class ImportStatusService {
    private jobs;
    private readonly MAX_JOB_AGE;
    private readonly MAX_JOBS;
    setJob(id: string, current: number, total: number, status?: string, message?: string): void;
    getJob(id: string): {
        current: number;
        total: number;
        status: string;
        message: string;
        timestamp: number;
        result?: Record<string, unknown>;
    } | undefined;
    updateJob(id: string, current: number, message?: string, total?: number): void;
    completeJob(id: string, message: string, result?: Record<string, unknown>): void;
    failJob(id: string, message: string): void;
    private cleanup;
}
