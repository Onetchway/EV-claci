import ProductsClient from './ProductsClient';

export const metadata = {
  title: 'Products',
  description:
    'Livanto Green hardware — AC and DC EV chargers from 7.4 kW to 360 kW, including the ARAI-certified 60 kW dual-CCS2 DC fast charger.',
};

export default function ProductsPage() {
  return <ProductsClient />;
}
