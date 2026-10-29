<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\Auth\AccountResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    /** GET /api/auth/me — {user}, or 401 when signed out. */
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => new AccountResource($request->user())]);
    }
}
