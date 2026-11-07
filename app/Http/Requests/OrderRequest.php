<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer.name' => ['required', 'string', 'max:255'],
            'customer.phone' => ['required', 'string', 'max:30'],
            'customer.email' => ['nullable', 'email', 'max:255'],
            'customer.organization' => ['nullable', 'string', 'max:255'],
            'customer.state' => ['nullable', Rule::in(collect(config('hendrixx.states'))->flatten()->all())],
            'customer.address' => ['nullable', 'string', 'max:1000'],

            'title' => ['required', 'string', 'max:255'],
            'required_by' => ['nullable', 'date'],
            'sales_user_id' => ['nullable', 'exists:users,id'],
            'agent_id' => ['nullable', 'exists:agents,id'],
            'campaign_id' => ['nullable', 'exists:campaigns,id'],
            'inquiry_id' => ['nullable', 'exists:inquiries,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'deposit_required' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'jobsheet_notes' => ['nullable', 'string', 'max:10000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.pricelist_code' => ['nullable', 'string', 'exists:pricelist_items,code'],
            'items.*.addons' => ['nullable', 'array'],
            'items.*.addons.*' => ['string', 'exists:add_ons,code'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.garment_type' => ['nullable', 'string', 'max:255'],
            'items.*.print_method' => ['nullable', 'string', 'max:255'],
            'items.*.fabric' => ['nullable', 'string', 'max:255'],
            'items.*.neck_type' => ['nullable', 'string', 'max:255'],
            'items.*.neck_finish' => ['nullable', 'string', 'max:255'],
            'items.*.test_print' => ['nullable', 'boolean'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.sizes' => ['nullable', 'array'],
            'items.*.sizes.*' => ['nullable', 'integer', 'min:0'],
            'items.*.names' => ['nullable', 'array', 'max:2000'],
            'items.*.names.*.name' => ['nullable', 'string', 'max:100'],
            'items.*.names.*.number' => ['nullable', 'string', 'max:10'],
            'items.*.names.*.size' => ['nullable', 'string', 'max:10'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'customer.name' => 'nama customer',
            'customer.phone' => 'no. telefon',
            'customer.state' => 'negeri',
            'items.*.description' => 'item',
            'items.*.quantity' => 'kuantiti',
            'items.*.unit_price' => 'harga seunit',
        ];
    }
}
