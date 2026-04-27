import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VisualSearchService } from './visual-search.service';

@Controller('visual-search')
export class VisualSearchController {
  constructor(private readonly visualSearchService: VisualSearchService) {}

  @Post('search')
  @UseInterceptors(FileInterceptor('image'))
  async searchByImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    // 1. Detect labels from the image
    const labels = await this.visualSearchService.detectLabels(file.buffer);

    if (labels.length === 0) {
        return {
            message: 'No recognizable objects found in the image',
            labels: [],
            products: []
        };
    }

    // 2. Search products in the database based on detected labels
    return this.visualSearchService.searchByLabels(labels);
  }
}
