import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContactSubmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  name: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason for contact is required' })
  reason: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message: string;
}
