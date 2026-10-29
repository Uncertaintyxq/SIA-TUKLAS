<?php

use App\Http\Middleware\EnsureAccountReady;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\TouchLastSeen;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        // Broadcast channels are registered from routes/api.php, so their auth sits under /api.
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The React app signs in with a session cookie (Sanctum SPA auth), with CSRF protection on every write.
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
        $middleware->api(append: [TouchLastSeen::class]);
        $middleware->alias(['account.ready' => EnsureAccountReady::class]);
        $middleware->throttleApi('api');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every API error is {error, issues?}: the React app shows `error`; forms can mark fields from `issues`.
        $json = fn (Request $request) => $request->is('api/*') || $request->expectsJson();
        $error = fn (string $message, int $status, array $extra = []) => response()->json(['error' => $message, ...$extra], $status);

        $exceptions->render(function (ValidationException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error(collect($e->errors())->flatten()->first() ?? 'Check the form and try again.', $e->status, ['issues' => $e->errors()]);
            }
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error('Please log in to continue.', 401);
            }
        });
        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                // A gate or policy may deny with its own message (Response::deny); otherwise a generic one.
                $message = $e->getMessage();

                return $error($message === '' || $message === 'This action is unauthorized.' ? 'You don’t have access to this.' : $message, 403);
            }
        });
        // Hidden and missing look the same, so a 404 never reveals that something exists.
        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error('Not found', 404);
            }
        });
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error('Too many requests. Wait a moment and try again.', 429)->withHeaders($e->getHeaders());
            }
        });
        $exceptions->render(function (TokenMismatchException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error('Your session expired. Refresh the page and try again.', 419);
            }
        });
        $exceptions->render(function (PostTooLargeException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error('That file is too large. The limit is 20 MB.', 413);
            }
        });
        $exceptions->render(function (HttpException $e, Request $request) use ($json, $error) {
            if ($json($request)) {
                return $error($e->getMessage() ?: 'Something went wrong', $e->getStatusCode(), [])->withHeaders($e->getHeaders());
            }
        });
        $exceptions->render(function (Throwable $e, Request $request) use ($json, $error) {
            if ($json($request) && ! config('app.debug')) {
                return $error('Something went wrong', 500);
            }
        });
    })->create();
