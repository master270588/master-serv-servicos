import { IsIn } from 'class-validator';
export class RespondDispatchDto {
  @IsIn(['accepted', 'declined']) decision!: 'accepted' | 'declined';
}
