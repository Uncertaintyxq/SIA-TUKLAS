<?php

namespace Tests\Feature\Security;

use App\Enums\ConversationKind;
use App\Models\Comment;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_responses_carry_hardening_headers(): void
    {
        $this->getJson('/api/auth/me')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox")
            ->assertHeaderMissing('X-Powered-By');
    }

    public function test_other_websites_get_no_cors_access(): void
    {
        $this->withHeaders(['Origin' => 'https://evil.example'])
            ->getJson('/api/auth/me')
            ->assertHeaderMissing('Access-Control-Allow-Origin');

        $this->withHeaders(['Origin' => 'https://evil.example', 'Access-Control-Request-Method' => 'POST'])
            ->options('/api/auth/login')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_unknown_api_paths_answer_in_the_api_error_shape(): void
    {
        $this->getJson('/api/nothing-here')->assertNotFound()->assertExactJson(['error' => 'Not found']);
    }

    public function test_private_text_is_encrypted_in_the_database(): void
    {
        $student = User::factory()->create();
        $adviser = User::factory()->educator()->create();
        $work = new Work(['type' => 'research', 'title' => 'LoRa mesh', 'abstract' => '…', 'tags' => [], 'adviser_id' => $adviser->id]);
        $work->author()->associate($student)->save();
        $work->comments()->create(['author_id' => $adviser->id, 'scope' => 'review', 'text' => 'Please tighten chapter 2']);
        $chat = Conversation::create(['kind' => ConversationKind::Direct, 'direct_key' => Conversation::directKey($student->id, $adviser->id)]);
        $chat->messages()->create(['sender_id' => $student->id, 'text' => 'See you at consultation']);

        $this->assertStringNotContainsString('chapter 2', DB::table('comments')->value('text'));
        $this->assertStringNotContainsString('consultation', DB::table('messages')->value('text'));
        $this->assertSame('Please tighten chapter 2', Comment::first()->text);
        $this->assertSame('See you at consultation', Message::first()->text);
    }
}
