CREATE TABLE "health_check" (
	"id" serial PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_point_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_source" text NOT NULL,
	"article_id" text,
	"paragraph_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"normalized_content" text NOT NULL,
	"meaning" text NOT NULL,
	"explanation" text,
	"difficulty" text,
	"example_sentence" text,
	"source_article_id" text,
	"source_article_title" text,
	"source_paragraph_id" text,
	"master_status" text DEFAULT 'learning' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"encounter_count" integer DEFAULT 1 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"practice_need" integer DEFAULT 3 NOT NULL,
	"correct_streak" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_practiced_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"last_mastered_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"knowledge_point_id" uuid NOT NULL,
	"question_type" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"user_answer" text,
	"correct_answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_type" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_point_events" ADD CONSTRAINT "knowledge_point_events_knowledge_point_id_knowledge_points_id_fk" FOREIGN KEY ("knowledge_point_id") REFERENCES "public"."knowledge_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_knowledge_point_id_knowledge_points_id_fk" FOREIGN KEY ("knowledge_point_id") REFERENCES "public"."knowledge_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpe_knowledge_point_created_idx" ON "knowledge_point_events" USING btree ("knowledge_point_id","created_at");--> statement-breakpoint
CREATE INDEX "kpe_user_event_created_idx" ON "knowledge_point_events" USING btree ("user_id","event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kp_user_type_normalized_content_uidx" ON "knowledge_points" USING btree ("user_id","type","normalized_content");--> statement-breakpoint
CREATE INDEX "kp_user_active_next_review_idx" ON "knowledge_points" USING btree ("user_id","is_active","next_review_at");--> statement-breakpoint
CREATE INDEX "kp_user_practice_need_idx" ON "knowledge_points" USING btree ("user_id","practice_need");--> statement-breakpoint
CREATE INDEX "pa_session_answer_idx" ON "practice_answers" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "pa_knowledge_point_answer_idx" ON "practice_answers" USING btree ("knowledge_point_id","created_at");--> statement-breakpoint
CREATE INDEX "ps_user_session_created_idx" ON "practice_sessions" USING btree ("user_id","session_type","created_at");