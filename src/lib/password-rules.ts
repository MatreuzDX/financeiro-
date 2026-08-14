/**
 * Regras da palavra-passe, num módulo NEUTRO.
 *
 * O número vivia em `server/auth/password.ts` e estava copiado à mão em três
 * formulários (`minLength={12}` e o texto de ajuda). Ao baixar o mínimo no
 * servidor, os formulários continuariam a recusar pelo browser — a pessoa
 * via um campo bloqueado sem explicação nenhuma.
 *
 * Mesma família de `lib/auth-cookie.ts` e `lib/theme.ts`: o que atravessa a
 * fronteira servidor/cliente vive num módulo sem dependências.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Escolha uma de que se lembre — não há regras de símbolos obrigatórios.`;
