import { Injectable } from '@nestjs/common';

/**
 * admin 모듈은 자체 소유 트랜잭션 테이블이 없다 (운영 조회/조치 전용).
 * 판매자 승인·사용자 조회 등은 각 도메인 Service(Seller/User) 의 공개 메서드 DI 경유로 수행한다 (P-001).
 * 본 클래스는 4계층 골격(structure) 유지를 위해 존재하며 직접 DB 접근을 하지 않는다.
 */
@Injectable()
export class AdminRepository {}
