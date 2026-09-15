import { PartialType } from "@nestjs/swagger";
import { CreateAvailabilityWindowDto } from "./create-availability-window.dto";

export class UpdateAvailabilityWindowDto extends PartialType(
  CreateAvailabilityWindowDto,
) {}
