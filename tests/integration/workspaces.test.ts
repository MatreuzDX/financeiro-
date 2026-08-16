/**
 * Espaços partilhados.
 *
 * A garantia que interessa não é o convite funcionar — é ninguém conseguir
 * entrar num espaço a que não foi convidado, e um espaço nunca ficar sem
 * dono. É isso que estes testes fixam.
 *
 * Precisa de `npm run db:start` a correr.
 */

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import {
  aceitarConvite,
  changeMemberRole,
  createWorkspace,
  inviteMember,
  lerConvite,
  listMembers,
  listMyWorkspaces,
  removeMember,
  switchWorkspace,
} from "@/server/workspaces";
import { createUserWithWorkspace } from "@/server/onboarding";

const criados: string[] = [];

async function pessoa(rotulo: string): Promise<SessionUser> {
  const sufixo = randomUUID().slice(0, 8);
  const user = await createUserWithWorkspace({
    name: `${rotulo} Teste`,
    email: `ws-${sufixo}@exemplo.local`,
    password: "uma-Palavra-Passe-9!",
    workspaceName: `Espaço de ${rotulo} ${sufixo}`,
  });
  criados.push(user.workspaceId);

  return {
    sessionId: `s-${sufixo}`,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: "OWNER",
    mustChangePassword: false,
    theme: "SYSTEM",
    workspaceId: user.workspaceId,
    workspaceName: `Espaço de ${rotulo}`,
    currency: "EUR",
    timezone: "Europe/Lisbon",
  };
}

function tokenDoLink(link: string) {
  return link.split("/convite/")[1];
}

afterAll(async () => {
  for (const id of criados) {
    await prisma.workspace.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("espaços partilhados", () => {
  it("um convite aceite dá acesso ao espaço", async () => {
    const ana = await pessoa("Ana");
    const beto = await pessoa("Beto");

    const { link } = await inviteMember(
      ana,
      { email: beto.email, role: "MEMBER" },
      "https://exemplo.pt",
    );

    const antes = await listMyWorkspaces(beto.userId);
    expect(antes.map((w) => w.id)).not.toContain(ana.workspaceId);

    await aceitarConvite(tokenDoLink(link), beto.userId);

    const depois = await listMyWorkspaces(beto.userId);
    expect(depois.map((w) => w.id)).toContain(ana.workspaceId);
    expect(depois.find((w) => w.id === ana.workspaceId)?.role).toBe("MEMBER");
  });

  it("o convite só serve uma vez", async () => {
    const ana = await pessoa("Ana2");
    const beto = await pessoa("Beto2");

    const { link } = await inviteMember(
      ana,
      { email: beto.email, role: "VIEWER" },
      "https://exemplo.pt",
    );
    const token = tokenDoLink(link);

    await aceitarConvite(token, beto.userId);
    expect(await lerConvite(token)).toBeNull();
    await expect(aceitarConvite(token, beto.userId)).rejects.toThrow();
  });

  it("um token inventado não abre nada", async () => {
    expect(await lerConvite("token-que-nao-existe")).toBeNull();
  });

  it("NÃO se pode trocar para um espaço de que não se é membro", async () => {
    const ana = await pessoa("Ana3");
    const beto = await pessoa("Beto3");

    await expect(switchWorkspace(beto, ana.workspaceId)).rejects.toThrow(
      /não pertence/i,
    );

    // E o espaço ativo dele não mudou.
    const atual = await prisma.user.findUniqueOrThrow({
      where: { id: beto.userId },
      select: { activeWorkspaceId: true },
    });
    expect(atual.activeWorkspaceId).toBe(beto.workspaceId);
  });

  it("não deixa o espaço ficar sem proprietário", async () => {
    const ana = await pessoa("Ana4");
    const { membros } = await listMembers(ana.workspaceId);
    const dona = membros[0];

    await expect(removeMember(ana, dona.id)).rejects.toThrow(/proprietário/i);
    await expect(changeMemberRole(ana, dona.id, "VIEWER")).rejects.toThrow(
      /proprietário/i,
    );
  });

  it("convidar a mesma pessoa outra vez substitui o convite anterior", async () => {
    const ana = await pessoa("Ana5");
    const beto = await pessoa("Beto5");

    const primeiro = await inviteMember(
      ana,
      { email: beto.email, role: "VIEWER" },
      "https://exemplo.pt",
    );
    const segundo = await inviteMember(
      ana,
      { email: beto.email, role: "ADMIN" },
      "https://exemplo.pt",
    );

    // O primeiro deixa de servir; fica só o mais recente.
    expect(await lerConvite(tokenDoLink(primeiro.link))).toBeNull();
    expect(await lerConvite(tokenDoLink(segundo.link))).not.toBeNull();

    const { convites } = await listMembers(ana.workspaceId);
    expect(convites).toHaveLength(1);
    expect(convites[0].role).toBe("ADMIN");
  });

  it("recusa convidar quem já está no espaço", async () => {
    const ana = await pessoa("Ana6");
    await expect(
      inviteMember(ana, { email: ana.email, role: "MEMBER" }, "https://exemplo.pt"),
    ).rejects.toThrow(/já está/i);
  });

  it("uma pessoa pode ter vários espaços", async () => {
    const ana = await pessoa("Ana7");
    const casa = await createWorkspace(ana, { name: `Casa ${randomUUID().slice(0, 6)}` });
    criados.push(casa.id);

    const espacos = await listMyWorkspaces(ana.userId);
    expect(espacos.length).toBeGreaterThanOrEqual(2);
    // Um espaço novo nasce com as categorias base, senão fica inutilizável.
    expect(
      await prisma.category.count({ where: { workspaceId: casa.id } }),
    ).toBeGreaterThan(20);
  });
});
