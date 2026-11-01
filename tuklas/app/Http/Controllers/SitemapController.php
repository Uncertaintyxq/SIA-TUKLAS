<?php

namespace App\Http\Controllers;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Http\Response;

/**
 * /sitemap.xml and /robots.txt, for search engines. The sitemap lists public works, public
 * publications and the portfolios of people who have one of them, so a student without
 * public research isn't put in front of search engines.
 */
class SitemapController
{
    public function sitemap(): Response
    {
        $base = rtrim((string) config('app.url'), '/');
        $works = Work::public()->get(['id', 'author_id', 'approved_at', 'updated_at']);
        $publications = Publication::where('visibility', PublicationVisibility::Public)->get(['id', 'author_id', 'published_at', 'updated_at']);
        $authorIds = Work::public()->join('work_authors', 'work_authors.work_id', '=', 'works.id')->pluck('work_authors.user_id')
            ->merge($works->pluck('author_id'))->merge($publications->pluck('author_id'))->unique();
        $people = User::active()->whereIn('id', $authorIds)->get(['username', 'updated_at']);

        $urls = [
            ...$works->map(fn ($w) => ["/works/{$w->id}", collect([$w->updated_at, $w->approved_at])->filter()->max()]),
            ...$publications->map(fn ($p) => ["/publications/{$p->id}", collect([$p->updated_at, $p->published_at])->filter()->max()]),
            ...$people->map(fn ($u) => ["/u/{$u->username}", $u->updated_at]),
        ];
        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($urls as [$path, $modified]) {
            $xml .= '  <url><loc>'.e($base.$path).'</loc>'.($modified ? '<lastmod>'.$modified->toDateString().'</lastmod>' : '')."</url>\n";
        }
        $xml .= "</urlset>\n";

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    /** Everything public may be crawled, including the PDFs Google Scholar indexes; the rest of the API may not. */
    public function robots(): Response
    {
        $base = rtrim((string) config('app.url'), '/');
        $body = implode("\n", [
            'User-agent: *',
            'Allow: /api/works/*/pdf',
            'Allow: /api/publications/*/pdf',
            'Allow: /api/users/*/photo',
            'Disallow: /api/',
            'Disallow: /sanctum/',
            '',
            "Sitemap: {$base}/sitemap.xml",
            '',
        ]);

        return response($body, 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }
}
