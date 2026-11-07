<?php

namespace Database\Seeders;

use App\Enums\OrderStage;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\PricelistItem;
use App\Models\User;
use App\Support\WorkingDays;
use Illuminate\Database\Seeder;

/**
 * Sample orders spread across every stage so the dashboard has something to show.
 * Run with: php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $sales = User::firstOrCreate(['email' => 'sales@hendrixx.my'], [
            'name' => 'Aina (Sales)', 'role' => 'sales', 'password' => 'password', 'email_verified_at' => now(),
        ]);
        User::firstOrCreate(['email' => 'production@hendrixx.my'], [
            'name' => 'Hafiz (Production)', 'role' => 'production', 'password' => 'password', 'email_verified_at' => now(),
        ]);

        $samples = [
            // [title, organization, qty, price, stage, days ago created]
            ['Jersey Esports UM 2026', 'University of Malaya Esports', 25, 45, OrderStage::Completed, 150],
            ['Jersey Futsal Kelab Belia', 'Kelab Belia Seri Kembangan', 18, 38, OrderStage::Completed, 120],
            ['Baju Larian Amal', 'Persatuan Alumni SMK Taman Melawati', 120, 28, OrderStage::Completed, 95],
            ['Jersey Bola Sepak Liga Kampung', 'FC Kampung Baru', 22, 42, OrderStage::Completed, 70],
            ['Corporate Polo Sublimation', 'Nexa Tech Sdn Bhd', 60, 55, OrderStage::Completed, 40],
            ['Jersey Netball Daerah', 'MSSD Petaling Utama', 14, 40, OrderStage::Completed, 25],
            ['Jersey Hoki Sekolah', 'SMK Bukit Jalil', 20, 45, OrderStage::Postage, 14],
            ['Jersey Ping Pong Club', 'KL Table Tennis Club', 12, 48, OrderStage::Production, 12],
            ['Baju Event Hari Sukan', 'SK Desa Pandan', 150, 26, OrderStage::Production, 10],
            ['Jersey Esports Varsity', 'UiTM Shah Alam Esports', 10, 50, OrderStage::Jobsheet, 6],
            ['Jersey Badminton Kampus', 'UPM Badminton Club', 30, 42, OrderStage::Design, 4],
            ['Jersey Pasukan Bomba', 'Balai Bomba Ampang', 40, 46, OrderStage::Design, 9],
            ['Jersey Futsal Pejabat', 'Syarikat Maju Jaya', 16, 40, OrderStage::Order, 1],
        ];

        foreach ($samples as $index => [$title, $organization, $quantity, $price, $targetStage, $daysAgo]) {
            $created = now()->subDays($daysAgo)->setTime(10, 0);
            $customer = Customer::firstOrCreate(['phone' => '01'.str_pad((string) (2000000 + $index * 7919), 8, '0', STR_PAD_LEFT)], [
                'name' => fake()->name(),
                'organization' => $organization,
                'address' => fake()->streetAddress().', Kuala Lumpur',
            ]);

            $order = new Order([
                'customer_id' => $customer->id,
                'sales_user_id' => $sales->id,
                'agent_id' => $index % 3 === 0 ? Agent::value('id') : null,
                'title' => $title,
                'required_by' => WorkingDays::add($created, 14 + $index % 4)->toDateString(),
                'shipping_fee' => $quantity > 50 ? 0 : 15,
                'jobsheet_notes' => "10 - AMIR\n7 - FARHAN\n23 - DANISH",
            ]);
            $order->created_at = $created;
            $order->stage_entered_at = $created;
            $order->save();

            $tier = PricelistItem::where('code', 'like', 'JRS-SS-EYE-%')->where('min_qty', '<=', $quantity)->orderByDesc('min_qty')->first();

            $order->items()->create([
                'pricelist_code' => $tier?->code,
                'description' => 'Jersey Sublimation Round Neck Short Sleeve',
                'fabric' => 'Microfiber Eyelet',
                'quantity' => $quantity,
                'unit_price' => $price,
                'unit_cost' => $tier?->cost ?? round($price * 0.6, 2),
                'sizes' => $this->sizes($quantity),
            ]);
            $order->recalculateTotals();
            $order->forceFill(['deposit_required' => round((float) $order->total / 2, 2), 'order_no' => 'HX'.$created->format('ym').'-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)])->save();
            $order->log('created', 'Order dicipta (demo)', $sales);

            $this->progress($order, $targetStage, $created, $sales);
        }

        Inquiry::firstOrCreate(['phone' => '0137778899'], [
            'name' => 'Cikgu Rahman', 'organization' => 'SMK Seksyen 9', 'product' => 'Jersey Bola Sepak',
            'quantity' => 30, 'required_by' => now()->addWeeks(4)->toDateString(), 'message' => 'Nak design ikut warna sekolah, biru putih.',
        ]);
        Inquiry::firstOrCreate(['phone' => '0192223344'], [
            'name' => 'Izzat', 'organization' => 'Team Esports Valkyrie', 'product' => 'Jersey Esports',
            'quantity' => 8, 'message' => 'Boleh letak nama IGN belakang?',
        ]);
    }

    private function progress(Order $order, OrderStage $target, $created, User $user): void
    {
        $clock = $created->copy();
        $step = function (int $days) use (&$clock) {
            return $clock = WorkingDays::add($clock, $days)->setTime(11, 0);
        };

        while ($order->stage !== $target) {
            switch ($order->stage) {
                case OrderStage::Order:
                    $order->forceFill(['invoice_sent_at' => $clock])->save();
                    $order->payments()->create(['type' => 'deposit', 'amount' => $order->deposit_required, 'method' => 'transfer', 'paid_on' => $clock->toDateString(), 'user_id' => $user->id]);
                    break;
                case OrderStage::Design:
                    $order->attachments()->create(['kind' => 'design_final', 'path' => 'demo/design.png', 'original_name' => 'design-final.png', 'size' => 0]);
                    $order->forceFill(['design_approved_at' => $step(2)])->save();
                    break;
                case OrderStage::Jobsheet:
                    $order->forceFill(['jobsheet_submitted_at' => $step(1), 'due_date' => WorkingDays::add($clock, 6), 'supplier_ref' => 'KLG-'.$order->id])->save();
                    break;
                case OrderStage::Production:
                    $late = $order->id % 5 === 0 ? 1 : 0;
                    $order->forceFill(['production_received_at' => $step(6 + $late)])->save();
                    break;
                case OrderStage::Postage:
                    $order->payments()->create(['type' => 'balance', 'amount' => $order->balance(), 'method' => 'transfer', 'paid_on' => $clock->toDateString(), 'user_id' => $user->id]);
                    $order->forceFill(['shipping_method' => 'courier', 'courier' => 'J&T Express', 'tracking_no' => 'JT'.rand(100000000, 999999999), 'shipped_at' => $step(1)])->save();
                    break;
            }

            $order->advance($user);
            $order->forceFill([
                'stage_entered_at' => $clock,
                'confirmed_at' => $order->confirmed_at ? $created->copy()->setTime(11, 0) : null,
                'completed_at' => $order->completed_at ? $clock : null,
                'feedback_rating' => $order->stage === OrderStage::Completed ? rand(4, 5) : null,
            ])->save();
        }
    }

    /**
     * @return array<string, int>
     */
    private function sizes(int $quantity): array
    {
        $split = ['S' => 0.15, 'M' => 0.3, 'L' => 0.3, 'XL' => 0.15];
        $sizes = array_map(fn ($ratio) => (int) floor($quantity * $ratio), $split);
        $sizes['2XL'] = $quantity - array_sum($sizes);

        return array_filter($sizes);
    }
}
