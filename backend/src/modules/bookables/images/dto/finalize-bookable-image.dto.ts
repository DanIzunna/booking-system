import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class FinalizeBookableImageDto {
  @ApiProperty({ example: "683f9f7a9f1c4b0012345678" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileId!: string;

  @ApiProperty({ example: "room-photo.jpg" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ description: "Client upload result path, verified by the provider" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filePath?: string;

  @ApiPropertyOptional({ description: "Client upload result URL, verified by the provider" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ description: "Provider response MIME type, verified by the provider" })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: "Provider response file size, verified by the provider" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSizeBytes?: number;

  @ApiPropertyOptional({ description: "Provider response width, verified by the provider" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @ApiPropertyOptional({ description: "Provider response height, verified by the provider" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;

  @ApiPropertyOptional({ example: "room-photo.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;
}
