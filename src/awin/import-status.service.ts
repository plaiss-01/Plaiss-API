import { Injectable } from '@nestjs/common';

@Injectable()
export class ImportStatusService {
  private jobs = new Map<string, { current: number; total: number; status: string; message: string; timestamp: number }>();
  private readonly MAX_JOB_AGE = 3600000; // 1 hour
  private readonly MAX_JOBS = 100; // Hard limit on number of tracked jobs

  setJob(id: string, current: number, total: number, status: string = 'processing', message: string = '') {
    this.cleanup();
    
    // Hard limit cleanup
    if (this.jobs.size >= this.MAX_JOBS) {
      const oldestKey = this.jobs.keys().next().value;
      if (oldestKey) this.jobs.delete(oldestKey);
    }

    this.jobs.set(id, { current, total, status, message, timestamp: Date.now() });
  }

  getJob(id: string) {
    return this.jobs.get(id);
  }

  updateJob(id: string, current: number, message?: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.current = current;
      job.timestamp = Date.now(); // Update timestamp to keep it longer if it's active
      if (message !== undefined) job.message = message;
    }
  }

  completeJob(id: string, message: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'completed';
      job.message = message;
      job.timestamp = Date.now();
    }
  }

  failJob(id: string, message: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.message = message;
      job.timestamp = Date.now();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.timestamp > this.MAX_JOB_AGE) {
        this.jobs.delete(id);
      }
    }
  }
}
