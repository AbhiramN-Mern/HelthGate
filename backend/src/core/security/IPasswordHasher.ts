export interface IPasswordHasher {
  hash(plain: string, saltRounds?: number): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}
