


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_game_request"("target_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  request_row public.game_requests;
  session_row public.game_sessions;
begin
  update public.game_requests as gr
  set status = 'accepted', updated_at = now()
  where gr.id = target_request_id
    and gr.recipient_id = auth.uid()
    and gr.status = 'pending'
    and gr.expires_at > now()
  returning gr.* into request_row;

  if request_row.id is null then
    raise exception 'Game request is no longer active';
  end if;

  insert into public.game_sessions (player_x_id, player_o_id)
  values (request_row.requester_id, request_row.recipient_id)
  returning * into session_row;

  return jsonb_build_object('request', to_jsonb(request_row), 'session_id', session_row.id);
end;
$$;


ALTER FUNCTION "public"."accept_game_request"("target_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_game_request"("target_recipient_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  request_row public.game_requests;
  existing_row public.game_requests;
begin
  if auth.uid() is null then
    raise exception 'Sign in before sending a game request';
  end if;

  update public.game_requests as gr
  set status = 'expired', updated_at = now()
  where gr.requester_id = auth.uid()
    and gr.recipient_id = target_recipient_id
    and gr.status = 'pending'
    and gr.expires_at <= now();

  select gr.* into existing_row
  from public.game_requests as gr
  where gr.requester_id = auth.uid()
    and gr.recipient_id = target_recipient_id
    and gr.status = 'pending'
    and gr.expires_at > now();

  if existing_row.id is not null then
    return jsonb_build_object('id', existing_row.id, 'requester_id', existing_row.requester_id, 'recipient_id', existing_row.recipient_id, 'game_type', existing_row.game_type, 'status', existing_row.status, 'expires_at', existing_row.expires_at, 'created_at', existing_row.created_at, 'updated_at', existing_row.updated_at, 'wasExisting', true);
  end if;

  insert into public.game_requests (requester_id, recipient_id)
  values (auth.uid(), target_recipient_id)
  returning * into request_row;

  return jsonb_build_object('id', request_row.id, 'requester_id', request_row.requester_id, 'recipient_id', request_row.recipient_id, 'game_type', request_row.game_type, 'status', request_row.status, 'expires_at', request_row.expires_at, 'created_at', request_row.created_at, 'updated_at', request_row.updated_at);
end;
$$;


ALTER FUNCTION "public"."create_game_request"("target_recipient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_profile_uid"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  position integer;
begin
  loop
    candidate := '';
    for position in 1..8 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
      if position = 4 then
        candidate := candidate || '-';
      end if;
    end loop;

    exit when not exists (select 1 from public.profiles where uid = candidate);
  end loop;

  return candidate;
end;
$$;


ALTER FUNCTION "public"."generate_profile_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email)
  values (
    new.id, 
    new.email
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "direct_messages_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 2000))),
    CONSTRAINT "direct_messages_distinct_participants" CHECK (("sender_id" <> "recipient_id"))
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "request_type" "text" DEFAULT 'friend'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "friend_requests_distinct_users" CHECK (("requester_id" <> "recipient_id")),
    CONSTRAINT "friend_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['friend'::"text", 'partner'::"text"]))),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "game_type" "text" DEFAULT 'tic-tac-toe'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:01:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "game_requests_check" CHECK (("requester_id" <> "recipient_id")),
    CONSTRAINT "game_requests_game_type_check" CHECK (("game_type" = 'tic-tac-toe'::"text")),
    CONSTRAINT "game_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."game_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_type" "text" DEFAULT 'tic-tac-toe'::"text" NOT NULL,
    "player_x_id" "uuid" NOT NULL,
    "player_o_id" "uuid" NOT NULL,
    "board" "jsonb" DEFAULT '[null, null, null, null, null, null, null, null, null]'::"jsonb" NOT NULL,
    "turn" "text" DEFAULT 'X'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "winner" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "game_sessions_check" CHECK (("player_x_id" <> "player_o_id")),
    CONSTRAINT "game_sessions_game_type_check" CHECK (("game_type" = 'tic-tac-toe'::"text")),
    CONSTRAINT "game_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'won'::"text", 'draw'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "game_sessions_turn_check" CHECK (("turn" = ANY (ARRAY['X'::"text", 'O'::"text"]))),
    CONSTRAINT "game_sessions_winner_check" CHECK ((("winner" = ANY (ARRAY['X'::"text", 'O'::"text"])) OR ("winner" IS NULL)))
);


ALTER TABLE "public"."game_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "game_request_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_kind_check" CHECK (("kind" = 'game_request'::"text"))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_uid" bigint NOT NULL,
    "display_name" "text",
    "uid" "text" DEFAULT "public"."generate_profile_uid"() NOT NULL,
    "partner_id" "uuid",
    "partner_name" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."uid" IS 'Human-friendly unique identifier used for friend discovery.';



ALTER TABLE "public"."profiles" ALTER COLUMN "display_uid" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profiles_display_uid_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_requests"
    ADD CONSTRAINT "game_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_display_uid_key" UNIQUE ("display_uid");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



CREATE INDEX "direct_messages_conversation_idx" ON "public"."direct_messages" USING "btree" ("sender_id", "recipient_id", "created_at");



CREATE INDEX "friend_requests_recipient_idx" ON "public"."friend_requests" USING "btree" ("recipient_id", "status", "created_at");



CREATE INDEX "friend_requests_requester_idx" ON "public"."friend_requests" USING "btree" ("requester_id", "status", "created_at");



CREATE UNIQUE INDEX "game_requests_pending_unique" ON "public"."game_requests" USING "btree" ("requester_id", "recipient_id", "game_type") WHERE ("status" = 'pending'::"text");



CREATE INDEX "game_requests_recipient_idx" ON "public"."game_requests" USING "btree" ("recipient_id", "status", "expires_at");



CREATE INDEX "game_requests_requester_idx" ON "public"."game_requests" USING "btree" ("requester_id", "status");



CREATE INDEX "game_sessions_players_idx" ON "public"."game_sessions" USING "btree" ("player_x_id", "player_o_id");



CREATE INDEX "notifications_user_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "profiles_uid_key" ON "public"."profiles" USING "btree" ("uid");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_requests"
    ADD CONSTRAINT "game_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_requests"
    ADD CONSTRAINT "game_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_player_o_id_fkey" FOREIGN KEY ("player_o_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_player_x_id_fkey" FOREIGN KEY ("player_x_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_game_request_id_fkey" FOREIGN KEY ("game_request_id") REFERENCES "public"."game_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can discover profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Participants can read direct messages" ON "public"."direct_messages" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Profiles are viewable by authenticated users." ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Recipients can update friend requests" ON "public"."friend_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "recipient_id")) WITH CHECK (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Users can create their own friend requests" ON "public"."friend_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can read related friend requests" ON "public"."friend_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Users can send direct messages" ON "public"."direct_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their own profile." ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "game requests visible to participants" ON "public"."game_requests" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



ALTER TABLE "public"."game_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications belong to user" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "players update their sessions" ON "public"."game_sessions" FOR UPDATE USING ((("auth"."uid"() = "player_x_id") OR ("auth"."uid"() = "player_o_id"))) WITH CHECK ((("auth"."uid"() = "player_x_id") OR ("auth"."uid"() = "player_o_id")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recipients update pending requests" ON "public"."game_requests" FOR UPDATE USING ((("auth"."uid"() = "recipient_id") AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = ANY (ARRAY['accepted'::"text", 'declined'::"text", 'expired'::"text"])));



CREATE POLICY "sessions visible to players" ON "public"."game_sessions" FOR SELECT USING ((("auth"."uid"() = "player_x_id") OR ("auth"."uid"() = "player_o_id")));



CREATE POLICY "subscriptions belong to user" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users create own game requests" ON "public"."game_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "users mark own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_game_request"("target_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_game_request"("target_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_game_request"("target_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_game_request"("target_recipient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_game_request"("target_recipient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_game_request"("target_recipient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_profile_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_profile_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_profile_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."game_requests" TO "anon";
GRANT ALL ON TABLE "public"."game_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."game_requests" TO "service_role";



GRANT ALL ON TABLE "public"."game_sessions" TO "anon";
GRANT ALL ON TABLE "public"."game_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."game_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profiles_display_uid_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profiles_display_uid_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profiles_display_uid_seq" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
