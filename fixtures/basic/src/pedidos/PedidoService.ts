import { Pedido } from "./Pedido";

export class PedidoService {
  criarPedido(): Pedido {
    const p = new Pedido(1);
    p.calcularTotal();
    return p;
  }
}
