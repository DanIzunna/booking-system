import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PublicAvailabilityCheckDto } from "./dto/public-availability-check.dto";
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
}
