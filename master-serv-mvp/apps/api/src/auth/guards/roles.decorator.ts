import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES_KEY = 'master_serv_required_roles';
export const Roles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
