import { Injectable } from '@nestjs/common';

/**
 * stats 모듈은 자체 소유 트랜잭션 테이블이 없다 (집계 조회 전용).
 * 모든 집계는 각 도메인 Service(Order/User/Seller) 의 공개 메서드 DI 경유로 획득한다 (P-001).
 * 본 클래스는 4계층 골격(structure) 유지를 위해 존재하며 직접 DB 접근을 하지 않는다.
 */
@Injectable()
export class StatsRepository {}
