<?php

namespace App\Support;

use App\Enums\PublicationVisibility;
use App\Enums\WorkType;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * What search engines and link previews read from the app page. The React app draws every screen
 * with JavaScript, so for public works, publications and portfolios Laravel adds the details to
 * the HTML it serves: Google Scholar's citation_* tags, Open Graph and Twitter card tags, a
 * canonical link, and a plain copy of the content inside #root for crawlers that don't run
 * JavaScript (React replaces it on load). Anything not public gets the plain page with noindex.
 */
class PageMeta
{
    private const SITE = 'Tuklas';

    /**
     * @return array{title: string, description: string, url: string, type: string, scholar: list<array{0: string, 1: string}>, body: string}|null
     */
    public static function for(string $path): ?array
    {
        if (preg_match('#^works/(\d+)$#', $path, $m)) {
            return self::work((int) $m[1]);
        }
        if (preg_match('#^publications/(\d+)$#', $path, $m)) {
            return self::publication((int) $m[1]);
        }
        if (preg_match('#^u/([A-Za-z0-9_-]{1,40})$#', $path, $m)) {
            return self::portfolio($m[1]);
        }

        return null;
    }

    /** The served page with $meta in it; without $meta, the plain page marked noindex (except the home page). */
    public static function apply(string $html, ?array $meta, string $path): string
    {
        if ($meta === null) {
            return $path === '/' ? $html : str_replace('</head>', '  <meta name="robots" content="noindex">'."\n  </head>", $html);
        }

        $tags = [
            ['link', 'canonical', $meta['url']],
            ['property', 'og:site_name', self::SITE],
            ['property', 'og:type', $meta['type']],
            ['property', 'og:title', $meta['title']],
            ['property', 'og:description', $meta['description']],
            ['property', 'og:url', $meta['url']],
            ['name', 'twitter:card', 'summary'],
            ['name', 'twitter:title', $meta['title']],
            ['name', 'twitter:description', $meta['description']],
            ...array_map(fn ($t) => ['name', $t[0], $t[1]], $meta['scholar']),
        ];
        $head = collect($tags)->map(fn ($t) => $t[0] === 'link'
            ? '<link rel="canonical" href="'.e($t[2]).'">'
            : '<meta '.$t[0].'="'.e($t[1]).'" content="'.e($t[2]).'">')
            ->implode("\n    ");

        $html = preg_replace('#<title>.*?</title>#s', '<title>'.e($meta['title']).' · '.self::SITE.'</title>', $html, 1);
        $html = preg_replace('#<meta name="description" content="[^"]*"\s*/?>#', '<meta name="description" content="'.e($meta['description']).'">', $html, 1);
        $html = str_replace('</head>', "  {$head}\n  </head>", $html);

        return str_replace('<div id="root"></div>', '<div id="root">'.$meta['body'].'</div>', $html);
    }

    private static function work(int $id): ?array
    {
        $work = Work::public()->with(['author:id,name', 'coAuthors:id,name'])->find($id);
        if ($work === null) {
            return null;
        }
        $authors = collect([$work->author, ...$work->coAuthors])->filter()->pluck('name');
        $url = self::url("/works/{$work->id}");
        $pdf = $work->pdf_file ? self::url("/api/works/{$work->id}/pdf") : null;
        $institution = (string) config('tuklas.institution');

        return [
            'title' => $work->title,
            'description' => self::short($work->abstract),
            'url' => $url,
            'type' => 'article',
            'scholar' => array_values(array_filter([
                ['citation_title', $work->title],
                ...$authors->map(fn ($a) => ['citation_author', $a]),
                ['citation_publication_date', $work->approved_at?->format('Y/m/d') ?? ''],
                ['citation_abstract_html_url', $url],
                $pdf ? ['citation_pdf_url', $pdf] : null,
                ...collect($work->tags ?? [])->map(fn ($t) => ['citation_keywords', (string) $t]),
                $institution !== '' && $work->type === WorkType::Research ? ['citation_dissertation_institution', $institution] : null,
            ], fn ($t) => $t !== null && $t[1] !== '')),
            'body' => self::article($work->title, $authors, $work->abstract, $pdf),
        ];
    }

    private static function publication(int $id): ?array
    {
        $p = Publication::with(['author:id,name', 'coAuthors:id,name'])->where('visibility', PublicationVisibility::Public)->find($id);
        if ($p === null) {
            return null;
        }
        $authors = collect([$p->author, ...$p->coAuthors])->filter()->pluck('name');
        $url = self::url("/publications/{$p->id}");
        $pdf = $p->pdf_file ? self::url("/api/publications/{$p->id}/pdf") : null;

        return [
            'title' => $p->title,
            'description' => self::short($p->abstract),
            'url' => $url,
            'type' => 'article',
            'scholar' => array_values(array_filter([
                ['citation_title', $p->title],
                ...$authors->map(fn ($a) => ['citation_author', $a]),
                ['citation_publication_date', $p->published_at?->format('Y/m/d') ?? ''],
                ['citation_abstract_html_url', $url],
                $pdf ? ['citation_pdf_url', $pdf] : null,
                ...collect($p->keywords ?? [])->map(fn ($k) => ['citation_keywords', (string) $k]),
            ], fn ($t) => $t !== null && $t[1] !== '')),
            'body' => self::article($p->title, $authors, $p->abstract, $pdf),
        ];
    }

    private static function portfolio(string $username): ?array
    {
        $user = User::active()->with('profile:user_id,department')->where('username', $username)->first(['id', 'name', 'username', 'program', 'headline']);
        if ($user === null) {
            return null;
        }
        $works = Work::public()
            ->where(fn ($q) => $q->where('author_id', $user->id)->orWhereHas('coAuthors', fn ($c) => $c->whereKey($user->id)))
            ->latest('approved_at')->limit(20)->get(['id', 'title']);
        $about = implode(' · ', array_filter([$user->headline, $user->program, $user->profile?->department]));
        $list = $works->map(fn ($w) => '<li><a href="/works/'.$w->id.'">'.e($w->title).'</a></li>')->implode('');

        return [
            'title' => $user->name,
            'description' => self::short($about !== '' ? "{$about}. Research portfolio on Tuklas." : 'Research portfolio on Tuklas.'),
            'url' => self::url("/u/{$user->username}"),
            'type' => 'profile',
            'scholar' => [],
            'body' => '<article class="prerender"><h1>'.e($user->name).'</h1>'.($about !== '' ? '<p>'.e($about).'</p>' : '')
                .($list !== '' ? '<h2>Research &amp; literary works</h2><ul>'.$list.'</ul>' : '').'</article>',
        ];
    }

    /** @param Collection<int, string> $authors */
    private static function article(string $title, Collection $authors, string $abstract, ?string $pdf): string
    {
        return '<article class="prerender"><h1>'.e($title).'</h1><p>'.e($authors->implode(', ')).'</p>'
            .'<h2>Abstract</h2><p>'.nl2br(e($abstract), false).'</p>'
            .($pdf ? '<p><a href="'.e($pdf).'">Full text (PDF)</a></p>' : '').'</article>';
    }

    private static function short(string $text): string
    {
        return Str::limit(trim(preg_replace('/\s+/', ' ', $text) ?? ''), 297);
    }

    private static function url(string $path): string
    {
        return rtrim((string) config('app.url'), '/').$path;
    }
}
