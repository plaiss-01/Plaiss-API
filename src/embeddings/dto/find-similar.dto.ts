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

export class FindSimilarDto {
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
