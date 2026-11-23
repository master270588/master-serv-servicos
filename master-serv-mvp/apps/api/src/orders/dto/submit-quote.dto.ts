import { IsInt, Max, Min } from 'class-validator';
export class SubmitQuoteDto {
  @IsInt() @Min(1) @Max(1000000000) amountCents!: number;
}
