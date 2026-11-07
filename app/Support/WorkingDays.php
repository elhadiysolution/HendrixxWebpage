<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class WorkingDays
{
    public static function isWorkingDay(CarbonInterface $date): bool
    {
        return in_array($date->dayOfWeekIso, config('hendrixx.working_days'), true)
            && ! in_array($date->toDateString(), config('hendrixx.holidays'), true);
    }

    /**
     * Add the given number of working days to a date (the start day itself is not counted).
     */
    public static function add(CarbonInterface $date, int $days): CarbonImmutable
    {
        $date = CarbonImmutable::parse($date)->startOfDay();

        while ($days > 0) {
            $date = $date->addDay();

            if (self::isWorkingDay($date)) {
                $days--;
            }
        }

        return $date;
    }

    /**
     * Count working days elapsed from $from (exclusive) to $to (inclusive).
     * Returns a negative number when $to is before $from.
     */
    public static function between(CarbonInterface $from, CarbonInterface $to): int
    {
        $from = CarbonImmutable::parse($from)->startOfDay();
        $to = CarbonImmutable::parse($to)->startOfDay();

        if ($to->lessThan($from)) {
            return -self::between($to, $from);
        }

        $count = 0;

        for ($date = $from->addDay(); $date->lessThanOrEqualTo($to); $date = $date->addDay()) {
            if (self::isWorkingDay($date)) {
                $count++;
            }
        }

        return $count;
    }
}
