import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(user: { id: string; email: string | null; phone: string | null; roles: { role: { code: string } }[] }) {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException('Autenticação não configurada no servidor.');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      roles: user.roles.map((item) => item.role.code),
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.authSession.create({
      data: { userId: user.id, refreshTokenHash: this.hashToken(refreshToken), expiresAt },
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Informe e-mail ou telefone.');
    }
    if (dto.accountType === 'provider' && !dto.displayName?.trim()) {
      throw new BadRequestException('Informe o nome para o perfil profissional.');
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        let providerCategoryIds: string[] = [];
        if (dto.accountType === 'provider') {
          if (!dto.serviceCategoryIds?.length) {
            throw new BadRequestException('Selecione ao menos uma categoria de serviço.');
          }
          const categories = await tx.serviceCategory.findMany({
            where: { id: { in: dto.serviceCategoryIds }, active: true },
            select: { id: true },
          });
          if (categories.length !== dto.serviceCategoryIds.length) {
            throw new BadRequestException('Uma ou mais categorias selecionadas não estão disponíveis.');
          }
          providerCategoryIds = categories.map((category) => category.id);
        }
        const role = await tx.role.findUnique({ where: { code: dto.accountType } });
        if (!role) throw new InternalServerErrorException('Papel de usuário não configurado.');
        const created = await tx.appUser.create({
          data: {
            email: dto.email?.trim().toLowerCase(),
            phone: dto.phone,
            passwordHash,
            status: dto.accountType === 'customer' ? 'active' : 'pending',
            roles: { create: { roleId: role.id } },
            ...(dto.accountType === 'provider'
              ? { provider: { create: {
                  displayName: dto.displayName!.trim(),
                  approvalStatus: 'pending',
                  services: { create: providerCategoryIds.map((categoryId) => ({ categoryId })) },
                } } }
              : {}),
          },
          select: { id: true, email: true, phone: true, roles: { select: { role: { select: { code: true } } } } },
        });
        return created;
      });
      const accountStatus = dto.accountType === 'provider' ? 'pending_approval' : 'active';
      if (dto.accountType === 'provider') {
        return {
          user: { id: user.id, email: user.email, phone: user.phone, roles: user.roles.map((r) => r.role.code) },
          accountStatus,
          message: 'Cadastro recebido. O acesso será liberado após aprovação administrativa.',
        };
      }
      const tokens = await this.issueTokens(user);
      return {
        user: { id: user.id, email: user.email, phone: user.phone, roles: user.roles.map((r) => r.role.code) },
        ...tokens,
        accountStatus,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Não foi possível concluir o cadastro com os dados informados.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.appUser.findFirst({
      where: identifier.includes('@')
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
      select: { id: true, email: true, phone: true, passwordHash: true, status: true, roles: { select: { role: { select: { code: true } } } } },
    });
    if (!user || user.status !== 'active' || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciais inválidas ou conta indisponível.');
    }
    const tokens = await this.issueTokens(user);
    return {
      user: { id: user.id, email: user.email, phone: user.phone, roles: user.roles.map((r) => r.role.code) },
      ...tokens,
    };
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'active') {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException('Autenticação não configurada no servidor.');
    }

    // Prepare a replacement session atomically using the account's current status and roles.
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    let accessToken = '';

    await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.appUser.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          status: true,
          roles: { select: { role: { select: { code: true } } } },
        },
      });
      if (!currentUser || currentUser.status !== 'active') {
        throw new UnauthorizedException('Sessão inválida ou expirada.');
      }

      accessToken = await this.jwt.signAsync({
        sub: currentUser.id,
        roles: currentUser.roles.map((item) => item.role.code),
      });

      const result = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new UnauthorizedException('Sessão inválida ou expirada.');
      }

      await tx.authSession.create({
        data: {
          userId: currentUser.id,
          refreshTokenHash,
          expiresAt,
        },
      });
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }

  async listPendingProviders() {
    return this.prisma.providerProfile.findMany({
      where: { approvalStatus: { in: ['pending', 'under_review'] } },
      select: {
        userId: true,
        displayName: true,
        approvalStatus: true,
        createdAt: true,
        user: { select: { email: true, phone: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewProvider(providerUserId: string, decision: 'approved' | 'rejected', reviewerUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.providerProfile.findUnique({ where: { userId: providerUserId } });
      if (!profile) throw new BadRequestException('Prestador não encontrado.');
      if (profile.approvalStatus === 'blocked') throw new BadRequestException('Prestador bloqueado não pode ser aprovado por este fluxo.');
      const updated = await tx.providerProfile.update({
        where: { userId: providerUserId },
        data: { approvalStatus: decision },
        select: { userId: true, displayName: true, approvalStatus: true },
      });
      await tx.appUser.update({
        where: { id: providerUserId },
        data: { status: decision === 'approved' ? 'active' : 'blocked' },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewerUserId,
          action: decision === 'approved' ? 'provider.approved' : 'provider.rejected',
          entityType: 'provider_profile',
          entityId: providerUserId,
          metadata: { previousApprovalStatus: profile.approvalStatus, newApprovalStatus: decision },
        },
      });
      return { ...updated, accountStatus: decision === 'approved' ? 'active' : 'blocked' };
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        roles: { select: { role: { select: { code: true } } } },
        provider: {
          select: {
            displayName: true,
            approvalStatus: true,
            services: { select: { category: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Conta indisponível.');
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: user.roles.map((item) => item.role.code),
      provider: user.provider ? {
        displayName: user.provider.displayName,
        approvalStatus: user.provider.approvalStatus,
        services: user.provider.services.map((item) => item.category),
      } : null,
    };
  }

  async logout(rawToken: string) {
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
