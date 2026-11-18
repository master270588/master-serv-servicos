import { IsEmail, IsIn, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsIn(['customer', 'provider'])
  accountType!: 'customer' | 'provider';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}
