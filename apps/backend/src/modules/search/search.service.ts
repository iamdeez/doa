import { Injectable } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import {
  DEFAULT_SEARCH_SIZE,
  MAX_SEARCH_SIZE,
  SearchSort,
} from './search.constants';

export interface SearchProductsParams {
  q?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: SearchSort;
  page?: number;
  size?: number;
}

export interface SearchProductsResult {
  items: unknown[];
  total: number;
  page: number;
  size: number;
}

/**
 * 상품 검색 도메인 (006-search).
 * 자체 소유 테이블이 없는 read-only 질의 모듈 — products 스키마 데이터는
 * ProductService 공개 메서드 DI 경유로만 조회한다 (P-001 경계).
 * 본 서비스는 페이지네이션·정렬·기본값 정규화(orchestration)만 담당한다.
 */
@Injectable()
export class SearchService {
  constructor(private readonly productService: ProductService) {}

  async searchProducts(params: SearchProductsParams): Promise<SearchProductsResult> {
    const page = Math.max(params.page ?? 1, 1);
    const size = Math.min(Math.max(params.size ?? DEFAULT_SEARCH_SIZE, 1), MAX_SEARCH_SIZE);
    const sort: SearchSort = params.sort ?? 'latest';

    const { items, total } = await this.productService.searchProducts({
      q: params.q,
      categoryId: params.categoryId,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort,
      skip: (page - 1) * size,
      take: size,
    });

    return { items, total, page, size };
  }
}
