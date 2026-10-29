<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Uploads;
use Database\Seeders\DemoSeeder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** "Reset demo data" — only exists when DEMO_MODE=true (and demo mode can't be on in production). */
class DemoController extends Controller
{
    /** POST /api/demo/reset — reloads the demo data and deletes every other account and upload. */
    public function reset(Request $request, DemoSeeder $seeder): Response
    {
        if (! config('tuklas.demo_mode')) {
            throw new HttpException(404, 'Not found');
        }
        $myId = $request->user()->id;

        $seeder->run();
        Uploads::clear();

        // Seeded ids are fixed, so a demo person stays signed in; a since-deleted sign-up is signed out.
        $me = User::find($myId);
        if ($me === null) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
        } else {
            // The reseed re-hashed the password; keep this session valid (Sanctum's AuthenticateSession checks it).
            $request->session()->put('password_hash_web', $me->getAuthPassword());
        }

        return response()->noContent();
    }
}
