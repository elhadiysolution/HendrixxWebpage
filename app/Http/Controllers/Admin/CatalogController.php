<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\CatalogResources;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function index(string $resource): Response
    {
        $definition = CatalogResources::get($resource);
        $query = $definition['model']::query();

        foreach ((array) $definition['order'] as $column) {
            $query->orderBy($column);
        }

        $rows = $query->get()
            ->map(fn (Model $model) => [
                'id' => $model->getKey(),
                ...collect($definition['fields'])->mapWithKeys(fn ($field) => [$field['key'] => $this->value($field, $model->getAttribute($field['key']))])->all(),
                ...(isset($definition['extra']) ? $definition['extra']($model) : []),
                '_warning' => isset($definition['warning']) ? $definition['warning']($model) : null,
            ]);

        return Inertia::render('admin/catalog', [
            'resource' => $resource,
            'definition' => CatalogResources::forClient($definition),
            'rows' => $rows,
            'resources' => collect(CatalogResources::all())->map(fn ($item) => $item['title']),
        ]);
    }

    public function store(Request $request, string $resource): RedirectResponse
    {
        $definition = CatalogResources::get($resource);
        $definition['model']::create($request->validate(CatalogResources::rules($definition)));

        return back()->with('success', "{$definition['title']} ditambah.");
    }

    public function update(Request $request, string $resource, int $id): RedirectResponse
    {
        $definition = CatalogResources::get($resource);
        $model = $definition['model']::findOrFail($id);
        $model->update($request->validate(CatalogResources::rules($definition, $model)));

        return back()->with('success', "{$definition['title']} dikemaskini.");
    }

    public function destroy(string $resource, int $id): RedirectResponse
    {
        $definition = CatalogResources::get($resource);
        $model = $definition['model']::findOrFail($id);

        if (isset($definition['in_use']) && ($reason = $definition['in_use']($model))) {
            return back()->withErrors(['delete' => $reason]);
        }

        $model->delete();

        return back()->with('success', "{$definition['title']} dipadam.");
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function value(array $field, mixed $value): mixed
    {
        return in_array($field['type'], ['money', 'number'], true) && $value !== null ? (float) $value : $value;
    }
}
