import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AccessTokenGuard } from "../../auth/guards/access-token.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import {
  BookableImagesService,
} from "./bookable-images.service";
import { AuthorizeBookableImageDto } from "./dto/authorize-bookable-image.dto";
import { FinalizeBookableImageDto } from "./dto/finalize-bookable-image.dto";
import { ReplaceBookableImageDto } from "./dto/replace-bookable-image.dto";
import { ReorderBookableImagesDto } from "./dto/reorder-bookable-images.dto";

@Controller("bookables")
@UseGuards(AccessTokenGuard)
@ApiTags("bookables")
@ApiBearerAuth()
export class BookableImagesController {
  constructor(private readonly bookableImages: BookableImagesService) {}

  @Post(":bookableId/images/upload-authorization")
  @ApiOperation({ summary: "Authorize a direct upload for a Bookable image" })
  authorizeUpload(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Body() input: AuthorizeBookableImageDto,
  ) {
    return this.bookableImages.authorizeUpload(request.user.id, bookableId, input);
  }

  @Post(":bookableId/images")
  @ApiOperation({ summary: "Finalize and persist a Bookable image upload" })
  finalize(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Body() input: FinalizeBookableImageDto,
  ) {
    return this.bookableImages.finalize(request.user.id, bookableId, input);
  }

  @Get(":bookableId/images")
  @ApiOperation({ summary: "List images for a Bookable" })
  list(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
  ) {
    return this.bookableImages.list(request.user.id, bookableId);
  }

  @Patch(":bookableId/images/reorder")
  @ApiOperation({ summary: "Reorder images for a Bookable" })
  reorder(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Body() input: ReorderBookableImagesDto,
  ) {
    return this.bookableImages.reorder(request.user.id, bookableId, input);
  }

  @Patch(":bookableId/images/:imageId/primary")
  @ApiOperation({ summary: "Set a Bookable image as the primary image" })
  @ApiParam({ name: "imageId", format: "uuid" })
  setPrimary(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ) {
    return this.bookableImages.setPrimary(request.user.id, bookableId, imageId);
  }

  @Patch(":bookableId/images/:imageId/replace")
  @ApiOperation({ summary: "Replace an existing Bookable image" })
  replace(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @Body() input: ReplaceBookableImageDto,
  ) {
    return this.bookableImages.replace(request.user.id, bookableId, imageId, input);
  }

  @Delete(":bookableId/images/:imageId")
  @ApiOperation({ summary: "Delete a Bookable image" })
  @ApiResponse({ status: 200, description: "Image deleted" })
  delete(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId", new ParseUUIDPipe()) bookableId: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ) {
    return this.bookableImages.delete(request.user.id, bookableId, imageId);
  }
}
