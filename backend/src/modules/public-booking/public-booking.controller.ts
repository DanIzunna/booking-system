import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PublicAvailabilityCheckDto } from "./dto/public-availability-check.dto";
import { PublicAvailabilityDto } from "./dto/public-availability.dto";
import { PublicBookingService } from "./public-booking.service";

@Controller("public/bookables")
@ApiTags("public-booking")
export class PublicBookingController {
  constructor(private readonly publicBooking: PublicBookingService) {}

  @Get(":slug")
  @ApiOperation({ summary: "Get a published Bookable by slug" })
  @ApiParam({ name: "slug", example: "my-consultation" })
  @ApiResponse({ status: 404, description: "Published Bookable not found" })
  getBookable(@Param("slug") slug: string) {
    return this.publicBooking.getBookable(slug);
  }

  @Get(":slug/availability/check")
  @ApiOperation({
    summary: "Check whether a public interval can currently be booked",
  })
  @ApiParam({ name: "slug", example: "my-consultation" })
  @ApiQuery({ name: "startAt", required: true, type: String })
  @ApiQuery({ name: "endAt", required: true, type: String })
  @ApiQuery({ name: "quantity", required: true, type: Number })
  @ApiResponse({ status: 200, description: "Availability result" })
  @ApiResponse({ status: 404, description: "Published Bookable not found" })
  checkAvailability(
    @Param("slug") slug: string,
    @Query() query: PublicAvailabilityCheckDto,
  ) {
    return this.publicBooking.checkAvailability(slug, query);
  }

  @Get(":slug/availability")
  @ApiOperation({
    summary: "Get public booking availability for a workspace date",
  })
  @ApiParam({ name: "slug", example: "my-consultation" })
  @ApiQuery({
    name: "date",
    required: true,
    type: String,
    example: "2026-09-20",
  })
  @ApiQuery({ name: "quantity", required: false, type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: "Authoritative public availability",
  })
  @ApiResponse({ status: 404, description: "Published Bookable not found" })
  getAvailability(
    @Param("slug") slug: string,
    @Query() query: PublicAvailabilityDto,
  ) {
    return this.publicBooking.getAvailability(slug, query);
  }
}
