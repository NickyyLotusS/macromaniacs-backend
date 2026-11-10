import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../shared/http/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import {
  CreateFeedPostDto,
  CreateGroupDto,
  FeedPostResponseDto,
  FeedResponseDto,
  GroupResponseDto,
  JoinGroupDto,
  RankingEntryDto,
  ReactToPostDto,
  UpdateMemberRoleDto,
} from './dto/social.dto';
import { SocialService } from './social.service';

@ApiTags('social')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'groups', version: '1' })
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @Post()
  @ApiOperation({ summary: 'Criar grupo e associação administrativa atômica' })
  @ApiCreatedResponse({ type: GroupResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.service.create(user.userId, dto);
  }

  @Get()
  @ApiOkResponse({ type: [GroupResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<GroupResponseDto[]> {
    return this.service.list(user.userId);
  }

  @Post('join')
  @ApiCreatedResponse({ type: GroupResponseDto })
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: JoinGroupDto,
  ): Promise<GroupResponseDto> {
    return this.service.join(user.userId, dto.inviteCode);
  }

  @Get(':groupId')
  @ApiOkResponse({ type: GroupResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ): Promise<GroupResponseDto> {
    return this.service.get(user.userId, groupId);
  }

  @Delete(':groupId/members/me')
  @HttpCode(204)
  @ApiNoContentResponse()
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ): Promise<void> {
    return this.service.leave(user.userId, groupId);
  }

  @Patch(':groupId/members/:userId')
  @ApiOkResponse({ type: GroupResponseDto })
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<GroupResponseDto> {
    return this.service.changeRole(actor.userId, groupId, userId, dto.role);
  }

  @Post(':groupId/feed')
  @ApiCreatedResponse({ type: FeedPostResponseDto })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() dto: CreateFeedPostDto,
  ): Promise<FeedPostResponseDto> {
    return this.service.createPost(user.userId, groupId, dto);
  }

  @Get(':groupId/feed')
  @ApiOkResponse({ type: FeedResponseDto })
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<FeedResponseDto> {
    return this.service.feed(user.userId, groupId, query);
  }

  @Get(':groupId/ranking')
  @ApiOkResponse({ type: [RankingEntryDto] })
  ranking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ): Promise<RankingEntryDto[]> {
    return this.service.ranking(user.userId, groupId);
  }

  @Put(':groupId/feed/:postId/reaction')
  @ApiOkResponse({ type: FeedPostResponseDto })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: ReactToPostDto,
  ): Promise<FeedPostResponseDto> {
    return this.service.react(user.userId, groupId, postId, dto.reactionType);
  }

  @Delete(':groupId/feed/:postId/reaction')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('postId', new ParseUUIDPipe()) postId: string,
  ): Promise<void> {
    return this.service.removeReaction(user.userId, groupId, postId);
  }
}
