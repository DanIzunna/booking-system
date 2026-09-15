import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsISO8601, IsInt, Min } from "class-validator";

export class PublicAvailabilityCheckDto {
  @ApiProperty({ example: "2026-09-20T10:00:00.000Z" })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: "2026-09-20T10:30:00.000Z" })
  @IsISO8601()
  endAt!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
