// Gerado por scripts/generate-demo.ts (pnpm demo:graph). Não edite à mão.
import type { SerializedGraph } from "../../core";

export const demoGraph: SerializedGraph = {
  "projectRoot": "demo/basic",
  "revision": 0,
  "nodes": [
    {
      "id": "class:src/auth/AuthService.ts:AuthService",
      "kind": "class",
      "name": "AuthService",
      "file": "src/auth/AuthService.ts",
      "startLine": 1
    },
    {
      "id": "class:src/gateway/Gateway.ts:Gateway",
      "kind": "class",
      "name": "Gateway",
      "file": "src/gateway/Gateway.ts",
      "startLine": 4
    },
    {
      "id": "class:src/pedidos/Pedido.ts:Pedido",
      "kind": "class",
      "name": "Pedido",
      "file": "src/pedidos/Pedido.ts",
      "startLine": 1
    },
    {
      "id": "class:src/pedidos/PedidoService.ts:PedidoService",
      "kind": "class",
      "name": "PedidoService",
      "file": "src/pedidos/PedidoService.ts",
      "startLine": 3
    },
    {
      "id": "method:src/auth/AuthService.ts:class:src/auth/AuthService.ts:AuthService:login",
      "kind": "method",
      "name": "login",
      "file": "src/auth/AuthService.ts",
      "startLine": 2,
      "owner": "class:src/auth/AuthService.ts:AuthService"
    },
    {
      "id": "method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start",
      "kind": "method",
      "name": "start",
      "file": "src/gateway/Gateway.ts",
      "startLine": 5,
      "owner": "class:src/gateway/Gateway.ts:Gateway"
    },
    {
      "id": "method:src/pedidos/Pedido.ts:class:src/pedidos/Pedido.ts:Pedido:calcularTotal",
      "kind": "method",
      "name": "calcularTotal",
      "file": "src/pedidos/Pedido.ts",
      "startLine": 4,
      "owner": "class:src/pedidos/Pedido.ts:Pedido"
    },
    {
      "id": "method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      "kind": "method",
      "name": "criarPedido",
      "file": "src/pedidos/PedidoService.ts",
      "startLine": 4,
      "owner": "class:src/pedidos/PedidoService.ts:PedidoService"
    },
    {
      "id": "module:auth",
      "kind": "module",
      "name": "auth",
      "path": "auth"
    },
    {
      "id": "module:gateway",
      "kind": "module",
      "name": "gateway",
      "path": "gateway"
    },
    {
      "id": "module:pedidos",
      "kind": "module",
      "name": "pedidos",
      "path": "pedidos"
    },
    {
      "id": "project",
      "kind": "project",
      "name": "basic"
    }
  ],
  "edges": [
    {
      "id": "call:method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start:method:src/auth/AuthService.ts:class:src/auth/AuthService.ts:AuthService:login",
      "type": "call",
      "from": "method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start",
      "to": "method:src/auth/AuthService.ts:class:src/auth/AuthService.ts:AuthService:login",
      "meta": {
        "line": 7
      }
    },
    {
      "id": "call:method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start:method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      "type": "call",
      "from": "method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start",
      "to": "method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      "meta": {
        "line": 9
      }
    },
    {
      "id": "call:method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido:method:src/pedidos/Pedido.ts:class:src/pedidos/Pedido.ts:Pedido:calcularTotal",
      "type": "call",
      "from": "method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      "to": "method:src/pedidos/Pedido.ts:class:src/pedidos/Pedido.ts:Pedido:calcularTotal",
      "meta": {
        "line": 6
      }
    },
    {
      "id": "import:class:src/gateway/Gateway.ts:Gateway:class:src/auth/AuthService.ts:AuthService",
      "type": "import",
      "from": "class:src/gateway/Gateway.ts:Gateway",
      "to": "class:src/auth/AuthService.ts:AuthService",
      "meta": {
        "symbol": "AuthService"
      }
    },
    {
      "id": "import:class:src/gateway/Gateway.ts:Gateway:class:src/pedidos/PedidoService.ts:PedidoService",
      "type": "import",
      "from": "class:src/gateway/Gateway.ts:Gateway",
      "to": "class:src/pedidos/PedidoService.ts:PedidoService",
      "meta": {
        "symbol": "PedidoService"
      }
    },
    {
      "id": "import:class:src/pedidos/PedidoService.ts:PedidoService:class:src/pedidos/Pedido.ts:Pedido",
      "type": "import",
      "from": "class:src/pedidos/PedidoService.ts:PedidoService",
      "to": "class:src/pedidos/Pedido.ts:Pedido",
      "meta": {
        "symbol": "Pedido"
      }
    },
    {
      "id": "member:class:src/auth/AuthService.ts:AuthService:method:src/auth/AuthService.ts:class:src/auth/AuthService.ts:AuthService:login",
      "type": "member",
      "from": "class:src/auth/AuthService.ts:AuthService",
      "to": "method:src/auth/AuthService.ts:class:src/auth/AuthService.ts:AuthService:login"
    },
    {
      "id": "member:class:src/gateway/Gateway.ts:Gateway:method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start",
      "type": "member",
      "from": "class:src/gateway/Gateway.ts:Gateway",
      "to": "method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start"
    },
    {
      "id": "member:class:src/pedidos/Pedido.ts:Pedido:method:src/pedidos/Pedido.ts:class:src/pedidos/Pedido.ts:Pedido:calcularTotal",
      "type": "member",
      "from": "class:src/pedidos/Pedido.ts:Pedido",
      "to": "method:src/pedidos/Pedido.ts:class:src/pedidos/Pedido.ts:Pedido:calcularTotal"
    },
    {
      "id": "member:class:src/pedidos/PedidoService.ts:PedidoService:method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      "type": "member",
      "from": "class:src/pedidos/PedidoService.ts:PedidoService",
      "to": "method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido"
    }
  ],
  "moduleEdges": [
    {
      "id": "moduleEdge:module:gateway:module:auth",
      "type": "moduleEdge",
      "from": "module:gateway",
      "to": "module:auth",
      "meta": {
        "weight": 2
      }
    },
    {
      "id": "moduleEdge:module:gateway:module:pedidos",
      "type": "moduleEdge",
      "from": "module:gateway",
      "to": "module:pedidos",
      "meta": {
        "weight": 2
      }
    }
  ]
};

export const demoSources: Record<string, string> = {
  "src/auth/AuthService.ts": "export class AuthService {\n  login(user: string): string {\n    return `token:${user}`;\n  }\n}\n",
  "src/gateway/Gateway.ts": "import { AuthService } from \"../auth/AuthService\";\nimport { PedidoService } from \"../pedidos/PedidoService\";\n\nexport class Gateway {\n  start(): void {\n    const auth = new AuthService();\n    auth.login(\"admin\");\n    const pedidos = new PedidoService();\n    pedidos.criarPedido();\n  }\n}\n",
  "src/pedidos/Pedido.ts": "export class Pedido {\n  constructor(public id: number) {}\n\n  calcularTotal(): number {\n    return this.id * 10;\n  }\n}\n",
  "src/pedidos/PedidoService.ts": "import { Pedido } from \"./Pedido\";\n\nexport class PedidoService {\n  criarPedido(): Pedido {\n    const p = new Pedido(1);\n    p.calcularTotal();\n    return p;\n  }\n}\n"
};
