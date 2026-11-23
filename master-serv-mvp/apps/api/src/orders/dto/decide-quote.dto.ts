import { IsIn } from 'class-validator';
export class DecideQuoteDto {
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
}
