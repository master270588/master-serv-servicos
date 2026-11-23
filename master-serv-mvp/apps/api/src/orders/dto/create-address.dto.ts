import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateAddressDto {
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsString() @Matches(/^\d{5}-?\d{3}$/) postalCode!: string;
  @IsString() @MinLength(2) @MaxLength(160) street!: string;
  @IsString() @MinLength(1) @MaxLength(20) number!: string;
  @IsOptional() @IsString() @MaxLength(120) complement?: string;
  @IsString() @MinLength(2) @MaxLength(100) neighborhood!: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsIn(['ES']) stateCode: string = 'ES';
  @IsOptional() @IsString() @MaxLength(200) referenceNote?: string;
}
