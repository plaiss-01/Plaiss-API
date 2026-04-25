import { Injectable } from '@nestjs/common';

@Injectable()
export class ImportStatusService {
  private jobs = new Map<string, { current: number; total: number; status: string; message: string }>();

  setJob(id: string, current: number, total: number, status: string = 'processing', message: string = '') {
    this.jobs.set(id, { current, total, status, message });
  }

  getJob(id: string) {
    return this.jobs.get(id);
  }

  updateJob(id: string, current: number, message?: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.current = current;
      if (message !== undefined) job.message = message;
    }
  }

  completeJob(id: string, message: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'completed';
      job.message = message;
    }
  }

  failJob(id: string, message: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.message = message;
    }
  }
}
