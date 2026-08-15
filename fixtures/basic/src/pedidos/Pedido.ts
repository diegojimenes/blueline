export class Pedido {
  constructor(public id: number) {}

  calcularTotal(): number {
    return this.id * 10;
  }
}
