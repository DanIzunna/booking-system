import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AvailabilityService } from "./availability.service";
import { CheckAvailabilityDto } from "./dto/check-availability.dto";
import { CreateAvailabilityExceptionDto } from "./dto/create-availability-exception.dto";
import { CreateAvailabilityWindowDto } from "./dto/create-availability-window.dto";
import { UpdateAvailabilityExceptionDto } from "./dto/update-availability-exception.dto";
import { UpdateAvailabilityWindowDto } from "./dto/update-availability-window.dto";

@Controller("bookables/:bookableId/availability")
@UseGuards(AccessTokenGuard)
@ApiTags("availability")
@ApiBearerAuth()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post("windows")
  @ApiOperation({ summary: "Create an availability window (OWNER only)" })
  createWindow(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Body() input: CreateAvailabilityWindowDto,
  ) {
    return this.availability.createWindow(request.user.id, bookableId, input);
  }

  @Get("windows")
  @ApiOperation({ summary: "List availability windows" })
  listWindows(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
  ) {
    return this.availability.listWindows(request.user.id, bookableId);
  }

  @Patch("windows/:windowId")
  updateWindow(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Param("windowId") windowId: string,
    @Body() input: UpdateAvailabilityWindowDto,
  ) {
    return this.availability.updateWindow(
      request.user.id,
      bookableId,
      windowId,
      input,
    );
  }

  @Delete("windows/:windowId")
  @HttpCode(204)
  deleteWindow(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Param("windowId") windowId: string,
  ) {
    return this.availability.deleteWindow(
      request.user.id,
      bookableId,
      windowId,
    );
  }

  @Post("exceptions")
  createException(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Body() input: CreateAvailabilityExceptionDto,
  ) {
    return this.availability.createException(
      request.user.id,
      bookableId,
      input,
    );
  }

  @Get("exceptions")
  listExceptions(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
  ) {
    return this.availability.listExceptions(request.user.id, bookableId);
  }

  @Patch("exceptions/:exceptionId")
  updateException(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Param("exceptionId") exceptionId: string,
    @Body() input: UpdateAvailabilityExceptionDto,
  ) {
    return this.availability.updateException(
      request.user.id,
      bookableId,
      exceptionId,
      input,
    );
  }

  @Delete("exceptions/:exceptionId")
  @HttpCode(204)
  deleteException(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Param("exceptionId") exceptionId: string,
  ) {
    return this.availability.deleteException(
      request.user.id,
      bookableId,
      exceptionId,
    );
  }

  @Get("check")
  @ApiParam({ name: "bookableId", format: "uuid" })
  check(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Query() query: CheckAvailabilityDto,
  ) {
    return this.availability.check(
      request.user.id,
      bookableId,
      query.startAt,
      query.endAt,
    );
  }
}
