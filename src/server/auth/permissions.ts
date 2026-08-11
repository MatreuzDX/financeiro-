/**
 * Quem pode fazer o quê. Um ficheiro, uma matriz, um teste que a percorre
 * toda. Se estiver espalhado por `if`s pelo código, mais tarde ou mais cedo
 * há um caminho que ninguém verificou.
 */

import type { Role } from "@prisma/client";

export const ACTIONS = [
  "data:read", // ver movimentos, contas, relatórios
  "data:write", // criar e editar movimentos, contas, categorias, veículos
  "data:delete", // apagar movimentos
  "settings:write", // preferências do workspace
  "admin:access", // área de administração
  "admin:users", // gerir utilizadores
  "workspace:delete", // apagar tudo
] as const;

export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<Role, readonly Action[]> = {
  OWNER: [
    "data:read",
    "data:write",
    "data:delete",
    "settings:write",
    "admin:access",
    "admin:users",
    "workspace:delete",
  ],
  ADMIN: [
    "data:read",
    "data:write",
    "data:delete",
    "settings:write",
    "admin:access",
    "admin:users",
  ],
  MEMBER: ["data:read", "data:write", "data:delete"],
  VIEWER: ["data:read"],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  VIEWER: "Só leitura",
};
