/**
 * SearchService 단위 테스트 — [env:unit]
 *
 * 검증 대상 (006-search):
 *   - page/size 정규화 → skip/take 계산
 *   - size 클램핑(1~MAX_SEARCH_SIZE), 기본값
 *   - sort 기본값(latest) 및 전달 passthrough
 *   - 필터(q/categoryId/minPrice/maxPrice) ProductService 로 그대로 전달
 *   - 응답에 page/size 메타 포함
 *
 * P-001: 자체 테이블 없음 — ProductService DI mock 으로 경계 검증.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from '../product/product.service';
import { MAX_SEARCH_SIZE } from './search.constants';
import { SearchService } from './search.service';

const mockProductService = {
  searchProducts: jest.fn(),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProductService.searchProducts.mockResolvedValue({ items: [], total: 0 });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ProductService, useValue: mockProductService },
      ],
    }).compile();

    service = moduleRef.get<SearchService>(SearchService);
  });

  it('when_no_pagination_params_then_defaults_page1_size20_skip0', async () => {
    await service.searchProducts({});

    expect(mockProductService.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'latest', skip: 0, take: 20 }),
    );
  });

  it('when_page3_size10_then_skip_is_20', async () => {
    await service.searchProducts({ page: 3, size: 10 });

    expect(mockProductService.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('when_size_exceeds_max_then_clamped', async () => {
    await service.searchProducts({ size: 9999 });

    expect(mockProductService.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_SEARCH_SIZE }),
    );
  });

  it('when_filters_provided_then_passed_through', async () => {
    await service.searchProducts({
      q: 'shoes',
      categoryId: 'cat-1',
      minPrice: '1000',
      maxPrice: '5000',
      sort: 'price_asc',
      page: 2,
      size: 5,
    });

    expect(mockProductService.searchProducts).toHaveBeenCalledWith({
      q: 'shoes',
      categoryId: 'cat-1',
      minPrice: '1000',
      maxPrice: '5000',
      sort: 'price_asc',
      skip: 5,
      take: 5,
    });
  });

  it('when_result_returned_then_wraps_with_page_size_meta', async () => {
    mockProductService.searchProducts.mockResolvedValue({
      items: [{ id: 'p1' }],
      total: 1,
    });

    const result = await service.searchProducts({ page: 2, size: 5 });

    expect(result).toEqual({
      items: [{ id: 'p1' }],
      total: 1,
      page: 2,
      size: 5,
    });
  });
});
