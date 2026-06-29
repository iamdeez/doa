import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Prisma.TransactionClient;
interface TxContext {
  client: TxClient;
  afterCommit: Array<() => void | Promise<void>>;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly als = new AsyncLocalStorage<TxContext>();

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** ALS 활성 시 트랜잭션 클라이언트, 비활성 시 루트 클라이언트 반환 */
  get tx(): TxClient {
    return this.als.getStore()?.client ?? (this as unknown as TxClient);
  }

  /**
   * 콜백을 트랜잭션 커밋 이후에 실행한다.
   * ALS 비활성(트랜잭션 외부) 시 즉시 실행한다.
   */
  async onAfterCommit(cb: () => void | Promise<void>): Promise<void> {
    const ctx = this.als.getStore();
    if (ctx) {
      ctx.afterCommit.push(cb);
    } else {
      await cb();
    }
  }

  /**
   * 이미 트랜잭션 내부라면 fn()을 재사용.
   * 외부라면 $transaction을 열고 ALS에 클라이언트를 전파.
   * 커밋 후 afterCommit 훅을 best-effort 순차 실행.
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) {
      return fn();
    }

    const hooks: TxContext['afterCommit'] = [];
    const result = await this.$transaction(async (client) =>
      this.als.run({ client, afterCommit: hooks }, () => fn()),
    );

    for (const cb of hooks) {
      try {
        await cb();
      } catch {
        /* best-effort: 커밋 후 훅 실패가 트랜잭션 결과에 영향하지 않음 */
      }
    }

    return result;
  }
}
