import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmbeddingsService } from './embeddings.service';
import { EMBEDDING_DIMENSIONS } from './embeddings.sql';
import { FindSimilarDto } from './dto/find-similar.dto';

@ApiTags('embeddings')
@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post('similar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Find visually similar products by DINOv2 embedding' })
  @ApiResponse({ status: 200, description: 'Similar products found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
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
