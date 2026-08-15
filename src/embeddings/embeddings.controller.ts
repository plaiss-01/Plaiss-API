import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EmbeddingsService } from './embeddings.service';
import { EMBEDDING_DIMENSIONS } from './embeddings.sql';

class FindSimilarDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  types: string[];

  @IsArray()
  @IsNumber({}, { each: true })
  embedding: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post('similar')
  async similar(@Body() dto: FindSimilarDto) {
    if (dto.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new BadRequestException(
        `embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions, got ${dto.embedding.length}`,
      );
    }

    const data = await this.embeddingsService.findSimilar(
      dto.types,
      dto.embedding,
      dto.limit ?? 12,
    );

    return { data };
  }
}
