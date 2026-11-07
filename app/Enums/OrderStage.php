<?php

namespace App\Enums;

enum OrderStage: string
{
    case Order = 'order';
    case Design = 'design';
    case Jobsheet = 'jobsheet';
    case Production = 'production';
    case Postage = 'postage';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Order => 'Order Diterima + Deposit',
            self::Design => 'Design Selesai',
            self::Jobsheet => 'Submit Jobsheet ke Kilang',
            self::Production => 'Baju Selesai',
            self::Postage => 'Postage',
            self::Completed => 'Complete',
        };
    }

    public function next(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $cases[$index + 1] ?? null;
    }

    public function previous(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $index > 0 ? $cases[$index - 1] : null;
    }

    public function position(): int
    {
        return array_search($this, self::cases(), true);
    }

    public function targetDays(): int
    {
        return (int) config("hendrixx.stage_targets.{$this->value}", 0);
    }

    /**
     * @return list<self>
     */
    public static function active(): array
    {
        return array_values(array_filter(self::cases(), fn (self $stage) => $stage !== self::Completed));
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $stage) => ['value' => $stage->value, 'label' => $stage->label()], self::cases());
    }
}
