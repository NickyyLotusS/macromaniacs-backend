import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import {
  MemberRole,
  ReactionType,
} from '../../integrations/database/entities/enums';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { FeedPost } from '../../integrations/database/entities/social/feed-post.entity';
import { GroupMember } from '../../integrations/database/entities/social/group-member.entity';
import { Group } from '../../integrations/database/entities/social/group.entity';
import { PostReaction } from '../../integrations/database/entities/social/post-reaction.entity';
import {
  paginationMeta,
  type PaginationQueryDto,
} from '../../shared/http/pagination.dto';
import { GamificationService } from '../gamification/gamification.service';
import type {
  CreateFeedPostDto,
  CreateGroupDto,
  FeedPostResponseDto,
  FeedResponseDto,
  GroupResponseDto,
  RankingEntryDto,
} from './dto/social.dto';

@Injectable()
export class SocialService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly members: Repository<GroupMember>,
    @InjectRepository(FeedPost)
    private readonly posts: Repository<FeedPost>,
    @InjectRepository(PostReaction)
    private readonly reactions: Repository<PostReaction>,
    private readonly gamification: GamificationService,
  ) {}

  async create(userId: string, dto: CreateGroupDto): Promise<GroupResponseDto> {
    const groupId = await this.dataSource.transaction(async (manager) => {
      const group = await manager.save(
        Group,
        manager.create(Group, {
          creatorId: userId,
          name: dto.name,
          description: dto.description?.trim() || null,
          inviteCode: await this.inviteCode(),
          isPrivate: dto.isPrivate,
        }),
      );
      await manager.save(
        GroupMember,
        manager.create(GroupMember, {
          groupId: group.id,
          userId,
          role: MemberRole.ADMIN,
          joinedAt: new Date(),
        }),
      );
      return group.id;
    });
    return this.get(userId, groupId);
  }

  async join(userId: string, inviteCode: string): Promise<GroupResponseDto> {
    const group = await this.groups.findOneBy({ inviteCode });
    if (!group) throw new NotFoundException('Group invitation not found');
    const existing = await this.members.findOneBy({
      groupId: group.id,
      userId,
    });
    if (!existing) {
      await this.members.save(
        this.members.create({
          groupId: group.id,
          userId,
          role: MemberRole.MEMBER,
          joinedAt: new Date(),
        }),
      );
    }
    return this.get(userId, group.id);
  }

  async list(userId: string): Promise<GroupResponseDto[]> {
    const memberships = await this.members.find({
      where: { userId },
      relations: { group: true },
      order: { joinedAt: 'DESC' },
    });
    return memberships.map((membership) =>
      this.toGroup(membership.group, membership.role),
    );
  }

  async get(userId: string, groupId: string): Promise<GroupResponseDto> {
    const membership = await this.requireMember(userId, groupId);
    const group = await this.groups.findOneByOrFail({ id: groupId });
    return this.toGroup(group, membership.role);
  }

  async leave(userId: string, groupId: string): Promise<void> {
    const membership = await this.requireMember(userId, groupId);
    const group = await this.groups.findOneByOrFail({ id: groupId });
    if (membership.role === MemberRole.ADMIN || group.creatorId === userId) {
      throw new ConflictException(
        'Group administrators must transfer ownership before leaving',
      );
    }
    await this.members.delete({ groupId, userId });
  }

  async changeRole(
    actorId: string,
    groupId: string,
    userId: string,
    role: MemberRole,
  ): Promise<GroupResponseDto> {
    await this.requireAdmin(actorId, groupId);
    const group = await this.groups.findOneByOrFail({ id: groupId });
    if (group.creatorId === userId && role !== MemberRole.ADMIN) {
      throw new ConflictException(
        'The group creator must remain an administrator',
      );
    }
    const member = await this.requireMember(userId, groupId);
    member.role = role;
    await this.members.save(member);
    return this.toGroup(group, role);
  }

  async createPost(
    userId: string,
    groupId: string,
    dto: CreateFeedPostDto,
  ): Promise<FeedPostResponseDto> {
    await this.requireMember(userId, groupId);
    if (dto.mealLogId) {
      const meal = await this.dataSource.getRepository(MealLog).findOneBy({
        id: dto.mealLogId,
        userId,
      });
      if (!meal) throw new NotFoundException('Meal not found');
    }
    const post = await this.posts.save(
      this.posts.create({
        groupId,
        userId,
        mealLogId: dto.mealLogId ?? null,
        content: dto.content?.trim() || null,
      }),
    );
    return this.getPost(userId, post.id);
  }

  async feed(
    userId: string,
    groupId: string,
    query: PaginationQueryDto,
  ): Promise<FeedResponseDto> {
    await this.requireMember(userId, groupId);
    const builder = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.reactions', 'reaction')
      .where('post.groupId = :groupId', { groupId })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return {
      items: items.map((post) => this.toPost(post, userId)),
      meta: paginationMeta(total, query),
    };
  }

  async ranking(userId: string, groupId: string): Promise<RankingEntryDto[]> {
    await this.requireMember(userId, groupId);
    const members = await this.members.find({
      where: { groupId },
      relations: { user: { stats: true } },
    });
    return members
      .sort(
        (left, right) =>
          (right.user.stats?.totalPoints ?? 0) -
            (left.user.stats?.totalPoints ?? 0) ||
          left.joinedAt.getTime() - right.joinedAt.getTime(),
      )
      .map((member, index) => ({
        position: index + 1,
        userId: member.userId,
        username: member.user.username,
        displayName: member.user.displayName,
        points: member.user.stats?.totalPoints ?? 0,
      }));
  }

  async react(
    userId: string,
    groupId: string,
    postId: string,
    reactionType: ReactionType,
  ): Promise<FeedPostResponseDto> {
    await this.requireMember(userId, groupId);
    const post = await this.posts.findOneBy({ id: postId, groupId });
    if (!post) throw new NotFoundException('Feed post not found');
    const existing = await this.reactions.findOneBy({ postId, userId });
    await this.reactions.save(
      existing
        ? Object.assign(existing, { reactionType })
        : this.reactions.create({ postId, userId, reactionType }),
    );
    if (post.userId !== userId) {
      await this.gamification.recordSocialReaction(userId);
    }
    return this.getPost(userId, postId);
  }

  async removeReaction(
    userId: string,
    groupId: string,
    postId: string,
  ): Promise<void> {
    await this.requireMember(userId, groupId);
    const post = await this.posts.findOneBy({ id: postId, groupId });
    if (!post) throw new NotFoundException('Feed post not found');
    await this.reactions.delete({ postId, userId });
  }

  private async getPost(
    viewerId: string,
    postId: string,
  ): Promise<FeedPostResponseDto> {
    const post = await this.posts.findOne({
      where: { id: postId },
      relations: { user: true, reactions: true },
    });
    if (!post) throw new NotFoundException('Feed post not found');
    await this.requireMember(viewerId, post.groupId);
    return this.toPost(post, viewerId);
  }

  private async requireMember(
    userId: string,
    groupId: string,
  ): Promise<GroupMember> {
    const member = await this.members.findOneBy({ userId, groupId });
    if (!member) throw new NotFoundException('Group not found');
    return member;
  }

  private async requireAdmin(
    userId: string,
    groupId: string,
  ): Promise<GroupMember> {
    const member = await this.requireMember(userId, groupId);
    if (member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Group administrator role required');
    }
    return member;
  }

  private async inviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = randomBytes(4).toString('hex').toUpperCase();
      if (!(await this.groups.existsBy({ inviteCode: value }))) return value;
    }
    throw new ConflictException('Could not allocate an invitation code');
  }

  private toGroup(group: Group, role: MemberRole): GroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isPrivate: group.isPrivate,
      role,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt.toISOString(),
    };
  }

  private toPost(post: FeedPost, viewerId: string): FeedPostResponseDto {
    const reactions = {
      [ReactionType.LIKE]: 0,
      [ReactionType.FIRE]: 0,
      [ReactionType.CLAP]: 0,
    };
    for (const reaction of post.reactions ?? []) {
      reactions[reaction.reactionType] += 1;
    }
    return {
      id: post.id,
      groupId: post.groupId,
      userId: post.userId,
      username: post.user.username,
      displayName: post.user.displayName,
      mealLogId: post.mealLogId,
      content: post.content,
      reactions,
      viewerReaction:
        post.reactions?.find((reaction) => reaction.userId === viewerId)
          ?.reactionType ?? null,
      createdAt: post.createdAt.toISOString(),
    };
  }
}
