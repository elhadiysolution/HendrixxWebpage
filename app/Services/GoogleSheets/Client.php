<?php

namespace App\Services\GoogleSheets;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Talks to the Apps Script web app in google-apps-script/Code.gs.
 */
class Client
{
    public function __construct(
        private readonly ?string $url,
        private readonly ?string $token,
    ) {}

    public static function fromConfig(): self
    {
        return new self(config('hendrixx.sheets.url'), config('hendrixx.sheets.token'));
    }

    public function configured(): bool
    {
        return filled($this->url) && filled($this->token);
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function get(string $action, array $params = []): mixed
    {
        $this->ensureConfigured();

        return $this->unwrap(Http::timeout(60)->get($this->url, ['token' => $this->token, 'action' => $action, ...$params])->json());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function post(array $payload): mixed
    {
        $this->ensureConfigured();

        // Apps Script answers POST with a redirect to the result; Guzzle follows it as GET.
        return $this->unwrap(Http::timeout(120)->asJson()->post($this->url, ['token' => $this->token, ...$payload])->json());
    }

    /**
     * @param  list<array<string, mixed>>  $operations
     */
    public function batch(array $operations): mixed
    {
        return $this->post(['action' => 'batch', 'operations' => $operations]);
    }

    private function unwrap(mixed $response): mixed
    {
        if (! is_array($response) || ! array_key_exists('ok', $response)) {
            throw new RuntimeException('Respons Google Sheet tidak sah. Semak URL Web App (mesti berakhir dengan /exec) dan akses "Anyone".');
        }

        if (! $response['ok']) {
            throw new RuntimeException('Google Sheet: '.($response['error'] ?? 'ralat tidak diketahui'));
        }

        return $response['data'] ?? null;
    }

    private function ensureConfigured(): void
    {
        if (! $this->configured()) {
            throw new RuntimeException('URL Web App dan API token Google Sheet belum diisi di Tetapan.');
        }
    }
}
