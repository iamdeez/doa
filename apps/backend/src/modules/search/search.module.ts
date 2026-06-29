import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * 상품 검색 모듈 (006-search).
 * 자체 소유 테이블 없음 — ProductModule(ProductService) 를 import 하여 read-only 조회.
 */
@Module({
  imports: [ProductModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
