/**
 * Nome do cookie de sessão, num módulo NEUTRO.
 *
 * PORQUÊ SEPARADO (isto rebentaria em produção): o `proxy.ts` corre no
 * **edge**, onde não existe `pg`, nem sistema de ficheiros, nem `server-only`.
 * Importava esta constante de `server/auth/session.ts`, que importa o Prisma
 * — e arrastava a base de dados inteira para dentro do middleware.
 *
 * Localmente não dava erro (em desenvolvimento o middleware corre num
 * ambiente Node), por isso o `npm run build` passava na mesma. Só se via na
 * Vercel.
 *
 * Mesma família dos casos de `lib/theme.ts` e `lib/navigation.ts`: o que é
 * partilhado entre fronteiras vive num módulo sem dependências.
 */

export const SESSION_COOKIE = "fin_session";
