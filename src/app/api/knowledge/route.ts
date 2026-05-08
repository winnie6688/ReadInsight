import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { logger } from "@/lib/logger";

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
  return new Date(now.getTime() + ONE_DAY_MS).toISOString();
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

    const now = new Date().toISOString();
    const savedPoints: Array<{
      id: string;
      type: string;
      content: string;
      meaning: string;
      explanation: string | null;
      difficulty: string;
      example: string | null;
      sourceParagraphId: string | null;
      sourceArticleId: string | null;
      sourceArticleTitle: string | null;
      masterStatus: string;
      reviewCount: number;
      lastReviewAt: number | null;
      createdAt: number;
    }> = [];

    for (const point of points) {
      if (!point.content?.trim()) {
        continue;
      }

      const type = point.type || "word";
      const normalizedContent = normalizeContent(point.content);
      const content = point.content.trim();
      const meaning = point.meaning?.trim() || "";
      const explanation = point.explanation?.trim() || null;
      const difficulty = point.difficulty || "cet4";
      const example = point.example?.trim() || null;

      // 查询是否已存在
      const { data: existing, error: selectError } = await supabase
        .from("knowledge_points")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("normalized_content", normalizedContent)
        .eq("is_active", true)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        logger.error("查询知识点失败", { error: selectError });
      }

      if (!existing) {
        // 新增知识点
        const { data: inserted, error: insertError } = await supabase
          .from("knowledge_points")
          .insert({
            user_id: userId,
            type,
            content,
            normalized_content: normalizedContent,
            meaning,
            explanation,
            difficulty,
            example_sentence: example,
            source_article_id: articleId || null,
            source_article_title: articleTitle || null,
            source_paragraph_id: paragraphId || null,
            master_status: "learning",
            is_active: true,
            encounter_count: 1,
            review_count: 0,
            practice_need: DEFAULT_PRACTICE_NEED,
            correct_streak: 0,
            last_seen_at: now,
            next_review_at: buildNextReviewAt(new Date()),
          })
          .select()
          .single();

        if (insertError) {
          logger.error("插入知识点失败", { error: insertError });
          continue;
        }

        // 记录事件
        await supabase.from("knowledge_point_events").insert({
          knowledge_point_id: inserted.id,
          user_id: userId,
          event_type: "created",
          event_source: "reading",
          article_id: articleId || null,
          paragraph_id: paragraphId || null,
          payload: {
            content: inserted.content,
            meaning: inserted.meaning,
            practice_need: inserted.practice_need,
          },
        });

        savedPoints.push({
          id: inserted.id,
          type: inserted.type,
          content: inserted.content,
          meaning: inserted.meaning,
          explanation: inserted.explanation,
          difficulty: inserted.difficulty,
          example: inserted.example_sentence,
          sourceParagraphId: inserted.source_paragraph_id,
          sourceArticleId: inserted.source_article_id,
          sourceArticleTitle: inserted.source_article_title,
          masterStatus: inserted.master_status,
          reviewCount: inserted.review_count,
          lastReviewAt: inserted.last_reviewed_at ? new Date(inserted.last_reviewed_at).getTime() : null,
          createdAt: new Date(inserted.created_at).getTime(),
        });
        continue;
      }

      // 更新已有知识点
      const nextPracticeNeed = Math.min((existing.practice_need || DEFAULT_PRACTICE_NEED) + 1, 8);
      const existingNextReview = existing.next_review_at ? new Date(existing.next_review_at).getTime() : 0;
      const newNextReview = buildNextReviewAt(new Date());
      const nextReviewAt = existingNextReview > new Date(newNextReview).getTime() ? existing.next_review_at : newNextReview;

      const { data: updated, error: updateError } = await supabase
        .from("knowledge_points")
        .update({
          meaning: existing.meaning || meaning,
          explanation: existing.explanation || explanation,
          difficulty: existing.difficulty || difficulty,
          example_sentence: existing.example_sentence || example,
          source_article_id: existing.source_article_id || articleId || null,
          source_article_title: existing.source_article_title || articleTitle || null,
          source_paragraph_id: existing.source_paragraph_id || paragraphId || null,
          master_status: "learning",
          is_active: true,
          encounter_count: (existing.encounter_count || 0) + 1,
          practice_need: nextPracticeNeed,
          correct_streak: 0,
          last_seen_at: now,
          next_review_at: nextReviewAt,
          archived_at: null,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        logger.error("更新知识点失败", { error: updateError });
        continue;
      }

      // 记录事件
      await supabase.from("knowledge_point_events").insert({
        knowledge_point_id: updated.id,
        user_id: userId,
        event_type: "re_encountered",
        event_source: "reading",
        article_id: articleId || null,
        paragraph_id: paragraphId || null,
        payload: {
          content: updated.content,
          previousPracticeNeed: existing.practice_need,
          currentPracticeNeed: updated.practice_need,
          encounterCount: updated.encounter_count,
        },
      });

      savedPoints.push({
        id: updated.id,
        type: updated.type,
        content: updated.content,
        meaning: updated.meaning,
        explanation: updated.explanation,
        difficulty: updated.difficulty,
        example: updated.example_sentence,
        sourceParagraphId: updated.source_paragraph_id,
        sourceArticleId: updated.source_article_id,
        sourceArticleTitle: updated.source_article_title,
        masterStatus: updated.master_status,
        reviewCount: updated.review_count,
        lastReviewAt: updated.last_reviewed_at ? new Date(updated.last_reviewed_at).getTime() : null,
        createdAt: new Date(updated.created_at).getTime(),
      });
    }

    const duration = Date.now() - startTime;
    logger.api.response("POST", "/api/knowledge", 200, duration);

    return NextResponse.json({
      success: true,
      message: `成功保存 ${savedPoints.length} 个知识点`,
      data: { count: savedPoints.length, points: savedPoints },
    });
  } catch (error) {
    logger.api.error("POST", "/api/knowledge", error);

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

    const { data: rows, error } = await supabase
      .from("knowledge_points")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("获取知识点失败", { error });
      return NextResponse.json(
        { success: false, error: "获取失败" },
        { status: 500 }
      );
    }

    const grouped = rows.reduce<
      Array<{
        articleId: string;
        articleTitle: string;
        points: Array<{
          id: string;
          type: string;
          content: string;
          meaning: string;
          explanation: string | null;
          difficulty: string;
          example: string | null;
          sourceParagraphId: string | null;
          sourceArticleId: string | null;
          sourceArticleTitle: string | null;
          masterStatus: string;
          reviewCount: number;
          lastReviewAt: number | null;
          createdAt: number;
        }>;
      }>
    >((acc, row) => {
      const articleKey = row.source_article_id || "unknown";
      const articleTitle = row.source_article_title || "未归属文章";
      const existingGroup = acc.find((item) => item.articleId === articleKey);

      const point = {
        id: row.id,
        type: row.type,
        content: row.content,
        meaning: row.meaning,
        explanation: row.explanation,
        difficulty: row.difficulty,
        example: row.example_sentence,
        sourceParagraphId: row.source_paragraph_id,
        sourceArticleId: row.source_article_id,
        sourceArticleTitle: row.source_article_title,
        masterStatus: row.master_status,
        reviewCount: row.review_count,
        lastReviewAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).getTime() : null,
        createdAt: new Date(row.created_at).getTime(),
      };

      if (existingGroup) {
        existingGroup.points.push(point);
        return acc;
      }

      acc.push({
        articleId: articleKey,
        articleTitle,
        points: [point],
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
