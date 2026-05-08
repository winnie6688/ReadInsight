import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  knowledgePointEvents,
  knowledgePoints,
} from "@/storage/database/shared/schema";

const DEFAULT_USER_ID = "local-dev-user";
const DEFAULT_PRACTICE_NEED = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface IncomingKnowledgePoint {
  type?: string;
  content?: string;
  meaning?: string;
  explanation?: string;
  difficulty?: string;
  example?: string;
}

interface SaveKnowledgeRequest {
  articleId?: string;
  articleTitle?: string;
  paragraphId?: string;
  userId?: string;
  points?: IncomingKnowledgePoint[];
}

function normalizeContent(content: string) {
  return content
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildNextReviewAt(now: Date) {
  return new Date(now.getTime() + ONE_DAY_MS);
}

function mapKnowledgePointRow(row: typeof knowledgePoints.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    meaning: row.meaning,
    explanation: row.explanation,
    difficulty: row.difficulty,
    example: row.exampleSentence,
    sourceParagraphId: row.sourceParagraphId,
    sourceArticleId: row.sourceArticleId,
    sourceArticleTitle: row.sourceArticleTitle,
    masterStatus: row.masterStatus,
    reviewCount: row.reviewCount,
    lastReviewAt: row.lastReviewedAt?.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}

// 保存知识点到知识库
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as SaveKnowledgeRequest;
    const { articleId, articleTitle, paragraphId, userId = DEFAULT_USER_ID, points } = body;

    logger.api.request("POST", "/api/knowledge", {
      articleId,
      articleTitle,
      paragraphId,
      pointCount: points?.length ?? 0,
      userId,
    });

    if (!points || !Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { success: false, error: "知识点数据无效" },
        { status: 400 }
      );
    }

    const now = new Date();
    const savedPoints: Array<ReturnType<typeof mapKnowledgePointRow>> = [];

    await db.transaction(async (tx) => {
      for (const point of points) {
        if (!point.content?.trim()) {
          continue;
        }

        const type = point.type || "word";
        const normalizedContent = normalizeContent(point.content);

        const [existing] = await tx
          .select()
          .from(knowledgePoints)
          .where(
            and(
              eq(knowledgePoints.userId, userId),
              eq(knowledgePoints.type, type),
              eq(knowledgePoints.normalizedContent, normalizedContent)
            )
          )
          .limit(1);

        if (!existing) {
          const [inserted] = await tx
            .insert(knowledgePoints)
            .values({
              userId,
              type,
              content: point.content.trim(),
              normalizedContent,
              meaning: point.meaning?.trim() || "",
              explanation: point.explanation?.trim() || null,
              difficulty: point.difficulty || "cet4",
              exampleSentence: point.example?.trim() || null,
              sourceArticleId: articleId || null,
              sourceArticleTitle: articleTitle || null,
              sourceParagraphId: paragraphId || null,
              masterStatus: "learning",
              isActive: true,
              encounterCount: 1,
              reviewCount: 0,
              practiceNeed: DEFAULT_PRACTICE_NEED,
              correctStreak: 0,
              lastSeenAt: now,
              nextReviewAt: buildNextReviewAt(now),
            })
            .returning();

          await tx.insert(knowledgePointEvents).values({
            knowledgePointId: inserted.id,
            userId,
            eventType: "created",
            eventSource: "reading",
            articleId: articleId || null,
            paragraphId: paragraphId || null,
            payload: {
              content: inserted.content,
              meaning: inserted.meaning,
              practiceNeed: inserted.practiceNeed,
            },
          });

          savedPoints.push(mapKnowledgePointRow(inserted));
          continue;
        }

        const nextPracticeNeed = Math.min(existing.practiceNeed + 1, 8);
        const nextReviewAt =
          !existing.nextReviewAt || existing.nextReviewAt.getTime() > buildNextReviewAt(now).getTime()
            ? buildNextReviewAt(now)
            : existing.nextReviewAt;

        const [updated] = await tx
          .update(knowledgePoints)
          .set({
            meaning: existing.meaning || point.meaning?.trim() || "",
            explanation: existing.explanation || point.explanation?.trim() || null,
            difficulty: existing.difficulty || point.difficulty || "cet4",
            exampleSentence: existing.exampleSentence || point.example?.trim() || null,
            sourceArticleId: existing.sourceArticleId || articleId || null,
            sourceArticleTitle: existing.sourceArticleTitle || articleTitle || null,
            sourceParagraphId: existing.sourceParagraphId || paragraphId || null,
            masterStatus: "learning",
            isActive: true,
            encounterCount: existing.encounterCount + 1,
            practiceNeed: nextPracticeNeed,
            correctStreak: 0,
            lastSeenAt: now,
            nextReviewAt,
            archivedAt: null,
            updatedAt: now,
          })
          .where(eq(knowledgePoints.id, existing.id))
          .returning();

        await tx.insert(knowledgePointEvents).values({
          knowledgePointId: updated.id,
          userId,
          eventType: "re_encountered",
          eventSource: "reading",
          articleId: articleId || null,
          paragraphId: paragraphId || null,
          payload: {
            content: updated.content,
            previousPracticeNeed: existing.practiceNeed,
            currentPracticeNeed: updated.practiceNeed,
            encounterCount: updated.encounterCount,
          },
        });

        savedPoints.push(mapKnowledgePointRow(updated));
      }
    });

    const duration = Date.now() - startTime;
    logger.api.response("POST", "/api/knowledge", 200, duration);

    return NextResponse.json({
      success: true,
      message: `成功保存 ${savedPoints.length} 个知识点`,
      data: { count: savedPoints.length, points: savedPoints },
    });
  } catch (error) {
    logger.api.error("POST", "/api/knowledge", error);
    
    // 检查是否为数据库未配置错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("DATABASE_NOT_CONFIGURED")) {
      return NextResponse.json(
        { success: false, error: "知识库功能暂不可用，请配置数据库连接" },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: "保存失败" },
      { status: 500 }
    );
  }
}

// 获取知识库列表
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = request.nextUrl.searchParams.get("userId") || DEFAULT_USER_ID;

    logger.api.request("GET", "/api/knowledge", { userId });

    const rows = await db
      .select()
      .from(knowledgePoints)
      .where(eq(knowledgePoints.userId, userId))
      .orderBy(desc(knowledgePoints.createdAt));

    const grouped = rows.reduce<
      Array<{ articleId: string; articleTitle: string; points: Array<ReturnType<typeof mapKnowledgePointRow>> }>
    >((acc, row) => {
      const articleKey = row.sourceArticleId || "unknown";
      const articleTitle = row.sourceArticleTitle || "未归属文章";
      const existingGroup = acc.find((item) => item.articleId === articleKey);

      if (existingGroup) {
        existingGroup.points.push(mapKnowledgePointRow(row));
        return acc;
      }

      acc.push({
        articleId: articleKey,
        articleTitle,
        points: [mapKnowledgePointRow(row)],
      });
      return acc;
    }, []);

    const duration = Date.now() - startTime;
    logger.api.response("GET", "/api/knowledge", 200, duration);

    return NextResponse.json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    logger.api.error("GET", "/api/knowledge", error);
    return NextResponse.json(
      { success: false, error: "获取失败" },
      { status: 500 }
    );
  }
}
