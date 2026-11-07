<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * A reporting period: a month ("2026-10"), a quarter ("2026-Q4") or a year ("2026").
 */
final class FinancePeriod
{
    public const TYPES = ['month' => 'Bulanan', 'quarter' => 'Suku tahun', 'year' => 'Tahunan'];

    private function __construct(
        public readonly string $type,
        public readonly CarbonImmutable $from,
        public readonly CarbonImmutable $to,
    ) {}

    public static function make(?string $type, ?string $ref = null): self
    {
        $type = array_key_exists((string) $type, self::TYPES) ? $type : 'month';
        $today = CarbonImmutable::today();

        $from = match ($type) {
            'month' => preg_match('/^\d{4}-\d{2}$/', (string) $ref) ? CarbonImmutable::createFromFormat('!Y-m', $ref) : $today->startOfMonth(),
            'quarter' => preg_match('/^(\d{4})-Q([1-4])$/', (string) $ref, $m)
                ? CarbonImmutable::create((int) $m[1], ((int) $m[2] - 1) * 3 + 1, 1)
                : $today->firstOfQuarter(),
            'year' => preg_match('/^\d{4}$/', (string) $ref) ? CarbonImmutable::create((int) $ref, 1, 1) : $today->startOfYear(),
        };

        return new self($type, $from, match ($type) {
            'month' => $from->endOfMonth()->startOfDay(),
            'quarter' => $from->lastOfQuarter(),
            'year' => $from->endOfYear()->startOfDay(),
        });
    }

    public function ref(?CarbonImmutable $date = null): string
    {
        $date ??= $this->from;

        return match ($this->type) {
            'month' => $date->format('Y-m'),
            'quarter' => $date->year.'-Q'.$date->quarter,
            'year' => (string) $date->year,
        };
    }

    public function label(): string
    {
        return match ($this->type) {
            'month' => $this->from->translatedFormat('F Y'),
            'quarter' => 'Q'.$this->from->quarter.' '.$this->from->year.' ('.$this->from->format('M').' - '.$this->to->format('M').')',
            'year' => 'Tahun '.$this->from->year,
        };
    }

    public function previous(): string
    {
        return $this->ref(match ($this->type) {
            'month' => $this->from->subMonthNoOverflow(),
            'quarter' => $this->from->subMonthsNoOverflow(3),
            'year' => $this->from->subYear(),
        });
    }

    public function next(): string
    {
        return $this->ref($this->to->addDay());
    }

    /** The same period a year earlier, for comparison. */
    public function lastYear(): self
    {
        return self::make($this->type, $this->ref($this->from->subYear()));
    }

    /**
     * Sub-periods for the breakdown table: weeks of a month, months of a quarter or year.
     *
     * @return list<array{label: string, from: CarbonImmutable, to: CarbonImmutable}>
     */
    public function buckets(): array
    {
        $buckets = [];

        if ($this->type === 'month') {
            for ($day = 1; $day <= $this->to->day; $day += 7) {
                $from = $this->from->day($day);
                $to = $from->addDays(6)->min($this->to);
                $buckets[] = ['label' => $from->format('j').'-'.$to->format('j M'), 'from' => $from, 'to' => $to];
            }

            return $buckets;
        }

        for ($month = $this->from; $month->lessThanOrEqualTo($this->to); $month = $month->addMonthNoOverflow()) {
            $buckets[] = ['label' => $month->format('M'), 'from' => $month, 'to' => $month->endOfMonth()->startOfDay()];
        }

        return $buckets;
    }
}
