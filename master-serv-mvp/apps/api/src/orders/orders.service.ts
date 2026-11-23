import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DispatchOrderDto } from './dto/dispatch-order.dto';
import { RespondDispatchDto } from './dto/respond-dispatch.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { DecideQuoteDto } from './dto/decide-quote.dto';
import { CreateAddressDto } from './dto/create-address.dto';

const ORDER_STATUSES = [
  'requested','dispatching','quoted','awaiting_customer_approval',
  'approved','in_progress','completed','cancelled','disputed',
];

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  listPublicCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
  }

  listPublicServiceAreas() {
    return this.prisma.serviceArea.findMany({
      where: { active: true },
      select: { city: true, stateCode: true, rolloutPhase: true },
      orderBy: { city: 'asc' },
    });
  }

  async createCustomerAddress(customerUserId: string, dto: CreateAddressDto) {
    const address = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerAddress.create({
        data: {
          customerUserId,
          label: dto.label?.trim() || null,
          postalCode: dto.postalCode.replace(/\D/g, ''),
          street: dto.street.trim(),
          number: dto.number.trim(),
          complement: dto.complement?.trim() || null,
          neighborhood: dto.neighborhood.trim(),
          city: dto.city.trim(),
          stateCode: dto.stateCode,
          referenceNote: dto.referenceNote?.trim() || null,
        },
        select: {
          id: true, label: true, postalCode: true, street: true, number: true,
          complement: true, neighborhood: true, city: true, stateCode: true, createdAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: customerUserId,
          action: 'customer_address.created',
          entityType: 'customer_address',
          entityId: created.id,
          metadata: { city: created.city, stateCode: created.stateCode },
        },
      });
      return created;
    });
    return address;
  }

  listCustomerAddresses(customerUserId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerUserId },
      select: {
        id: true, label: true, postalCode: true, street: true, number: true,
        complement: true, neighborhood: true, city: true, stateCode: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCustomerOrder(customerUserId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.customerAddress.findFirst({
        where: { id: dto.addressId, customerUserId },
      });
      if (!address) throw new NotFoundException('Endereço não encontrado para esta conta.');
      const category = await tx.serviceCategory.findFirst({
        where: { id: dto.categoryId, active: true }, select: { id: true },
      });
      if (!category) throw new BadRequestException('Categoria de serviço indisponível.');
      const area = await tx.serviceArea.findFirst({
        where: {
          city: { equals: address.city, mode: 'insensitive' },
          stateCode: address.stateCode, active: true,
        },
        select: { id: true },
      });
      if (!area) throw new BadRequestException('Ainda não atendemos este município.');

      const order = await tx.serviceOrder.create({
        data: {
          customerUserId, categoryId: category.id, customerAddressId: address.id,
          description: dto.description.trim(), city: address.city, stateCode: address.stateCode,
          status: 'requested',
        },
        select: {
          id: true, status: true, description: true, city: true, stateCode: true, createdAt: true,
          category: { select: { id: true, name: true } },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: customerUserId, action: 'order.created',
          entityType: 'service_order', entityId: order.id,
          metadata: { categoryId: category.id, city: address.city, stateCode: address.stateCode },
        },
      });
      return order;
    });
  }

  listCustomerOrders(customerUserId: string) {
    return this.prisma.serviceOrder.findMany({
      where: { customerUserId }, orderBy: { createdAt: 'desc' },
      select: {
        id: true, description: true, city: true, stateCode: true, status: true, createdAt: true, updatedAt: true,
        category: { select: { id: true, name: true } },
        quotes: {
          select: {
            id: true, amountCents: true, status: true, submittedAt: true,
            provider: { select: { displayName: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });
  }

  async getCustomerOrder(customerUserId: string, orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, customerUserId },
      select: {
        id: true, description: true, city: true, stateCode: true, status: true, createdAt: true, updatedAt: true,
        category: { select: { id: true, name: true } },
        customerAddress: {
          select: {
            label: true, postalCode: true, street: true, number: true, complement: true,
            neighborhood: true, city: true, stateCode: true,
          },
        },
        quotes: {
          select: {
            id: true, amountCents: true, status: true, submittedAt: true, customerDecidedAt: true,
            provider: { select: { displayName: true, bio: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Chamado não encontrado.');
    return order;
  }

  async listProviderDispatches(providerUserId: string) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { userId: providerUserId, approvalStatus: 'approved', user: { status: 'active' } },
      select: { userId: true },
    });
    if (!profile) throw new BadRequestException('Prestador ainda não aprovado.');
    return this.prisma.dispatchCandidate.findMany({
      where: {
        providerUserId, responseStatus: 'pending',
        batch: {
          status: 'open',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
      select: {
        batchId: true,
        batch: {
          select: {
            id: true, mode: true, expiresAt: true,
            order: {
              select: {
                id: true, description: true, city: true, stateCode: true, status: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { batch: { createdAt: 'desc' } },
    });
  }

  async respondToDispatch(providerUserId: string, batchId: string, dto: RespondDispatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.providerProfile.findFirst({
        where: { userId: providerUserId, approvalStatus: 'approved', user: { status: 'active' } },
        select: { userId: true },
      });
      if (!profile) throw new BadRequestException('Prestador ainda não aprovado.');
      const candidate = await tx.dispatchCandidate.findUnique({
        where: { batchId_providerUserId: { batchId, providerUserId } },
        include: { batch: { include: { order: true } } },
      });
      if (!candidate || candidate.responseStatus !== 'pending' || candidate.batch.status !== 'open') {
        throw new ConflictException('Este chamado não está mais disponível para resposta.');
      }
      if (candidate.batch.expiresAt && candidate.batch.expiresAt <= new Date()) {
        throw new ConflictException('O prazo para responder a este chamado terminou.');
      }

      const now = new Date();
      const changed = await tx.dispatchCandidate.updateMany({
        where: { batchId, providerUserId, responseStatus: 'pending' },
        data: { responseStatus: dto.decision, respondedAt: now },
      });
      if (changed.count !== 1) throw new ConflictException('A resposta já foi registrada.');

      if (dto.decision === 'accepted') {
        await tx.orderAssignment.create({
          data: { orderId: candidate.batch.orderId, providerUserId, status: 'accepted' },
        });
        if (candidate.batch.mode === 'individual') {
          await tx.dispatchCandidate.updateMany({
            where: { batchId, providerUserId: { not: providerUserId }, responseStatus: 'pending' },
            data: { responseStatus: 'expired', respondedAt: now },
          });
          await tx.dispatchBatch.update({ where: { id: batchId }, data: { status: 'closed' } });
        }
      }
      const pending = await tx.dispatchCandidate.count({ where: { batchId, responseStatus: 'pending' } });
      if (pending === 0) {
        await tx.dispatchBatch.updateMany({
          where: { id: batchId, status: 'open' }, data: { status: 'closed' },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: providerUserId,
          action: dto.decision === 'accepted' ? 'dispatch.accepted' : 'dispatch.declined',
          entityType: 'dispatch_batch', entityId: batchId,
          metadata: { orderId: candidate.batch.orderId, mode: candidate.batch.mode },
        },
      });
      return { success: true, decision: dto.decision };
    }).catch((error) => {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Este prestador já possui uma atribuição ativa para o chamado.');
      }
      throw error;
    });
  }

  async listProviderOrders(providerUserId: string) {
    const assignments = await this.prisma.orderAssignment.findMany({
      where: { providerUserId, status: { in: ['assigned', 'accepted'] } },
      orderBy: { assignedAt: 'desc' },
      select: {
        id: true, status: true, assignedAt: true,
        order: {
          select: {
            id: true, description: true, city: true, stateCode: true, status: true, createdAt: true,
            category: { select: { name: true } },
            customerAddress: {
              select: {
                label: true, postalCode: true, street: true, number: true, complement: true,
                neighborhood: true, city: true, stateCode: true,
              },
            },
            quotes: {
              where: { providerUserId },
              select: { id: true, amountCents: true, status: true, submittedAt: true },
            },
          },
        },
      },
    });
    return assignments.map((assignment) => ({
      ...assignment,
      order: {
        ...assignment.order,
        customerAddress: ['approved', 'in_progress', 'completed'].includes(assignment.order.status)
          ? assignment.order.customerAddress : null,
      },
    }));
  }

  async submitQuote(providerUserId: string, orderId: string, dto: SubmitQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.providerProfile.findFirst({
        where: { userId: providerUserId, approvalStatus: 'approved', user: { status: 'active' } },
        select: { userId: true },
      });
      if (!profile) throw new BadRequestException('Prestador ainda não aprovado.');
      const assignment = await tx.orderAssignment.findFirst({
        where: { orderId, providerUserId, status: { in: ['assigned', 'accepted'] } },
        select: { id: true },
      });
      if (!assignment) throw new NotFoundException('Chamado não atribuído a este prestador.');
      const quote = await tx.quote.create({
        data: { orderId, providerUserId, amountCents: BigInt(dto.amountCents), status: 'submitted' },
        select: { id: true, orderId: true, amountCents: true, status: true, submittedAt: true },
      });
      const changed = await tx.serviceOrder.updateMany({
        where: { id: orderId, status: { in: ['dispatching', 'quoted', 'awaiting_customer_approval'] } },
        data: { status: 'awaiting_customer_approval', updatedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Este chamado não está aceitando novos orçamentos.');
      await tx.auditEvent.create({
        data: {
          actorUserId: providerUserId, action: 'quote.submitted',
          entityType: 'service_order', entityId: orderId,
          metadata: { quoteId: quote.id, amountCents: dto.amountCents },
        },
      });
      return quote;
    }).catch((error) => {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Este prestador já enviou orçamento para este chamado.');
      }
      throw error;
    });
  }

  async decideQuote(customerUserId: string, orderId: string, quoteId: string, dto: DecideQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findFirst({
        where: { id: orderId, customerUserId }, select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException('Chamado não encontrado.');
      if (order.status !== 'awaiting_customer_approval') {
        throw new ConflictException('O chamado não está aguardando aprovação de orçamento.');
      }
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, orderId, status: 'submitted' },
        select: { id: true, providerUserId: true },
      });
      if (!quote) throw new NotFoundException('Orçamento não encontrado ou já decidido.');

      const now = new Date();
      if (dto.decision === 'approved') {
        const orderChanged = await tx.serviceOrder.updateMany({
          where: { id: orderId, customerUserId, status: 'awaiting_customer_approval' },
          data: { status: 'approved', updatedAt: now },
        });
        if (orderChanged.count !== 1) throw new ConflictException('O chamado já recebeu outra decisão.');
        const quoteChanged = await tx.quote.updateMany({
          where: { id: quoteId, orderId, status: 'submitted' },
          data: { status: 'approved', customerDecidedAt: now },
        });
        if (quoteChanged.count !== 1) throw new ConflictException('O orçamento já recebeu outra decisão.');
        await tx.quote.updateMany({
          where: { orderId, id: { not: quoteId }, status: 'submitted' },
          data: { status: 'rejected', customerDecidedAt: now },
        });
        await tx.orderAssignment.updateMany({
          where: {
            orderId, providerUserId: { not: quote.providerUserId },
            status: { in: ['assigned', 'accepted'] },
          },
          data: { status: 'released', endedAt: now },
        });
      } else {
        const quoteChanged = await tx.quote.updateMany({
          where: { id: quoteId, orderId, status: 'submitted' },
          data: { status: 'rejected', customerDecidedAt: now },
        });
        if (quoteChanged.count !== 1) throw new ConflictException('O orçamento já recebeu outra decisão.');
        await tx.orderAssignment.updateMany({
          where: { orderId, providerUserId: quote.providerUserId, status: { in: ['assigned', 'accepted'] } },
          data: { status: 'released', endedAt: now },
        });
        const remaining = await tx.quote.count({ where: { orderId, status: 'submitted' } });
        const orderChanged = await tx.serviceOrder.updateMany({
          where: { id: orderId, customerUserId, status: 'awaiting_customer_approval' },
          data: { status: remaining > 0 ? 'awaiting_customer_approval' : 'quoted', updatedAt: now },
        });
        if (orderChanged.count !== 1) throw new ConflictException('O chamado já recebeu outra decisão.');
      }

      await tx.auditEvent.create({
        data: {
          actorUserId: customerUserId,
          action: dto.decision === 'approved' ? 'quote.approved' : 'quote.rejected',
          entityType: 'service_order', entityId: orderId,
          metadata: { quoteId, providerUserId: quote.providerUserId },
        },
      });
      return { success: true, decision: dto.decision };
    });
  }

  async startOrder(providerUserId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.orderAssignment.findFirst({
        where: { orderId, providerUserId, status: 'accepted' }, select: { id: true },
      });
      if (!assignment) throw new NotFoundException('Atribuição ativa não encontrada.');
      const approvedQuote = await tx.quote.findFirst({
        where: { orderId, providerUserId, status: 'approved' }, select: { id: true },
      });
      if (!approvedQuote) throw new ConflictException('O cliente precisa aprovar o orçamento antes do início.');
      const changed = await tx.serviceOrder.updateMany({
        where: { id: orderId, status: 'approved' },
        data: { status: 'in_progress', updatedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('O chamado não está liberado para início.');
      await tx.auditEvent.create({
        data: {
          actorUserId: providerUserId, action: 'order.started',
          entityType: 'service_order', entityId: orderId,
          metadata: { quoteId: approvedQuote.id },
        },
      });
      return { success: true, status: 'in_progress' };
    });
  }

  async completeOrder(providerUserId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.orderAssignment.findFirst({
        where: { orderId, providerUserId, status: 'accepted' }, select: { id: true },
      });
      if (!assignment) throw new NotFoundException('Atribuição ativa não encontrada.');
      const changed = await tx.serviceOrder.updateMany({
        where: { id: orderId, status: 'in_progress' },
        data: { status: 'completed', updatedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('O chamado não está em execução.');
      await tx.orderAssignment.update({
        where: { id: assignment.id }, data: { status: 'completed', endedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { actorUserId: providerUserId, action: 'order.completed', entityType: 'service_order', entityId: orderId },
      });
      return { success: true, status: 'completed' };
    });
  }

  async listAdminOrders(status?: string) {
    if (status && !ORDER_STATUSES.includes(status)) throw new BadRequestException('Filtro de situação inválido.');
    return this.prisma.serviceOrder.findMany({
      where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, take: 100,
      select: {
        id: true, customerUserId: true, description: true, city: true, stateCode: true, status: true, createdAt: true,
        category: { select: { name: true } },
        quotes: { select: { id: true, amountCents: true, status: true, providerUserId: true } },
        assignments: { select: { providerUserId: true, status: true, assignedAt: true } },
      },
    });
  }

  async dispatchOrder(orderId: string, adminUserId: string, dto: DispatchOrderDto) {
    if (dto.mode === 'individual' && dto.providerUserIds.length !== 1) {
      throw new BadRequestException('Distribuição individual exige exatamente um prestador por rodada.');
    }
    if (dto.mode === 'simultaneous' && dto.providerUserIds.length < 2) {
      throw new BadRequestException('Distribuição simultânea exige pelo menos dois prestadores.');
    }
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findUnique({
        where: { id: orderId }, select: { id: true, categoryId: true, status: true },
      });
      if (!order) throw new NotFoundException('Chamado não encontrado.');
      if (!['requested', 'dispatching', 'quoted'].includes(order.status)) {
        throw new ConflictException('A situação atual do chamado não permite distribuição.');
      }
      const openBatch = await tx.dispatchBatch.findFirst({
        where: { orderId, status: 'open' }, select: { id: true },
      });
      if (openBatch) throw new ConflictException('Já existe uma rodada de distribuição aberta.');
      const eligible = await tx.providerProfile.findMany({
        where: {
          userId: { in: dto.providerUserIds }, approvalStatus: 'approved',
          user: { status: 'active' }, services: { some: { categoryId: order.categoryId } },
        },
        select: { userId: true },
      });
      if (eligible.length !== dto.providerUserIds.length) {
        throw new BadRequestException('Todos os prestadores devem estar aprovados, ativos e habilitados na categoria.');
      }
      const alreadyAssigned = await tx.orderAssignment.findMany({
        where: {
          orderId,
          providerUserId: { in: dto.providerUserIds },
          status: { in: ['assigned', 'accepted'] },
        },
        select: { providerUserId: true },
      });
      if (alreadyAssigned.length > 0) {
        throw new ConflictException('Remova ou encerre as atribuições ativas antes de distribuir novamente aos mesmos prestadores.');
      }
      const providersWithPreviousQuotes = await tx.quote.findMany({
        where: { orderId, providerUserId: { in: dto.providerUserIds } },
        select: { providerUserId: true },
      });
      if (providersWithPreviousQuotes.length > 0) {
        throw new BadRequestException('Não redistribua o chamado a prestadores que já enviaram orçamento; selecione outros prestadores.');
      }
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const batch = await tx.dispatchBatch.create({
        data: {
          orderId, mode: dto.mode, status: 'open', expiresAt,
          candidates: { create: dto.providerUserIds.map((providerUserId) => ({ providerUserId })) },
        },
        select: { id: true, orderId: true, mode: true, status: true, expiresAt: true },
      });
      await tx.serviceOrder.update({
        where: { id: orderId }, data: { status: 'dispatching', updatedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId, action: 'dispatch.created',
          entityType: 'dispatch_batch', entityId: batch.id,
          metadata: { orderId, mode: dto.mode, candidateCount: dto.providerUserIds.length },
        },
      });
      return batch;
    });
  }
}
