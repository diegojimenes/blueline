import { AuthService } from "../auth/AuthService";
import { PedidoService } from "../pedidos/PedidoService";

export class Gateway {
  start(): void {
    const auth = new AuthService();
    auth.login("admin");
    const pedidos = new PedidoService();
    pedidos.criarPedido();
  }
}
