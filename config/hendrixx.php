<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Company details (printed on invoice & jobsheet)
    |--------------------------------------------------------------------------
    */

    'company' => [
        'name' => env('COMPANY_NAME', 'Hendrixx Exclusive'),
        'registration_no' => env('COMPANY_REG_NO', ''),
        'address' => env('COMPANY_ADDRESS', 'Kuala Lumpur, Malaysia'),
        'phone' => env('COMPANY_PHONE', '60123456789'),
        'email' => env('COMPANY_EMAIL', 'hello@hendrixx.my'),
        'bank_name' => env('COMPANY_BANK_NAME', 'Maybank'),
        'bank_account' => env('COMPANY_BANK_ACCOUNT', '0000 0000 0000'),
        'bank_holder' => env('COMPANY_BANK_HOLDER', 'Hendrixx Exclusive'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Lead time
    |--------------------------------------------------------------------------
    |
    | production_days: working days the kilang needs after jobsheet submission.
    | working_days: ISO day numbers (1 = Monday ... 7 = Sunday).
    | holidays: dates (Y-m-d) skipped when counting working days.
    | stage_targets: target working days per stage, used to flag stuck orders
    | and project the ship date.
    |
    */

    'production_days' => 6,

    'working_days' => [1, 2, 3, 4, 5],

    'holidays' => [],

    'stage_targets' => [
        'order' => 2,
        'design' => 3,
        'jobsheet' => 1,
        'production' => 6,
        'postage' => 1,
    ],

    'deposit_percent' => 50,

    // Cancelled orders can be restored for this many days, then they are deleted for good.
    'cancelled_retention_days' => 3,

    /*
    |--------------------------------------------------------------------------
    | Product options
    |--------------------------------------------------------------------------
    */

    'fabrics' => [
        'Microfiber Eyelet',
        'Microfiber Interlock',
        'Jersey Cool Max',
        'Honeycomb',
        'Spandex',
        'Rib Knit',
    ],

    'sizes' => ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'],

    // Extra charge (RM per piece) for big sizes, added to the invoice once sizes are filled in.
    'size_surcharges' => [
        '3XL' => 4, '4XL' => 4, '5XL' => 4,
        '6XL' => 6, '7XL' => 6, '8XL' => 6,
    ],

    // Delivery state, grouped by postage zone.
    'states' => [
        'Semenanjung' => [
            'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang',
            'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 'W.P. Putrajaya',
        ],
        'Sabah / Sarawak' => ['Sabah', 'Sarawak', 'W.P. Labuan'],
    ],

    // Default postage fee (RM) per zone above; filled in the order form when a state is picked.
    'postage_rates' => [
        'Semenanjung' => 0,
        'Sabah / Sarawak' => 0,
    ],

    'couriers' => ['J&T Express', 'Pos Laju', 'DHL eCommerce', 'Ninja Van', 'Lalamove'],

    /*
    |--------------------------------------------------------------------------
    | Kewangan
    |--------------------------------------------------------------------------
    |
    | opening_balance: money in the bank before the first record in the system,
    | so "Baki tunai" matches the real account. Set on the Cash In / Out page.
    |
    */

    'finance' => [
        'opening_balance' => 0,
    ],

    /*
    |--------------------------------------------------------------------------
    | Google Sheets mirror (Apps Script web app, see google-apps-script/Code.gs)
    |--------------------------------------------------------------------------
    |
    | Every value in this file can be overridden by admins in Tetapan (stored in
    | the `settings` table), so these are only first-run defaults.
    |
    */

    'sheets' => [
        'url' => env('GOOGLE_SHEETS_URL'),
        'token' => env('GOOGLE_SHEETS_TOKEN'),
        'auto_sync' => true,
        'last_sync_at' => null,
        'last_error' => null,
    ],

];
