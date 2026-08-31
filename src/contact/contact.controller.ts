import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a contact form enquiry' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async handleContactSubmission(@Body() dto: CreateContactSubmissionDto) {
    return this.contactService.sendContactMessage(dto);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join the launch mailing list' })
  @ApiResponse({ status: 200, description: 'Email address stored' })
  async handleSubscribe(@Body() body: { email?: string; source?: string }) {
    return this.contactService.subscribe(body?.email ?? '', body?.source ?? 'footer');
  }
}
