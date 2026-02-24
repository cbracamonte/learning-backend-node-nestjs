export class Transaction {
  constructor(
    public readonly id: number,
    public readonly amount: number,
    public readonly timestamp: number,
    public readonly hash?: string,
  ) {}

  isValid(): boolean {
    return this.amount > 10;
  }
}
