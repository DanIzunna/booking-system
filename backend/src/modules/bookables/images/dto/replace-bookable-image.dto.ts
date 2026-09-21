import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class ReplaceBookableImageDto {
  @ApiProperty({ example: "683f9f7a9f1c4b0012345678" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileId!: string;

  @ApiProperty({ example: "room-photo-new.jpg" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ description: "Provider response path, verified by the provider" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filePath?: string;

  @ApiPropertyOptional({ description: "Provider response URL, verified by the provider" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;

  @ApiPropertyOptional({ example: "room-photo-new.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;
}
