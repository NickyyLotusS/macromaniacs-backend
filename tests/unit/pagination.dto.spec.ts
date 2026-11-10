import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PaginationQueryDto,
  SortDirection,
  paginationMeta,
} from '../../src/shared/http/pagination.dto';

describe('PaginationQueryDto', () => {
  it('aplica valores padrão e converte números da query string', async () => {
    const query = plainToInstance(PaginationQueryDto, {});
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      page: 1,
      limit: 20,
      sortDirection: SortDirection.DESC,
    });

    const converted = plainToInstance(PaginationQueryDto, {
      page: '2',
      limit: '50',
      sortDirection: 'asc',
    });
    expect(await validate(converted)).toHaveLength(0);
    expect(converted).toMatchObject({ page: 2, limit: 50 });
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 101 },
    { sortDirection: 'sideways' },
  ])('rejeita limites ou ordenação inválidos: %o', async (value) => {
    const query = plainToInstance(PaginationQueryDto, value);
    expect(await validate(query)).not.toHaveLength(0);
  });

  it('calcula metadados sem divisão por zero', () => {
    expect(paginationMeta(41, { page: 2, limit: 20 })).toEqual({
      page: 2,
      limit: 20,
      totalItems: 41,
      totalPages: 3,
    });
  });
});
