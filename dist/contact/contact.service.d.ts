import { ConfigService } from '@nestjs/config';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
export declare class ContactService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    sendContactMessage(dto: CreateContactSubmissionDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
