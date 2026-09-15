import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { BookablesService } from "./bookables.service";
import { CreateBookableDto } from "./dto/create-bookable.dto";
import { ListBookablesDto } from "./dto/list-bookables.dto";
import { UpdateBookableDto } from "./dto/update-bookable.dto";

@Controller("bookables")
@UseGuards(AccessTokenGuard)
@ApiTags("bookables")
@ApiBearerAuth()
export class BookablesController {
  constructor(private readonly bookables: BookablesService) {}

  @Post()
  @ApiOperation({ summary: "Create a Bookable for a member organization" })
  @ApiResponse({
    status: 201,
    description: "Bookable created as DRAFT by default",
  })
  @ApiResponse({ status: 404, description: "Organization is not accessible" })
  @ApiResponse({ status: 409, description: "Slug already exists globally" })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateBookableDto,
  ) {
    return this.bookables.create(request.user.id, input);
  }

  @Get()
  @ApiOperation({ summary: "List Bookables in the user's organizations" })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() filter: ListBookablesDto,
  ) {
    return this.bookables.list(request.user.id, filter);
  }

  @Get(":bookableId")
  @ApiOperation({ summary: "Get a Bookable in a member organization" })
  @ApiParam({ name: "bookableId", format: "uuid" })
  @ApiResponse({
    status: 404,
    description: "Bookable or organization not accessible",
  })
  get(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
  ) {
    return this.bookables.get(request.user.id, bookableId);
  }

  @Patch(":bookableId")
  @ApiOperation({ summary: "Update a Bookable (OWNER only)" })
  @ApiParam({ name: "bookableId", format: "uuid" })
  @ApiResponse({ status: 403, description: "OWNER membership required" })
  update(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Body() input: UpdateBookableDto,
  ) {
    return this.bookables.update(request.user.id, bookableId, input);
  }

  @Post(":bookableId/archive")
  @ApiOperation({ summary: "Archive a Bookable (OWNER only)" })
  @ApiParam({ name: "bookableId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Bookable archived" })
  @ApiResponse({ status: 403, description: "OWNER membership required" })
  archive(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
  ) {
    return this.bookables.archive(request.user.id, bookableId);
  }
}
