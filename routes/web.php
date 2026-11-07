<?php

use App\Http\Controllers\Admin\CatalogController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Finance\CampaignController;
use App\Http\Controllers\Finance\CashEntryController;
use App\Http\Controllers\Finance\PayrollController;
use App\Http\Controllers\Finance\ReportController;
use App\Http\Controllers\Finance\TeamMemberController;
use App\Http\Controllers\InquiryController;
use App\Http\Controllers\OrderAttachmentController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderDocumentController;
use App\Http\Controllers\OrderNamesController;
use App\Http\Controllers\OrderWorkflowController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\TrackingController;
use App\Http\Controllers\UserController;
use App\Models\Material;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public sales page, quote requests, tracking and shared invoices
Route::get('/', fn () => Inertia::render('welcome', [
    'fabrics' => Material::fabricNames(),
    'productionDays' => config('hendrixx.production_days'),
    'company' => config('hendrixx.company'),
]))->name('home');

Route::post('inquiries', [InquiryController::class, 'store'])->middleware('throttle:5,1')->name('inquiries.store');
Route::get('track', TrackingController::class)->middleware('throttle:30,1')->name('track');
Route::get('i/{token}', [OrderDocumentController::class, 'publicInvoice'])->name('invoice.public');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::resource('orders', OrderController::class);
    Route::get('orders/{order}/invoice', [OrderDocumentController::class, 'invoice'])->name('orders.invoice');
    Route::get('orders/{order}/jobsheet', [OrderDocumentController::class, 'jobsheet'])->name('orders.jobsheet');
    Route::get('orders/{order}/names', [OrderNamesController::class, 'edit'])->name('orders.names.edit');
    Route::put('orders/{order}/names', [OrderNamesController::class, 'update'])->name('orders.names.update');

    Route::controller(OrderWorkflowController::class)->prefix('orders/{order}')->name('orders.')->group(function () {
        Route::post('advance', 'advance')->name('advance');
        Route::post('revert', 'revert')->name('revert');
        Route::post('cancel', 'cancel')->name('cancel');
        Route::post('invoice-sent', 'invoiceSent')->name('invoice-sent');
        Route::post('approve-design', 'approveDesign')->name('approve-design');
        Route::post('submit-jobsheet', 'submitJobsheet')->name('submit-jobsheet');
        Route::post('receive-production', 'receiveProduction')->name('receive-production');
        Route::post('ship', 'ship')->name('ship');
        Route::post('tracking-sent', 'trackingSent')->name('tracking-sent');
        Route::post('feedback', 'feedback')->name('feedback');
    });

    Route::post('orders/{order}/payments', [PaymentController::class, 'store'])->name('orders.payments.store');
    Route::delete('orders/{order}/payments/{payment}', [PaymentController::class, 'destroy'])->name('orders.payments.destroy');
    Route::post('orders/{order}/attachments', [OrderAttachmentController::class, 'store'])->name('orders.attachments.store');
    Route::delete('orders/{order}/attachments/{attachment}', [OrderAttachmentController::class, 'destroy'])->name('orders.attachments.destroy');

    Route::get('inquiries', [InquiryController::class, 'index'])->name('inquiries.index');
    Route::patch('inquiries/{inquiry}', [InquiryController::class, 'update'])->name('inquiries.update');

    Route::middleware('can:admin')->group(function () {
        Route::resource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::prefix('admin')->name('admin.')->group(function () {
            Route::get('settings', [SettingsController::class, 'edit'])->name('settings.edit');
            Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
            Route::post('settings/sheets/test', [SettingsController::class, 'testSheet'])->name('sheets.test');
            Route::post('settings/sheets/push', [SettingsController::class, 'pushSheet'])->name('sheets.push');
            Route::post('settings/sheets/pull', [SettingsController::class, 'pullSheet'])->name('sheets.pull');

            Route::get('catalog/{resource}', [CatalogController::class, 'index'])->name('catalog.index');
            Route::post('catalog/{resource}', [CatalogController::class, 'store'])->name('catalog.store');
            Route::put('catalog/{resource}/{id}', [CatalogController::class, 'update'])->name('catalog.update');
            Route::delete('catalog/{resource}/{id}', [CatalogController::class, 'destroy'])->name('catalog.destroy');
        });

        // Kewangan: reports, cash in / out, payroll, targets & forecast (admin only, salaries are private)
        Route::prefix('finance')->name('finance.')->group(function () {
            Route::get('/', [ReportController::class, 'index'])->name('report');
            Route::get('export', [ReportController::class, 'export'])->name('export');

            Route::get('cash', [CashEntryController::class, 'index'])->name('cash.index');
            Route::post('cash', [CashEntryController::class, 'store'])->name('cash.store');
            Route::put('cash/{entry}', [CashEntryController::class, 'update'])->name('cash.update');
            Route::delete('cash/{entry}', [CashEntryController::class, 'destroy'])->name('cash.destroy');
            Route::put('opening-balance', [CashEntryController::class, 'openingBalance'])->name('opening-balance');

            Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
            Route::post('payroll/{member}/{period}', [PayrollController::class, 'save'])->name('payroll.save');
            Route::post('payroll/{member}/{period}/pay', [PayrollController::class, 'pay'])->name('payroll.pay');
            Route::get('payslips/{payslip}', [PayrollController::class, 'show'])->name('payslips.show');
            Route::post('payslips/{payslip}/unpay', [PayrollController::class, 'unpay'])->name('payslips.unpay');
            Route::delete('payslips/{payslip}', [PayrollController::class, 'destroy'])->name('payslips.destroy');

            Route::post('team', [TeamMemberController::class, 'store'])->name('team.store');
            Route::put('team/{member}', [TeamMemberController::class, 'update'])->name('team.update');
            Route::delete('team/{member}', [TeamMemberController::class, 'destroy'])->name('team.destroy');

            Route::get('targets', [CampaignController::class, 'index'])->name('targets.index');
            Route::post('targets', [CampaignController::class, 'store'])->name('targets.store');
            Route::put('targets/{campaign}', [CampaignController::class, 'update'])->name('targets.update');
            Route::delete('targets/{campaign}', [CampaignController::class, 'destroy'])->name('targets.destroy');
        });
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
