# supabase/tests

Two SQL suites that run against the local Postgres, plus a runner.

    ./supabase/tests/run.sh

Each suite rebuilds the database first, so they are order independent and there is no
shared fixture to keep in your head.

## One thing worth knowing before you read the RLS suite

**Row level security cannot be tested as a superuser.** A superuser bypasses every
policy, and `alter table ... force row level security` does not change that: FORCE makes
policies apply to the table OWNER, and superuser is a separate exemption on top.

The first version of this suite ran as the local superuser and reported that Priya could
see every firm's events. The natural reading is that the policies are broken. The actual
problem was the test. So the suite switches to the `authenticated` role explicitly, and
it does so inside a transaction, because `SET LOCAL` outside a transaction block is a
warning and a no op rather than an error.

That combination, a silent no op and an exemption that does not look like one, is how
you end up confidently shipping a policy that has never once been exercised.
