---
paths:
  - "tuklas/tests/**/*.php"
---

# Test rules

- Feature tests live in `tests/Feature/<Module>/<Subject>Test.php`, one class per subject.
- `use RefreshDatabase`. Use the demo data with `$this->seedDemo()` (educators and admins get 2FA)
  or factories; name the demo people you rely on in the class docblock (1 Andrea, 3 Kim, 4 Santos…).
- For each endpoint cover: success, refused (validation, 403), and hidden (404 for someone who
  may not see it). Signed-out requests: `$this->signOut()` after `actingAs()`.
- The local disk is already faked (`tests/TestCase.php`). Fake other effects you assert on:
  `Mail::fake()`, `Queue::fake()`, `Notification` rows via the model.
- Assert behaviour (status, JSON paths, database rows, files), not implementation details.
- Don't weaken or delete an existing test to make a change pass. If a test is wrong, say why and ask.
- Run the one class while iterating: `php artisan test --filter=<Class>`.
