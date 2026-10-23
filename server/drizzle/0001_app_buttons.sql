CREATE TABLE "app_buttons" (
	"chat_id" bigint NOT NULL,
	"message_id" integer NOT NULL,
	"base" text NOT NULL,
	"markup" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_buttons_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
CREATE INDEX "app_buttons_created" ON "app_buttons" USING btree ("created_at");