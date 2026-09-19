import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const postViews = sqliteTable("post_views", {
  slug: text("slug").primaryKey(),
  views: integer("views").notNull().default(0),
});
