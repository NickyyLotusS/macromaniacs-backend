import { Injectable } from '@nestjs/common';
import { FoodSource } from '../database/entities/enums';
import type {
  FoodProvider,
  FoodSearchQuery,
  ProviderFood,
} from '../../modules/food-products/domain/food-provider';
import { FoodProviderUnavailableError } from './provider-errors';

/**
 * TBCA publishes a searchable website and licensed data, but no stable public
 * API contract was found. This adapter deliberately stays disabled so the
 * application never relies on undocumented scraping.
 */
@Injectable()
export class TbcaFoodProvider implements FoodProvider {
  readonly source = FoodSource.TBCA;

  search(_query: FoodSearchQuery): Promise<ProviderFood[]> {
    throw new FoodProviderUnavailableError(
      'tbca',
      'TBCA has no configured official API contract',
    );
  }

  findByBarcode(_barcode: string): Promise<ProviderFood | null> {
    throw new FoodProviderUnavailableError(
      'tbca',
      'TBCA has no configured official API contract',
    );
  }
}
