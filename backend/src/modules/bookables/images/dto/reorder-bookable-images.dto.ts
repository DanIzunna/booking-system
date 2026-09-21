import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsString, IsUUID } from "class-validator";

export class ReorderBookableImagesDto {
  @ApiProperty({ type: [String], format: "uuid" })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsUUID("4", { each: true })
  imageIds!: string[];
}
