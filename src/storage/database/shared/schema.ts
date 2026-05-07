import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: serial().primaryKey(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const knowledgePoints = pgTable(
  "knowledge_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    content: text("content").notNull(),
    normalizedContent: text("normalized_content").notNull(),
    meaning: text("meaning").notNull(),
    explanation: text("explanation"),
    difficulty: text("difficulty"),
    exampleSentence: text("example_sentence"),
    sourceArticleId: text("source_article_id"),
    sourceArticleTitle: text("source_article_title"),
    sourceParagraphId: text("source_paragraph_id"),
    masterStatus: text("master_status").notNull().default("learning"),
    isActive: boolean("is_active").notNull().default(true),
    encounterCount: integer("encounter_count").notNull().default(1),
    reviewCount: integer("review_count").notNull().default(0),
    practiceNeed: integer("practice_need").notNull().default(3),
    correctStreak: integer("correct_streak").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastPracticedAt: timestamp("last_practiced_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastReviewedAt: timestamp("last_reviewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    nextReviewAt: timestamp("next_review_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastMasteredAt: timestamp("last_mastered_at", {
      withTimezone: true,
      mode: "date",
    }),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userPointUniqueIdx: uniqueIndex("kp_user_type_normalized_content_uidx").on(
      table.userId,
      table.type,
      table.normalizedContent
    ),
    userActiveReviewIdx: index("kp_user_active_next_review_idx").on(
      table.userId,
      table.isActive,
      table.nextReviewAt
    ),
    userPracticeNeedIdx: index("kp_user_practice_need_idx").on(
      table.userId,
      table.practiceNeed
    ),
  })
);

export const knowledgePointEvents = pgTable(
  "knowledge_point_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgePointId: uuid("knowledge_point_id")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type").notNull(),
    eventSource: text("event_source").notNull(),
    articleId: text("article_id"),
    paragraphId: text("paragraph_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    knowledgePointCreatedIdx: index("kpe_knowledge_point_created_idx").on(
      table.knowledgePointId,
      table.createdAt
    ),
    userEventCreatedIdx: index("kpe_user_event_created_idx").on(
      table.userId,
      table.eventType,
      table.createdAt
    ),
  })
);

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    sessionType: text("session_type").notNull(),
    status: text("status").notNull().default("started"),
    questionCount: integer("question_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userSessionCreatedIdx: index("ps_user_session_created_idx").on(
      table.userId,
      table.sessionType,
      table.createdAt
    ),
  })
);

export const practiceAnswers = pgTable(
  "practice_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    knowledgePointId: uuid("knowledge_point_id")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    questionType: text("question_type").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    userAnswer: text("user_answer"),
    correctAnswer: text("correct_answer"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sessionAnswerIdx: index("pa_session_answer_idx").on(
      table.sessionId,
      table.createdAt
    ),
    knowledgePointAnswerIdx: index("pa_knowledge_point_answer_idx").on(
      table.knowledgePointId,
      table.createdAt
    ),
  })
);
