CREATE TYPE "public"."category" AS ENUM('hoodie', 'tee', 'acc', 'other');--> statement-breakpoint
CREATE TYPE "public"."image_slot" AS ENUM('front', 'back', 'detail');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'assembled', 'shipped', 'delivered', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'drop', 'live', 'soldout', 'archive');--> statement-breakpoint
CREATE TABLE "delivery_methods" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"needs_address" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_watchers" (
	"product_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "drop_watchers_product_id_user_id_pk" PRIMARY KEY("product_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"size_id" integer NOT NULL,
	"size_label" text NOT NULL,
	"title" text NOT NULL,
	"product_no" text NOT NULL,
	"price" integer NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"no" text,
	"user_id" bigint NOT NULL,
	"subject_no" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"delivery_key" text NOT NULL,
	"delivery_title" text NOT NULL,
	"delivery_price" integer DEFAULT 0 NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"items_total" integer NOT NULL,
	"total" integer NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"invoice_link" text,
	"reserved_until" timestamp with time zone,
	"telegram_payment_charge_id" text,
	"provider_payment_charge_id" text,
	"track_no" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"slot" "image_slot" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"key" text NOT NULL,
	"widths" jsonb NOT NULL,
	"formats" jsonb NOT NULL,
	"w" integer NOT NULL,
	"h" integer NOT NULL,
	"lqip" text NOT NULL,
	"bbox" jsonb,
	"alpha" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"height_min" integer,
	"height_max" integer,
	"length" integer,
	"width" integer,
	"sleeve" integer
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"no" text NOT NULL,
	"slug" text NOT NULL,
	"sig" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"category" "category" DEFAULT 'other' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"old_price" integer,
	"color" text DEFAULT '' NOT NULL,
	"batch" text DEFAULT '' NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"drop_at" timestamp with time zone,
	"proto" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hotspots" jsonb DEFAULT '{"front":[],"back":[]}'::jsonb NOT NULL,
	"todo" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"language_code" text,
	"subject_no" text NOT NULL,
	"height" integer,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drop_watchers" ADD CONSTRAINT "drop_watchers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_watchers" ADD CONSTRAINT "drop_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_size_id_product_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."product_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_no_uq" ON "orders" USING btree ("no");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payload_uq" ON "orders" USING btree ("payload");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tg_charge_uq" ON "orders" USING btree ("telegram_payment_charge_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sizes_uq" ON "product_sizes" USING btree ("product_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "products_no_uq" ON "products" USING btree ("no");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");