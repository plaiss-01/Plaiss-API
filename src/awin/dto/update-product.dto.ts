import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'The name of the product' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'The description of the product' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'The price of the product' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'The currency of the price' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'The image URL' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'The target product URL' })
  @IsUrl()
  @IsOptional()
  productUrl?: string;

  @ApiPropertyOptional({ description: 'The merchant name' })
  @IsString()
  @IsOptional()
  merchant?: string;

  @ApiPropertyOptional({ description: 'The category name' })
  @IsString()
  @IsOptional()
  category?: string;
}
