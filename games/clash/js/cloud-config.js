// Cloud save settings. Fill these two values after creating your free Supabase project
// (Project Settings > API). Leave URL empty to keep the game fully offline.
// The anon key is PUBLIC by design: Row Level Security (supabase/setup.sql) is what protects the data.
//
// domain: Supabase rejects sign-up addresses whose domain does not resolve (NXDOMAIN),
// so this MUST be a real, existing domain. No mail is ever sent to it: the typed address
// is only hashed into an internal account name <40-hex>@<domain>. Email confirmation
// must stay OFF in Supabase Auth so the game gets its session instantly.
const CLOUD={url:'https://pjezfictphwwfogneqpw.supabase.co',key:'sb_publishable_GdsfxxR6cLYUIurwTURYcQ_bY4joz0t',domain:'example.com'};
