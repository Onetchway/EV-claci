import ProductsClient from './ProductsClient';

export const metadata = {
  title: 'Products',
  description:
    'Livanto Green hardware — AC and DC EV chargers from the 7.4 kW Livanto Home to the fleet-grade 240 kW Livanto DC 240.',
};

export default function ProductsPage() {
  return <ProductsClient />;
}
