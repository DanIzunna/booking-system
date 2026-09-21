import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class AuthorizeBookableImageDto {
  @ApiPropertyOptional({ example: "room-photo.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;

  @ApiPropertyOptional({ enum: ["image/jpeg", "image/png", "image/webp"] })
  @IsOptional()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType?: string;
}
