<?php

namespace Database\Seeders;

use App\Models\AddOn;
use App\Models\Agent;
use App\Models\Material;
use App\Models\PricelistItem;
use Illuminate\Database\Seeder;

/**
 * Starter catalog — the same sample data as "Isi data contoh" in the Google Sheet.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $materials = [
            ['MAT-EYELET', 'Microfiber Eyelet', 'Kain', 140, 'kg', 28, 'Kilang Fabrik A', 50, 15, 'Berlubang halus, breathable. Paling popular untuk jersey bola.'],
            ['MAT-INTERLOCK', 'Microfiber Interlock', 'Kain', 160, 'kg', 30, 'Kilang Fabrik A', 40, 15, 'Permukaan licin, warna print sangat terang.'],
            ['MAT-COOLMAX', 'Jersey Cool Max', 'Kain', 150, 'kg', 32, 'Kilang Fabrik B', 30, 10, 'Cepat kering, sesuai untuk larian.'],
            ['MAT-HONEYCOMB', 'Honeycomb', 'Kain', 180, 'kg', 33, 'Kilang Fabrik B', 20, 10, 'Tekstur sarang lebah, sesuai untuk polo korporat.'],
            ['MAT-SPANDEX', 'Spandex', 'Kain', 200, 'kg', 38, 'Kilang Fabrik C', 10, 5, 'Elastik, untuk seluar & jersey ketat.'],
            ['MAT-LYCRA', 'Lycra Premium', 'Lycra', 180, 'kg', 45, 'Kilang Fabrik C', 12, 5, 'Untuk naik taraf Lycra.'],
            ['MAT-RIB', 'Rib Knit Collar', 'Collar / Rib', null, 'pcs', 1.2, 'Pembekal Aksesori', 500, 100, 'Kolar polo & hujung lengan.'],
            ['MAT-POLYBAG', 'Polybag + Label HX', 'Packaging', null, 'pcs', 0.35, 'Pembekal Packaging', 1000, 200, 'Pembungkusan setiap helai.'],
        ];

        foreach ($materials as [$code, $name, $category, $gsm, $unit, $cost, $supplier, $stock, $reorder, $description]) {
            Material::firstOrCreate(['code' => $code], [
                'name' => $name, 'category' => $category, 'gsm' => $gsm, 'unit' => $unit, 'cost_per_unit' => $cost,
                'supplier' => $supplier, 'stock_qty' => $stock, 'reorder_level' => $reorder, 'description' => $description, 'active' => true,
            ]);
        }

        $tiers = [[1, 9, 55, 30], [10, 29, 45, 26], [30, 99, 40, 24], [100, null, 35, 22]];
        $lines = [
            ['JRS-SS-EYE', 'Jersey', 'MAT-EYELET', 'Pendek', 'Round Neck', 0],
            ['JRS-LS-EYE', 'Jersey', 'MAT-EYELET', 'Panjang', 'Round Neck', 5],
            ['ESP-SS-INT', 'Jersey Esports', 'MAT-INTERLOCK', 'Pendek', 'V Neck', 3],
            ['POLO-SS-HNC', 'Corporate Polo', 'MAT-HONEYCOMB', 'Pendek', 'Polo Collar', 8],
        ];

        foreach ($lines as [$code, $product, $material, $sleeve, $collar, $extra]) {
            foreach ($tiers as [$min, $max, $price, $cost]) {
                PricelistItem::firstOrCreate(['code' => "{$code}-{$min}"], [
                    'product' => $product, 'material_code' => $material, 'sleeve' => $sleeve, 'collar' => $collar,
                    'min_qty' => $min, 'max_qty' => $max, 'price' => $price + $extra, 'cost' => $cost + $extra * 0.5, 'active' => true,
                ]);
            }
        }

        $addOns = [
            ['ADD-LYCRA', 'Naik taraf Lycra', 'per helai', 8, 4, null],
            ['ADD-LONG', 'Lengan panjang', 'per helai', 5, 2.5, null],
            ['ADD-3XL', 'Saiz 3XL ke atas', 'per helai', 3, 1.5, null],
            ['ADD-NAMENO', 'Nama & nombor custom', 'per helai', 0, 0, 'Percuma'],
            ['ADD-RUSH', 'Rush order (3 hari bekerja)', 'per order', 150, 80, null],
        ];

        foreach ($addOns as [$code, $name, $chargeType, $price, $cost, $notes]) {
            AddOn::firstOrCreate(['code' => $code], ['name' => $name, 'charge_type' => $chargeType, 'price' => $price, 'cost' => $cost, 'active' => true, 'notes' => $notes]);
        }

        Agent::firstOrCreate(['name' => 'Luqman'], ['phone' => '0121112222', 'area' => 'MITS Pandan Indah', 'commission_type' => 'per helai', 'commission_value' => 4.5, 'active' => true]);
        Agent::firstOrCreate(['name' => "Wan Nur 'Irdhina"], ['phone' => '0133334444', 'area' => 'MITS Sabak Bernam', 'commission_type' => 'percent', 'commission_value' => 10, 'active' => true]);
    }
}
