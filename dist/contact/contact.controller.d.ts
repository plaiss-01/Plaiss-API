import { ContactService } from './contact.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
export declare class ContactController {
    private readonly contactService;
    constructor(contactService: ContactService);
    handleContactSubmission(dto: CreateContactSubmissionDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
