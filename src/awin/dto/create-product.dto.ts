import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'The Awin affiliate URL or the target product URL',
    example: 'https://www.awin1.com/cread.php?awinid=XXX&awinaffid=YYY&ued=https://example.com/product',
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;
}
