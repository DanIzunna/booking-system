import { ApiProperty } from "@nestjs/swagger";
import { IsISO8601 } from "class-validator";

export class CheckAvailabilityDto {
  @ApiProperty({ example: "2026-10-12T08:00:00.000Z" })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: "2026-10-12T12:00:00.000Z" })
  @IsISO8601()
  endAt!: string;
}
