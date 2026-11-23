import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
export class CreateOrderDto {
  @IsUUID() categoryId!: string;
  @IsUUID() addressId!: string;
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
}
