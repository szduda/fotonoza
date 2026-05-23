import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const progress = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: new URL("./content/progress/", import.meta.url)
  }),
  schema: z.object({
    locale: z.enum(["en", "pl"]),
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    image: z.string(),
    rangeStart: z.string(),
    rangeEnd: z.string(),
    commitShas: z.string(),
    changeSummary: z.string().optional()
  })
});

export const collections = { progress };
