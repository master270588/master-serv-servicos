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
              ? { provider: { create: { displayName: dto.displayName!.trim(), approvalStatus: 'pending' } } }
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
    const rotated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) throw new UnauthorizedException('Sessão inválida ou expirada.');
      return tx.appUser.findUniqueOrThrow({
        where: { id: session.userId },
        select: { id: true, email: true, phone: true, roles: { select: { role: { select: { code: true } } } } },
      });
    });
    const tokens = await this.issueTokens(rotated);
    return { ...tokens };
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
      return { ...updated, accountStatus: decision === 'approved' ? 'active' : 'blocked' };
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, status: true, roles: { select: { role: { select: { code: true } } } } },
    });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Conta indisponível.');
    return { id: user.id, email: user.email, phone: user.phone, roles: user.roles.map((item) => item.role.code) };
  }

  async logout(rawToken: string) {
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
