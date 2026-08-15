export class Calc {
  process(): number {
    const double = (x: number): number => x * 2;
    const sum = (a: number, b: number): number => a + b;
    return sum(double(1), 2);
  }
}
